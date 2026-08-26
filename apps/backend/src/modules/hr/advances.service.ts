import { Request } from 'express'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { businessDateDb, normalizeBusinessDate } from '../../utils/date-range'
import { recordAuditEventSafe } from '../audit-engine/audit-engine.service'
import { assertBranchAccess, branchFilterForEmployees, resolveAllowedBranchIds } from './hr.util'

function round2(n: number) {
  return Math.round(n * 100) / 100
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

export const advancesService = {
  async listAdvances(tenantId: string, req: Request) {
    const status = req.query.status as string | undefined
    const role = req.user?.role
    const isManager = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN'
    const allowed = await resolveAllowedBranchIds(req)
    const branchWhere = branchFilterForEmployees(req, allowed)

    if (!isManager) {
      const me = await resolveEmployee(tenantId, req)
      return prisma.employeeAdvance.findMany({
        where: { tenantId, employeeId: me.id, ...(status ? { status: status as any } : {}) },
        include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
    }

    return prisma.employeeAdvance.findMany({
      where: {
        tenantId,
        ...(status ? { status: status as any } : {}),
        employee: branchWhere,
      },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  },

  async requestAdvance(tenantId: string, req: Request, body: Record<string, unknown>, actorEmail?: string) {
    const role = req.user?.role
    const isManager = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN'
    const requestedId = body.employeeId ? String(body.employeeId) : undefined
    if (!isManager && requestedId) {
      const me = await resolveEmployee(tenantId, req)
      if (me.id !== requestedId) throw new AppError('You can only request advances for yourself', 403)
    }
    const emp = await resolveEmployee(tenantId, req, isManager ? requestedId : undefined)
    const amount = Number(body.amount)
    if (!(amount > 0)) throw new AppError('amount must be > 0', 400)
    const row = await prisma.employeeAdvance.create({
      data: {
        tenantId,
        employeeId: emp.id,
        branchId: emp.primaryBranchId,
        amount,
        reason: body.reason ? String(body.reason) : null,
        status: 'REQUESTED',
      },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
    })
    void recordAuditEventSafe({
      tenantId,
      branchId: emp.primaryBranchId,
      eventType: 'HR_ADVANCE_REQUESTED',
      entityType: 'EmployeeAdvance',
      entityId: row.id,
      actorEmail,
      afterJson: { amount },
    })
    return row
  },

  async reviewAdvance(
    tenantId: string,
    id: string,
    action: 'approve' | 'reject' | 'disburse' | 'cancel',
    body: Record<string, unknown>,
    actorEmail?: string,
    req?: Request,
  ) {
    const row = await prisma.employeeAdvance.findFirst({ where: { id, tenantId } })
    if (!row) throw new AppError('Advance not found', 404)
    if (row.branchId && req) await assertBranchAccess(req, row.branchId)

    let status = row.status
    const data: Record<string, unknown> = {
      reviewerNote: body.reviewerNote != null ? String(body.reviewerNote) : row.reviewerNote,
      reviewedByEmail: actorEmail,
      reviewedAt: new Date(),
    }

    if (action === 'approve') {
      if (row.status !== 'REQUESTED') throw new AppError('Only REQUESTED advances can be approved', 400)
      status = 'APPROVED'
    } else if (action === 'reject') {
      if (row.status !== 'REQUESTED') throw new AppError('Only REQUESTED advances can be rejected', 400)
      status = 'REJECTED'
    } else if (action === 'disburse') {
      if (row.status !== 'APPROVED') throw new AppError('Only APPROVED advances can be disbursed', 400)
      status = 'DISBURSED'
      data.disbursedAt = new Date()
    } else if (action === 'cancel') {
      if (row.status === 'RECOVERED' || row.status === 'DISBURSED') {
        throw new AppError('Cannot cancel recovered/disbursed advance', 400)
      }
      status = 'CANCELLED'
    }
    data.status = status

    const updated = await prisma.employeeAdvance.update({
      where: { id },
      data: data as any,
      include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
    })
    void recordAuditEventSafe({
      tenantId,
      eventType: `HR_ADVANCE_${action.toUpperCase()}`,
      entityType: 'EmployeeAdvance',
      entityId: id,
      actorEmail,
      afterJson: { status },
    })
    return updated
  },

  async listLoans(tenantId: string, req: Request) {
    const status = req.query.status as string | undefined
    const role = req.user?.role
    const isManager = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN'
    const allowed = await resolveAllowedBranchIds(req)
    const branchWhere = branchFilterForEmployees(req, allowed)

    if (!isManager) {
      const me = await resolveEmployee(tenantId, req)
      return prisma.employeeLoan.findMany({
        where: { tenantId, employeeId: me.id, ...(status ? { status: status as any } : {}) },
        include: {
          employee: { select: { id: true, fullName: true, employeeCode: true } },
          installments: { orderBy: { seq: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    }

    return prisma.employeeLoan.findMany({
      where: {
        tenantId,
        ...(status ? { status: status as any } : {}),
        employee: branchWhere,
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
        installments: { orderBy: { seq: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  },

  async requestLoan(tenantId: string, req: Request, body: Record<string, unknown>, actorEmail?: string) {
    const role = req.user?.role
    const isManager = role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN'
    const requestedId = body.employeeId ? String(body.employeeId) : undefined
    if (!isManager && requestedId) {
      const me = await resolveEmployee(tenantId, req)
      if (me.id !== requestedId) throw new AppError('You can only request loans for yourself', 403)
    }
    const emp = await resolveEmployee(tenantId, req, isManager ? requestedId : undefined)
    const principal = Number(body.principal)
    const installmentCount = Math.max(1, Number(body.installmentCount) || 1)
    if (!(principal > 0)) throw new AppError('principal must be > 0', 400)
    const interestRate = Number(body.interestRate) || 0
    const total = round2(principal * (1 + interestRate / 100))
    const installmentAmount = round2(total / installmentCount)

    const row = await prisma.employeeLoan.create({
      data: {
        tenantId,
        employeeId: emp.id,
        branchId: emp.primaryBranchId,
        principal,
        interestRate,
        installmentCount,
        installmentAmount,
        outstanding: total,
        reason: body.reason ? String(body.reason) : null,
        status: 'REQUESTED',
      },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
    })
    void recordAuditEventSafe({
      tenantId,
      branchId: emp.primaryBranchId,
      eventType: 'HR_LOAN_REQUESTED',
      entityType: 'EmployeeLoan',
      entityId: row.id,
      actorEmail,
      afterJson: { principal, installmentCount },
    })
    return row
  },

  async reviewLoan(
    tenantId: string,
    id: string,
    action: 'approve' | 'reject' | 'activate' | 'cancel',
    body: Record<string, unknown>,
    actorEmail?: string,
    req?: Request,
  ) {
    const row = await prisma.employeeLoan.findFirst({ where: { id, tenantId } })
    if (!row) throw new AppError('Loan not found', 404)
    if (row.branchId && req) await assertBranchAccess(req, row.branchId)

    if (action === 'reject') {
      if (row.status !== 'REQUESTED') throw new AppError('Only REQUESTED loans can be rejected', 400)
      return prisma.employeeLoan.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewerNote: body.reviewerNote != null ? String(body.reviewerNote) : null,
          reviewedByEmail: actorEmail,
          reviewedAt: new Date(),
        },
      })
    }

    if (action === 'cancel') {
      if (row.status === 'ACTIVE' || row.status === 'CLOSED') throw new AppError('Cannot cancel active/closed loan', 400)
      return prisma.employeeLoan.update({ where: { id }, data: { status: 'CANCELLED' } })
    }

    if (action === 'approve') {
      if (row.status !== 'REQUESTED') throw new AppError('Only REQUESTED loans can be approved', 400)
      const updated = await prisma.employeeLoan.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewerNote: body.reviewerNote != null ? String(body.reviewerNote) : null,
          reviewedByEmail: actorEmail,
          reviewedAt: new Date(),
        },
      })
      void recordAuditEventSafe({
        tenantId,
        eventType: 'HR_LOAN_APPROVED',
        entityType: 'EmployeeLoan',
        entityId: id,
        actorEmail,
      })
      return updated
    }

    // activate — create installments (APPROVED only)
    if (row.status !== 'APPROVED') {
      throw new AppError('Only APPROVED loans can be activated', 400)
    }
    const startKey = normalizeBusinessDate(String(body.firstDueDate ?? ''))
    const installments: Array<{ loanId: string; seq: number; dueDate: Date; amount: number }> = []
    for (let i = 0; i < row.installmentCount; i++) {
      const d = new Date(businessDateDb(startKey))
      d.setUTCMonth(d.getUTCMonth() + i)
      installments.push({
        loanId: id,
        seq: i + 1,
        dueDate: d,
        amount: row.installmentAmount,
      })
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.loanInstallment.deleteMany({ where: { loanId: id } })
      await tx.loanInstallment.createMany({ data: installments })
      return tx.employeeLoan.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          reviewedByEmail: actorEmail,
          reviewedAt: new Date(),
        },
        include: { installments: { orderBy: { seq: 'asc' } }, employee: { select: { id: true, fullName: true, employeeCode: true } } },
      })
    })
    void recordAuditEventSafe({
      tenantId,
      eventType: 'HR_LOAN_ACTIVATED',
      entityType: 'EmployeeLoan',
      entityId: id,
      actorEmail,
      afterJson: { installmentCount: row.installmentCount },
    })
    return updated
  },
}
