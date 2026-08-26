import { AttendanceStatus, Prisma } from '@prisma/client'
import { Request } from 'express'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { businessDateDb, businessDateFromInstant, normalizeBusinessDate } from '../../utils/date-range'
import { recordAuditEventSafe } from '../audit-engine/audit-engine.service'
import { calculateAttendanceResult } from '../hr-engine/hr-engine.service'
import { assertBranchAccess, branchFilterForEmployees, resolveAllowedBranchIds } from './hr.util'
import { ensureDefaultShifts, resolveEmployeeShiftForDate } from './shifts.service'

function toStatus(s: string): AttendanceStatus {
  return s as AttendanceStatus
}

async function resolveActingEmployee(tenantId: string, req: Request, employeeId?: string) {
  if (employeeId) {
    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId, isActive: true, status: { in: ['ACTIVE', 'ON_LEAVE', 'CANDIDATE'] } },
    })
    if (!emp) throw new AppError('Employee not found', 404)
    await assertBranchAccess(req, emp.primaryBranchId)
    return emp
  }
  const userId = req.user?.userId
  if (!userId) throw new AppError('Employee id required', 400)
  const emp = await prisma.employee.findFirst({
    where: { tenantId, userId, isActive: true },
  })
  if (!emp) throw new AppError('No HR employee profile linked to your user', 404)
  return emp
}

function applyCalc(
  calc: ReturnType<typeof calculateAttendanceResult>,
): Pick<Prisma.AttendanceRecordUncheckedCreateInput, 'status' | 'workedMinutes' | 'lateMinutes' | 'earlyLeaveMinutes' | 'overtimeMinutes'> {
  return {
    status: toStatus(calc.status),
    workedMinutes: calc.workedMinutes,
    lateMinutes: calc.lateMinutes,
    earlyLeaveMinutes: calc.earlyLeaveMinutes,
    overtimeMinutes: calc.overtimeMinutes,
  }
}

export const attendanceService = {
  async board(tenantId: string, req: Request) {
    await ensureDefaultShifts(tenantId)
    const dateKey = normalizeBusinessDate(req.query.date as string | undefined)
    const day = businessDateDb(dateKey)
    const allowed = await resolveAllowedBranchIds(req)
    const branchWhere = branchFilterForEmployees(req, allowed)

    const employees = await prisma.employee.findMany({
      where: {
        tenantId,
        isActive: true,
        status: { in: ['ACTIVE', 'ON_LEAVE'] },
        ...branchWhere,
      },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        primaryBranchId: true,
        status: true,
        primaryBranch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    })

    const ids = employees.map(e => e.id)
    const records = ids.length
      ? await prisma.attendanceRecord.findMany({
          where: { tenantId, businessDate: day, employeeId: { in: ids } },
          include: {
            shift: { select: { id: true, name: true, startMinutes: true, endMinutes: true } },
          },
        })
      : []
    const byEmp = Object.fromEntries(records.map(r => [r.employeeId, r]))

    const summary = {
      present: 0,
      late: 0,
      halfDay: 0,
      absent: 0,
      other: 0,
    }
    const rows = employees.map(emp => {
      const rec = byEmp[emp.id]
      const status = rec?.status ?? 'ABSENT'
      if (status === 'PRESENT') summary.present += 1
      else if (status === 'LATE') summary.late += 1
      else if (status === 'HALF_DAY') summary.halfDay += 1
      else if (status === 'ABSENT') summary.absent += 1
      else summary.other += 1
      return {
        employee: emp,
        attendance: rec ?? null,
        status,
      }
    })

    return { date: dateKey, summary, rows }
  },

  async checkIn(tenantId: string, req: Request, body: { employeeId?: string; note?: string }, actorEmail?: string) {
    const emp = await resolveActingEmployee(tenantId, req, body.employeeId)
    const role = req.user?.role
    if (body.employeeId && role !== 'OWNER' && role !== 'MANAGER' && role !== 'PLATFORM_ADMIN') {
      if (emp.userId !== req.user?.userId) throw new AppError('You can only check in yourself', 403)
    }

    const dateKey = businessDateFromInstant()
    const day = businessDateDb(dateKey)
    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        tenantId_employeeId_businessDate: {
          tenantId,
          employeeId: emp.id,
          businessDate: day,
        },
      },
    })
    if (existing?.checkInAt) throw new AppError('Already checked in today', 409)

    const assignment = await resolveEmployeeShiftForDate(tenantId, emp.id, dateKey)
    const now = new Date()
    const calc = calculateAttendanceResult({
      checkInAt: now,
      checkOutAt: null,
      shift: assignment?.shift
        ? {
            startMinutes: assignment.shift.startMinutes,
            endMinutes: assignment.shift.endMinutes,
            graceMinutes: assignment.shift.graceMinutes,
            halfDayMinutes: assignment.shift.halfDayMinutes,
            isOvernight: assignment.shift.isOvernight,
          }
        : null,
    })

    const row = existing
      ? await prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            checkInAt: now,
            shiftId: assignment?.shiftId ?? null,
            note: body.note?.trim() || existing.note,
            ...applyCalc(calc),
            isManual: false,
          },
          include: {
            employee: { select: { id: true, fullName: true, employeeCode: true } },
            shift: { select: { id: true, name: true } },
          },
        })
      : await prisma.attendanceRecord.create({
          data: {
            tenantId,
            employeeId: emp.id,
            branchId: emp.primaryBranchId,
            businessDate: day,
            shiftId: assignment?.shiftId ?? null,
            checkInAt: now,
            note: body.note?.trim() || null,
            ...applyCalc(calc),
          },
          include: {
            employee: { select: { id: true, fullName: true, employeeCode: true } },
            shift: { select: { id: true, name: true } },
          },
        })

    void recordAuditEventSafe({
      tenantId,
      branchId: emp.primaryBranchId,
      eventType: 'HR_ATTENDANCE_CHECK_IN',
      entityType: 'AttendanceRecord',
      entityId: row.id,
      actorEmail,
      afterJson: { employeeId: emp.id, date: dateKey, status: row.status, ruleId: calc.ruleId },
    })
    return row
  },

  async checkOut(tenantId: string, req: Request, body: { employeeId?: string }, actorEmail?: string) {
    const emp = await resolveActingEmployee(tenantId, req, body.employeeId)
    const role = req.user?.role
    if (body.employeeId && role !== 'OWNER' && role !== 'MANAGER' && role !== 'PLATFORM_ADMIN') {
      if (emp.userId !== req.user?.userId) throw new AppError('You can only check out yourself', 403)
    }

    const dateKey = businessDateFromInstant()
    const day = businessDateDb(dateKey)
    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        tenantId_employeeId_businessDate: {
          tenantId,
          employeeId: emp.id,
          businessDate: day,
        },
      },
      include: { shift: true },
    })
    if (!existing?.checkInAt) throw new AppError('Check in first', 400)
    if (existing.checkOutAt) throw new AppError('Already checked out today', 409)

    const now = new Date()
    const calc = calculateAttendanceResult({
      checkInAt: existing.checkInAt,
      checkOutAt: now,
      shift: existing.shift
        ? {
            startMinutes: existing.shift.startMinutes,
            endMinutes: existing.shift.endMinutes,
            graceMinutes: existing.shift.graceMinutes,
            halfDayMinutes: existing.shift.halfDayMinutes,
            isOvernight: existing.shift.isOvernight,
          }
        : null,
    })

    const row = await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        checkOutAt: now,
        ...applyCalc(calc),
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
        shift: { select: { id: true, name: true } },
      },
    })

    void recordAuditEventSafe({
      tenantId,
      branchId: emp.primaryBranchId,
      eventType: 'HR_ATTENDANCE_CHECK_OUT',
      entityType: 'AttendanceRecord',
      entityId: row.id,
      actorEmail,
      afterJson: {
        employeeId: emp.id,
        date: dateKey,
        status: row.status,
        workedMinutes: row.workedMinutes,
        ruleId: calc.ruleId,
      },
    })
    return row
  },

  async correct(
    tenantId: string,
    req: Request,
    body: {
      employeeId: string
      date?: string
      checkInAt?: string | null
      checkOutAt?: string | null
      status?: AttendanceStatus
      note?: string
      shiftId?: string | null
    },
    actorEmail?: string,
  ) {
    const emp = await resolveActingEmployee(tenantId, req, body.employeeId)
    const dateKey = normalizeBusinessDate(body.date)
    const day = businessDateDb(dateKey)

    let shift: {
      id: string
      startMinutes: number
      endMinutes: number
      graceMinutes: number
      halfDayMinutes: number | null
      isOvernight: boolean
    } | null = null
    if (body.shiftId) {
      const s = await prisma.hrShift.findFirst({ where: { id: body.shiftId, tenantId } })
      if (!s) throw new AppError('Shift not found', 404)
      shift = s
    } else {
      const assignment = await resolveEmployeeShiftForDate(tenantId, emp.id, dateKey)
      shift = assignment?.shift ?? null
    }

    const checkInAt = body.checkInAt === undefined
      ? undefined
      : body.checkInAt
        ? new Date(body.checkInAt)
        : null
    const checkOutAt = body.checkOutAt === undefined
      ? undefined
      : body.checkOutAt
        ? new Date(body.checkOutAt)
        : null

    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        tenantId_employeeId_businessDate: {
          tenantId,
          employeeId: emp.id,
          businessDate: day,
        },
      },
    })

    const finalIn = checkInAt !== undefined ? checkInAt : (existing?.checkInAt ?? null)
    const finalOut = checkOutAt !== undefined ? checkOutAt : (existing?.checkOutAt ?? null)

    const forced = body.status === 'ABSENT' || body.status === 'HOLIDAY' || body.status === 'ON_LEAVE'
      ? body.status
      : null

    const calc = calculateAttendanceResult({
      checkInAt: forced ? null : finalIn,
      checkOutAt: forced ? null : finalOut,
      shift: shift
        ? {
            startMinutes: shift.startMinutes,
            endMinutes: shift.endMinutes,
            graceMinutes: shift.graceMinutes,
            halfDayMinutes: shift.halfDayMinutes,
            isOvernight: shift.isOvernight,
          }
        : null,
      forcedStatus: forced,
    })

    const metrics = body.status && !forced
      ? { ...applyCalc(calc), status: body.status }
      : applyCalc(calc)

    const data = {
      branchId: emp.primaryBranchId,
      shiftId: shift?.id ?? body.shiftId ?? null,
      checkInAt: forced ? null : finalIn,
      checkOutAt: forced ? null : finalOut,
      ...metrics,
      isManual: true,
      note: body.note?.trim() || existing?.note || null,
      correctedByEmail: actorEmail ?? null,
    }

    const row = existing
      ? await prisma.attendanceRecord.update({
          where: { id: existing.id },
          data,
          include: {
            employee: { select: { id: true, fullName: true, employeeCode: true } },
            shift: { select: { id: true, name: true } },
          },
        })
      : await prisma.attendanceRecord.create({
          data: {
            tenantId,
            employeeId: emp.id,
            businessDate: day,
            ...data,
          },
          include: {
            employee: { select: { id: true, fullName: true, employeeCode: true } },
            shift: { select: { id: true, name: true } },
          },
        })

    void recordAuditEventSafe({
      tenantId,
      branchId: emp.primaryBranchId,
      eventType: 'HR_ATTENDANCE_CORRECTED',
      entityType: 'AttendanceRecord',
      entityId: row.id,
      actorEmail,
      beforeJson: existing
        ? { status: existing.status, checkInAt: existing.checkInAt, checkOutAt: existing.checkOutAt }
        : null,
      afterJson: { status: row.status, checkInAt: row.checkInAt, checkOutAt: row.checkOutAt, ruleId: calc.ruleId },
    })
    return row
  },

  async myToday(tenantId: string, req: Request) {
    const emp = await resolveActingEmployee(tenantId, req)
    const dateKey = businessDateFromInstant()
    const day = businessDateDb(dateKey)
    const record = await prisma.attendanceRecord.findUnique({
      where: {
        tenantId_employeeId_businessDate: {
          tenantId,
          employeeId: emp.id,
          businessDate: day,
        },
      },
      include: { shift: { select: { id: true, name: true, startMinutes: true, endMinutes: true } } },
    })
    return { date: dateKey, employee: { id: emp.id, fullName: emp.fullName, employeeCode: emp.employeeCode }, attendance: record }
  },
}
