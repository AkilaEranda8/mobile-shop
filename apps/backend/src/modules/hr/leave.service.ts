import { LeaveDayPart, LeaveRequestStatus, Prisma } from '@prisma/client'
import { Request } from 'express'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { businessDateDb, businessDateFromInstant, normalizeBusinessDate } from '../../utils/date-range'
import { recordAuditEventSafe } from '../audit-engine/audit-engine.service'
import {
  balanceAfterApprove,
  balanceAfterCancelApproved,
  balanceAfterRejectOrCancelPending,
  balanceAfterSubmit,
  calculateLeaveResult,
  type LeaveRange,
} from '../hr-engine/hr-engine.leave'
import { assertBranchAccess, branchFilterForEmployees, resolveAllowedBranchIds } from './hr.util'

const typeSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  isPaid: true,
  requiresApproval: true,
  allowHalfDay: true,
  annualAllowance: true,
  maxDaysPerRequest: true,
  isActive: true,
  sortOrder: true,
} as const

export const DEFAULT_LEAVE_TYPES = [
  { name: 'Annual Leave', code: 'ANNUAL', annualAllowance: 14, isPaid: true, sortOrder: 1 },
  { name: 'Casual Leave', code: 'CASUAL', annualAllowance: 7, isPaid: true, sortOrder: 2 },
  { name: 'Sick Leave', code: 'SICK', annualAllowance: 7, isPaid: true, sortOrder: 3 },
  { name: 'Unpaid Leave', code: 'UNPAID', annualAllowance: 0, isPaid: false, sortOrder: 4 },
]

export async function ensureDefaultLeaveTypes(tenantId: string) {
  const count = await prisma.leaveType.count({ where: { tenantId } })
  if (count > 0) return
  await prisma.leaveType.createMany({
    data: DEFAULT_LEAVE_TYPES.map(t => ({ tenantId, ...t })),
    skipDuplicates: true,
  })
}

function yearOf(dateKey: string) {
  return Number(dateKey.slice(0, 4))
}

function toRange(row: {
  startDate: Date
  endDate: Date
  startPart: LeaveDayPart
  endPart: LeaveDayPart
}): LeaveRange {
  return {
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    startPart: row.startPart,
    endPart: row.endPart,
  }
}

async function resolveEmployee(tenantId: string, req: Request, employeeId?: string) {
  if (employeeId) {
    const emp = await prisma.employee.findFirst({ where: { id: employeeId, tenantId, isActive: true } })
    if (!emp) throw new AppError('Employee not found', 404)
    await assertBranchAccess(req, emp.primaryBranchId)
    return emp
  }
  const userId = req.user?.userId
  if (!userId) throw new AppError('Employee id required', 400)
  const emp = await prisma.employee.findFirst({ where: { tenantId, userId, isActive: true } })
  if (!emp) throw new AppError('No HR employee profile linked to your user', 404)
  return emp
}

async function ensureBalance(tenantId: string, employeeId: string, leaveTypeId: string, year: number, entitledDefault: number) {
  return prisma.leaveBalance.upsert({
    where: {
      tenantId_employeeId_leaveTypeId_year: { tenantId, employeeId, leaveTypeId, year },
    },
    create: {
      tenantId,
      employeeId,
      leaveTypeId,
      year,
      entitled: entitledDefault,
      used: 0,
      pending: 0,
    },
    update: {},
  })
}

export const leaveService = {
  async listTypes(tenantId: string) {
    await ensureDefaultLeaveTypes(tenantId)
    return prisma.leaveType.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: typeSelect,
    })
  },

  async createType(tenantId: string, body: Record<string, unknown>, actorEmail?: string) {
    const name = String(body.name ?? '').trim()
    if (!name) throw new AppError('Leave type name is required', 400)
    try {
      const row = await prisma.leaveType.create({
        data: {
          tenantId,
          name,
          code: body.code ? String(body.code).trim() : null,
          description: body.description ? String(body.description).trim() : null,
          isPaid: body.isPaid !== false,
          requiresApproval: body.requiresApproval !== false,
          allowHalfDay: body.allowHalfDay !== false,
          annualAllowance: body.annualAllowance != null ? Number(body.annualAllowance) : 14,
          maxDaysPerRequest: body.maxDaysPerRequest != null ? Number(body.maxDaysPerRequest) : null,
          isActive: body.isActive !== false,
          sortOrder: Number(body.sortOrder) || 0,
        },
        select: typeSelect,
      })
      void recordAuditEventSafe({
        tenantId,
        eventType: 'HR_LEAVE_TYPE_CREATED',
        entityType: 'LeaveType',
        entityId: row.id,
        actorEmail,
        afterJson: { name: row.name },
      })
      return row
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Leave type already exists', 409)
      throw e
    }
  },

  async updateType(tenantId: string, id: string, body: Record<string, unknown>, actorEmail?: string) {
    const existing = await prisma.leaveType.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Leave type not found', 404)
    const data: Prisma.LeaveTypeUpdateInput = {}
    if (body.name != null) data.name = String(body.name).trim()
    if (body.code !== undefined) data.code = body.code ? String(body.code).trim() : null
    if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null
    if (body.isPaid !== undefined) data.isPaid = Boolean(body.isPaid)
    if (body.requiresApproval !== undefined) data.requiresApproval = Boolean(body.requiresApproval)
    if (body.allowHalfDay !== undefined) data.allowHalfDay = Boolean(body.allowHalfDay)
    if (body.annualAllowance !== undefined) data.annualAllowance = Number(body.annualAllowance)
    if (body.maxDaysPerRequest !== undefined) {
      data.maxDaysPerRequest = body.maxDaysPerRequest == null || body.maxDaysPerRequest === ''
        ? null
        : Number(body.maxDaysPerRequest)
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0
    try {
      const row = await prisma.leaveType.update({ where: { id }, data, select: typeSelect })
      void recordAuditEventSafe({
        tenantId,
        eventType: 'HR_LEAVE_TYPE_UPDATED',
        entityType: 'LeaveType',
        entityId: id,
        actorEmail,
        afterJson: { name: row.name, isActive: row.isActive },
      })
      return row
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Leave type already exists', 409)
      throw e
    }
  },

  async listBalances(tenantId: string, req: Request) {
    await ensureDefaultLeaveTypes(tenantId)
    const year = Number(req.query.year) || yearOf(businessDateFromInstant())
    const employeeId = req.query.employeeId as string | undefined
    const role = req.user?.role
    const isManager = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN'

    if (employeeId) {
      const emp = await resolveEmployee(tenantId, req, employeeId)
      if (!isManager && emp.userId !== req.user?.userId) {
        throw new AppError('Forbidden', 403)
      }
      const types = await prisma.leaveType.findMany({ where: { tenantId, isActive: true } })
      for (const t of types) {
        await ensureBalance(tenantId, emp.id, t.id, year, t.annualAllowance)
      }
      return prisma.leaveBalance.findMany({
        where: { tenantId, year, employeeId: emp.id },
        include: {
          employee: { select: { id: true, fullName: true, employeeCode: true } },
          leaveType: { select: typeSelect },
        },
      })
    }

    if (!isManager) {
      const emp = await resolveEmployee(tenantId, req).catch(() => null)
      if (!emp) return []
      const types = await prisma.leaveType.findMany({ where: { tenantId, isActive: true } })
      for (const t of types) {
        await ensureBalance(tenantId, emp.id, t.id, year, t.annualAllowance)
      }
      return prisma.leaveBalance.findMany({
        where: { tenantId, year, employeeId: emp.id },
        include: {
          employee: { select: { id: true, fullName: true, employeeCode: true } },
          leaveType: { select: typeSelect },
        },
      })
    }

    const allowed = await resolveAllowedBranchIds(req)
    const branchWhere = branchFilterForEmployees(req, allowed)
    const employees = await prisma.employee.findMany({
      where: { tenantId, isActive: true, status: { in: ['ACTIVE', 'ON_LEAVE'] }, ...branchWhere },
      select: { id: true },
    })
    const types = await prisma.leaveType.findMany({ where: { tenantId, isActive: true } })
    for (const e of employees) {
      for (const t of types) {
        await ensureBalance(tenantId, e.id, t.id, year, t.annualAllowance)
      }
    }
    return prisma.leaveBalance.findMany({
      where: { tenantId, year, employeeId: { in: employees.map(e => e.id) } },
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
        leaveType: { select: typeSelect },
      },
      orderBy: [{ employee: { fullName: 'asc' } }],
    })
  },

  async listRequests(tenantId: string, req: Request) {
    const status = req.query.status as LeaveRequestStatus | undefined
    const employeeId = req.query.employeeId as string | undefined
    const allowed = await resolveAllowedBranchIds(req)
    const role = req.user?.role
    const isManager = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN'

    const and: Prisma.LeaveRequestWhereInput[] = [{ tenantId }]
    if (status) and.push({ status })
    if (!isManager) {
      const me = await resolveEmployee(tenantId, req)
      and.push({ employeeId: me.id })
    } else if (employeeId) {
      const emp = await resolveEmployee(tenantId, req, employeeId)
      and.push({ employeeId: emp.id })
    } else if (allowed?.length) {
      and.push({ branchId: { in: allowed } })
    }

    return prisma.leaveRequest.findMany({
      where: { AND: and },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
        leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
        branch: { select: { id: true, name: true } },
      },
    })
  },

  async submit(tenantId: string, req: Request, body: Record<string, unknown>, actorEmail?: string) {
    await ensureDefaultLeaveTypes(tenantId)
    const role = req.user?.role
    const isManager = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN'
    const emp = await resolveEmployee(
      tenantId,
      req,
      isManager ? (body.employeeId as string | undefined) : undefined,
    )
    if (!isManager && body.employeeId && String(body.employeeId) !== emp.id) {
      throw new AppError('You can only request leave for yourself', 403)
    }

    const leaveType = await prisma.leaveType.findFirst({
      where: { id: String(body.leaveTypeId), tenantId, isActive: true },
    })
    if (!leaveType) throw new AppError('Leave type not found', 404)

    const startDate = normalizeBusinessDate(String(body.startDate))
    const endDate = normalizeBusinessDate(String(body.endDate ?? body.startDate))
    const startPart = (body.startPart as LeaveDayPart) || 'FULL'
    const endPart = (body.endPart as LeaveDayPart) || startPart
    if (!leaveType.allowHalfDay && (startPart !== 'FULL' || endPart !== 'FULL')) {
      throw new AppError('Half-day leave is not allowed for this type', 400)
    }

    const year = yearOf(startDate)
    const balance = await ensureBalance(tenantId, emp.id, leaveType.id, year, leaveType.annualAllowance)

    const existingRows = await prisma.leaveRequest.findMany({
      where: {
        tenantId,
        employeeId: emp.id,
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
    })
    const calc = calculateLeaveResult({
      range: { startDate, endDate, startPart, endPart },
      balance: { entitled: balance.entitled, used: balance.used, pending: balance.pending },
      existing: existingRows.map(toRange),
      allowHalfDay: leaveType.allowHalfDay,
      maxDaysPerRequest: leaveType.maxDaysPerRequest,
      unlimited: leaveType.annualAllowance <= 0 && !leaveType.isPaid,
    })
    if (calc.errors.length) throw new AppError(calc.errors[0], 400)

    const nextBal = balanceAfterSubmit(
      { entitled: balance.entitled, used: balance.used, pending: balance.pending },
      calc.days,
    )

    const row = await prisma.$transaction(async (tx) => {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: nextBal.pending },
      })
      return tx.leaveRequest.create({
        data: {
          tenantId,
          employeeId: emp.id,
          leaveTypeId: leaveType.id,
          branchId: emp.primaryBranchId,
          status: 'SUBMITTED',
          startDate: businessDateDb(startDate),
          endDate: businessDateDb(endDate),
          startPart,
          endPart,
          days: calc.days,
          reason: body.reason ? String(body.reason).trim() : null,
          submittedAt: new Date(),
        },
        include: {
          employee: { select: { id: true, fullName: true, employeeCode: true } },
          leaveType: { select: { id: true, name: true, code: true } },
        },
      })
    })

    void recordAuditEventSafe({
      tenantId,
      branchId: emp.primaryBranchId,
      eventType: 'HR_LEAVE_REQUESTED',
      entityType: 'LeaveRequest',
      entityId: row.id,
      actorEmail,
      afterJson: { days: calc.days, leaveTypeId: leaveType.id, startDate, endDate },
    })
    return row
  },

  async approve(tenantId: string, id: string, req: Request, body: { reviewerNote?: string }, actorEmail?: string) {
    const row = await prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      include: { leaveType: true },
    })
    if (!row) throw new AppError('Leave request not found', 404)
    await assertBranchAccess(req, row.branchId)
    if (row.status !== 'SUBMITTED') throw new AppError('Only submitted requests can be approved', 400)

    const year = yearOf(row.startDate.toISOString().slice(0, 10))
    const balance = await ensureBalance(tenantId, row.employeeId, row.leaveTypeId, year, row.leaveType.annualAllowance)
    const next = balanceAfterApprove(
      { entitled: balance.entitled, used: balance.used, pending: balance.pending },
      row.days,
    )

    const updated = await prisma.$transaction(async (tx) => {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { used: next.used, pending: next.pending },
      })
      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewerNote: body.reviewerNote?.trim() || null,
          reviewedByEmail: actorEmail ?? null,
          reviewedAt: new Date(),
        },
        include: {
          employee: { select: { id: true, fullName: true, employeeCode: true } },
          leaveType: { select: { id: true, name: true } },
        },
      })
    })

    void recordAuditEventSafe({
      tenantId,
      branchId: row.branchId,
      eventType: 'HR_LEAVE_APPROVED',
      entityType: 'LeaveRequest',
      entityId: id,
      actorEmail,
      afterJson: { days: row.days },
    })
    return updated
  },

  async reject(tenantId: string, id: string, req: Request, body: { reviewerNote?: string }, actorEmail?: string) {
    const row = await prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      include: { leaveType: true },
    })
    if (!row) throw new AppError('Leave request not found', 404)
    await assertBranchAccess(req, row.branchId)
    if (row.status !== 'SUBMITTED') throw new AppError('Only submitted requests can be rejected', 400)

    const year = yearOf(row.startDate.toISOString().slice(0, 10))
    const balance = await ensureBalance(tenantId, row.employeeId, row.leaveTypeId, year, row.leaveType.annualAllowance)
    const next = balanceAfterRejectOrCancelPending(
      { entitled: balance.entitled, used: balance.used, pending: balance.pending },
      row.days,
    )

    const updated = await prisma.$transaction(async (tx) => {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: next.pending },
      })
      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewerNote: body.reviewerNote?.trim() || null,
          reviewedByEmail: actorEmail ?? null,
          reviewedAt: new Date(),
        },
        include: {
          employee: { select: { id: true, fullName: true, employeeCode: true } },
          leaveType: { select: { id: true, name: true } },
        },
      })
    })

    void recordAuditEventSafe({
      tenantId,
      branchId: row.branchId,
      eventType: 'HR_LEAVE_REJECTED',
      entityType: 'LeaveRequest',
      entityId: id,
      actorEmail,
      afterJson: { days: row.days },
    })
    return updated
  },

  async cancel(tenantId: string, id: string, req: Request, actorEmail?: string) {
    const row = await prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      include: { leaveType: true, employee: true },
    })
    if (!row) throw new AppError('Leave request not found', 404)
    await assertBranchAccess(req, row.branchId)

    const role = req.user?.role
    const isManager = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN'
    if (!isManager && row.employee.userId !== req.user?.userId) {
      throw new AppError('You can only cancel your own leave', 403)
    }
    if (row.status !== 'SUBMITTED' && row.status !== 'APPROVED') {
      throw new AppError('Only submitted or approved leave can be cancelled', 400)
    }

    const year = yearOf(row.startDate.toISOString().slice(0, 10))
    const balance = await ensureBalance(tenantId, row.employeeId, row.leaveTypeId, year, row.leaveType.annualAllowance)
    const snap = { entitled: balance.entitled, used: balance.used, pending: balance.pending }
    const next = row.status === 'APPROVED'
      ? balanceAfterCancelApproved(snap, row.days)
      : balanceAfterRejectOrCancelPending(snap, row.days)

    const updated = await prisma.$transaction(async (tx) => {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { used: next.used, pending: next.pending },
      })
      return tx.leaveRequest.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        include: {
          employee: { select: { id: true, fullName: true, employeeCode: true } },
          leaveType: { select: { id: true, name: true } },
        },
      })
    })

    void recordAuditEventSafe({
      tenantId,
      branchId: row.branchId,
      eventType: 'HR_LEAVE_CANCELLED',
      entityType: 'LeaveRequest',
      entityId: id,
      actorEmail,
      afterJson: { previousStatus: row.status, days: row.days },
    })
    return updated
  },
}
