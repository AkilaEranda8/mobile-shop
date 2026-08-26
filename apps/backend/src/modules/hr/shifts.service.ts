import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { recordAuditEventSafe } from '../audit-engine/audit-engine.service'
import { validateShiftWindow } from '../hr-engine/hr-engine.service'
import { businessDateDb, normalizeBusinessDate } from '../../utils/date-range'

const shiftSelect = {
  id: true,
  name: true,
  code: true,
  branchId: true,
  startMinutes: true,
  endMinutes: true,
  graceMinutes: true,
  halfDayMinutes: true,
  isOvernight: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true } },
  _count: { select: { assignments: true } },
} as const

export const DEFAULT_SHIFTS = [
  { name: 'Morning', code: 'AM', startMinutes: 9 * 60, endMinutes: 18 * 60, graceMinutes: 10, sortOrder: 1 },
  { name: 'Evening', code: 'PM', startMinutes: 12 * 60, endMinutes: 21 * 60, graceMinutes: 10, sortOrder: 2 },
]

export async function ensureDefaultShifts(tenantId: string) {
  const count = await prisma.hrShift.count({ where: { tenantId } })
  if (count > 0) return
  await prisma.hrShift.createMany({
    data: DEFAULT_SHIFTS.map(s => ({
      tenantId,
      ...s,
      isOvernight: s.endMinutes < s.startMinutes,
    })),
    skipDuplicates: true,
  })
}

export const shiftsService = {
  async list(tenantId: string, branchId?: string) {
    await ensureDefaultShifts(tenantId)
    return prisma.hrShift.findMany({
      where: {
        tenantId,
        ...(branchId
          ? { OR: [{ branchId: null }, { branchId }] }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: shiftSelect,
    })
  },

  async create(tenantId: string, body: Record<string, unknown>, actorEmail?: string) {
    const name = String(body.name ?? '').trim()
    if (!name) throw new AppError('Shift name is required', 400)
    const startMinutes = Number(body.startMinutes)
    const endMinutes = Number(body.endMinutes)
    const check = validateShiftWindow(startMinutes, endMinutes, body.isOvernight === true)
    if (!check.ok) throw new AppError(check.reason ?? 'Invalid shift window', 400)

    if (body.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: String(body.branchId), tenantId, isActive: true },
      })
      if (!branch) throw new AppError('Invalid branch', 400)
    }

    try {
      const row = await prisma.hrShift.create({
        data: {
          tenantId,
          name,
          code: body.code ? String(body.code).trim() : null,
          branchId: body.branchId ? String(body.branchId) : null,
          startMinutes: check.isOvernight || startMinutes > endMinutes
            ? Math.floor(startMinutes)
            : Math.floor(startMinutes),
          endMinutes: Math.floor(endMinutes),
          graceMinutes: body.graceMinutes != null ? Number(body.graceMinutes) : 10,
          halfDayMinutes: body.halfDayMinutes != null ? Number(body.halfDayMinutes) : null,
          isOvernight: check.isOvernight,
          isActive: body.isActive !== false,
          sortOrder: Number(body.sortOrder) || 0,
        },
        select: shiftSelect,
      })
      void recordAuditEventSafe({
        tenantId,
        branchId: row.branchId,
        eventType: 'HR_SHIFT_CREATED',
        entityType: 'HrShift',
        entityId: row.id,
        actorEmail,
        afterJson: { name: row.name, startMinutes: row.startMinutes, endMinutes: row.endMinutes },
      })
      return row
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Shift name already exists', 409)
      throw e
    }
  },

  async update(tenantId: string, id: string, body: Record<string, unknown>, actorEmail?: string) {
    const existing = await prisma.hrShift.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Shift not found', 404)

    const data: Prisma.HrShiftUpdateInput = {}
    if (body.name != null) data.name = String(body.name).trim()
    if (body.code !== undefined) data.code = body.code ? String(body.code).trim() : null
    if (body.graceMinutes !== undefined) data.graceMinutes = Number(body.graceMinutes) || 0
    if (body.halfDayMinutes !== undefined) {
      data.halfDayMinutes = body.halfDayMinutes == null || body.halfDayMinutes === ''
        ? null
        : Number(body.halfDayMinutes)
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0

    if (body.branchId !== undefined) {
      if (body.branchId) {
        const branch = await prisma.branch.findFirst({
          where: { id: String(body.branchId), tenantId, isActive: true },
        })
        if (!branch) throw new AppError('Invalid branch', 400)
        data.branch = { connect: { id: String(body.branchId) } }
      } else {
        data.branch = { disconnect: true }
      }
    }

    if (body.startMinutes != null || body.endMinutes != null || body.isOvernight !== undefined) {
      const start = body.startMinutes != null ? Number(body.startMinutes) : existing.startMinutes
      const end = body.endMinutes != null ? Number(body.endMinutes) : existing.endMinutes
      const check = validateShiftWindow(start, end, body.isOvernight === true ? true : body.isOvernight === false ? false : existing.isOvernight)
      if (!check.ok) throw new AppError(check.reason ?? 'Invalid shift window', 400)
      data.startMinutes = Math.floor(start)
      data.endMinutes = Math.floor(end)
      data.isOvernight = check.isOvernight
    }

    try {
      const row = await prisma.hrShift.update({ where: { id }, data, select: shiftSelect })
      void recordAuditEventSafe({
        tenantId,
        branchId: row.branchId,
        eventType: 'HR_SHIFT_UPDATED',
        entityType: 'HrShift',
        entityId: id,
        actorEmail,
        afterJson: { name: row.name, isActive: row.isActive },
      })
      return row
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Shift name already exists', 409)
      throw e
    }
  },

  async assign(tenantId: string, body: {
    employeeId: string
    shiftId: string
    effectiveFrom?: string
    effectiveTo?: string | null
  }, actorEmail?: string) {
    const employee = await prisma.employee.findFirst({
      where: { id: body.employeeId, tenantId, isActive: true },
    })
    if (!employee) throw new AppError('Employee not found', 404)
    const shift = await prisma.hrShift.findFirst({
      where: { id: body.shiftId, tenantId, isActive: true },
    })
    if (!shift) throw new AppError('Shift not found', 404)

    const fromKey = normalizeBusinessDate(body.effectiveFrom)
    const from = businessDateDb(fromKey)
    const to = body.effectiveTo ? businessDateDb(normalizeBusinessDate(body.effectiveTo)) : null

    // Close previous open assignment
    await prisma.employeeShift.updateMany({
      where: {
        tenantId,
        employeeId: body.employeeId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      data: {
        effectiveTo: businessDateDb(
          // day before from
          (() => {
            const d = new Date(from)
            d.setUTCDate(d.getUTCDate() - 1)
            return d.toISOString().slice(0, 10)
          })(),
        ),
      },
    })

    const row = await prisma.employeeShift.create({
      data: {
        tenantId,
        employeeId: body.employeeId,
        shiftId: body.shiftId,
        effectiveFrom: from,
        effectiveTo: to,
      },
      include: {
        shift: { select: { id: true, name: true, startMinutes: true, endMinutes: true } },
        employee: { select: { id: true, fullName: true, employeeCode: true } },
      },
    })

    void recordAuditEventSafe({
      tenantId,
      branchId: employee.primaryBranchId,
      eventType: 'HR_SHIFT_ASSIGNED',
      entityType: 'EmployeeShift',
      entityId: row.id,
      actorEmail,
      afterJson: { employeeId: body.employeeId, shiftId: body.shiftId, effectiveFrom: fromKey },
    })
    return row
  },

  async listAssignments(tenantId: string, employeeId?: string) {
    return prisma.employeeShift.findMany({
      where: {
        tenantId,
        ...(employeeId ? { employeeId } : {}),
      },
      orderBy: { effectiveFrom: 'desc' },
      take: 200,
      include: {
        shift: { select: { id: true, name: true, startMinutes: true, endMinutes: true, graceMinutes: true } },
        employee: { select: { id: true, fullName: true, employeeCode: true, primaryBranchId: true } },
      },
    })
  },
}

export async function resolveEmployeeShiftForDate(
  tenantId: string,
  employeeId: string,
  businessDateKey: string,
) {
  const day = businessDateDb(businessDateKey)
  return prisma.employeeShift.findFirst({
    where: {
      tenantId,
      employeeId,
      effectiveFrom: { lte: day },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    include: { shift: true },
  })
}
