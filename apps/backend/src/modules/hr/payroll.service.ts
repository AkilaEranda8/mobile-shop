import { createHash, randomUUID } from 'crypto'
import { PayrollRunStatus, Prisma } from '@prisma/client'
import { Request } from 'express'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { businessDateDb, businessDateFromInstant, normalizeBusinessDate } from '../../utils/date-range'
import { recordAuditEventSafe } from '../audit-engine/audit-engine.service'
import {
  createPayrollAccrual,
  payPayrollRun as accountingPayPayrollRun,
} from '../accounting/payroll/payroll.service'
import { calculateCompensationResult } from '../hr-engine/hr-engine.compensation'
import { calculateCommissionPreview } from '../hr-engine/hr-engine.compensation'
import { salaryService } from './salary.service'
import { ensureDefaultCommissionRules } from './commission.service'
import { assertBranchAccess, branchFilterForEmployees, resolveAllowedBranchIds } from './hr.util'
import { effectiveBranchId } from '../../utils/active-branch'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function isHrManager(req: Request) {
  const role = req.user?.role
  return role === 'OWNER' || role === 'MANAGER' || role === 'PLATFORM_ADMIN'
}

function isAccountingUnavailable(err: unknown) {
  const msg = String((err as any)?.message ?? '').toLowerCase()
  return msg.includes('not initialized') || msg.includes('accounting is not')
}

async function applyPayrollRecoveries(tenantId: string, runId: string, lines: Array<{ employeeId: string; code: string; amount: number }>) {
  const advRecLines = lines.filter(l => l.code === 'ADV_REC' && l.amount > 0)
  for (const line of advRecLines) {
    const advances = await prisma.employeeAdvance.findMany({
      where: { tenantId, employeeId: line.employeeId, status: 'DISBURSED' },
      orderBy: { createdAt: 'asc' },
    })
    let remaining = line.amount
    for (const adv of advances) {
      if (remaining <= 0) break
      const due = Math.max(0, adv.amount - adv.recoveredAmount)
      const take = Math.min(due, remaining)
      const recoveredAmount = round2(adv.recoveredAmount + take)
      await prisma.employeeAdvance.update({
        where: { id: adv.id },
        data: {
          recoveredAmount,
          status: recoveredAmount >= adv.amount - 1e-9 ? 'RECOVERED' : 'DISBURSED',
        },
      })
      remaining = round2(remaining - take)
    }
  }

  const loanLines = lines.filter(l => l.code === 'LOAN_REC' && l.amount > 0)
  for (const line of loanLines) {
    const installments = await prisma.loanInstallment.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIAL'] },
        loan: { tenantId, employeeId: line.employeeId, status: 'ACTIVE' },
      },
      orderBy: [{ dueDate: 'asc' }, { seq: 'asc' }],
    })
    let remaining = line.amount
    for (const inst of installments) {
      if (remaining <= 0) break
      const due = Math.max(0, inst.amount - inst.paidAmount)
      const take = Math.min(due, remaining)
      const paidAmount = round2(inst.paidAmount + take)
      await prisma.loanInstallment.update({
        where: { id: inst.id },
        data: {
          paidAmount,
          status: paidAmount >= inst.amount - 1e-9 ? 'PAID' : 'PARTIAL',
          payrollRunId: runId,
        },
      })
      await prisma.employeeLoan.update({
        where: { id: inst.loanId },
        data: { outstanding: { decrement: take } },
      })
      remaining = round2(remaining - take)
    }
    const loan = await prisma.employeeLoan.findFirst({
      where: { tenantId, employeeId: line.employeeId, status: 'ACTIVE' },
    })
    if (loan && loan.outstanding <= 0.01) {
      await prisma.employeeLoan.update({
        where: { id: loan.id },
        data: { status: 'CLOSED', outstanding: 0, closedAt: new Date() },
      })
    }
  }
}

async function attributedCommission(
  tenantId: string,
  userId: string,
  from: Date,
  to: Date,
) {
  await ensureDefaultCommissionRules(tenantId)
  const rules = await prisma.commissionRule.findMany({
    where: { tenantId, isActive: true },
    select: { source: true, ratePercent: true, flatPerUnit: true },
  })
  const docs: Array<{ source: 'SALES' | 'REPAIRS' | 'HIRE_PURCHASE'; amount: number }> = []
  const sales = await prisma.sale.findMany({
    where: { tenantId, cashierId: userId, createdAt: { gte: from, lte: to }, status: { in: ['PAID', 'PARTIAL'] } },
    select: { total: true },
  })
  for (const s of sales) docs.push({ source: 'SALES', amount: s.total })
  const repairs = await prisma.repairTicket.findMany({
    where: { tenantId, technicianId: userId, status: { in: ['DELIVERED', 'READY'] }, updatedAt: { gte: from, lte: to } },
    select: { actualCost: true, estimatedCost: true },
  })
  for (const r of repairs) docs.push({ source: 'REPAIRS', amount: r.actualCost ?? r.estimatedCost ?? 0 })
  const hp = await prisma.hirePurchaseAgreement.findMany({
    where: {
      tenantId,
      salesPersonId: userId,
      createdAt: { gte: from, lte: to },
      status: { not: 'CANCELLED' },
    },
    select: { cashPrice: true },
  })
  for (const a of hp) docs.push({ source: 'HIRE_PURCHASE', amount: a.cashPrice })
  return calculateCommissionPreview(docs, rules).total
}

export const payrollService = {
  async listPeriods(tenantId: string) {
    return prisma.payrollPeriod.findMany({
      where: { tenantId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { startDate: 'desc' }],
      include: { _count: { select: { runs: true } } },
    })
  },

  async createPeriod(tenantId: string, body: Record<string, unknown>, actorEmail?: string) {
    const startDate = normalizeBusinessDate(String(body.startDate ?? ''))
    const endDate = normalizeBusinessDate(String(body.endDate ?? startDate))
    const year = Number(body.year) || Number(startDate.slice(0, 4))
    const month = body.month != null ? Number(body.month) : Number(startDate.slice(5, 7))
    const label = String(body.label ?? '').trim() || `${year}-${String(month).padStart(2, '0')}`
    try {
      const row = await prisma.payrollPeriod.create({
        data: {
          tenantId,
          label,
          startDate: businessDateDb(startDate),
          endDate: businessDateDb(endDate),
          year,
          month,
        },
      })
      void recordAuditEventSafe({
        tenantId,
        eventType: 'HR_PAYROLL_PERIOD_CREATED',
        entityType: 'PayrollPeriod',
        entityId: row.id,
        actorEmail,
        afterJson: { label },
      })
      return row
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Period already exists', 409)
      throw e
    }
  },

  async listRuns(tenantId: string, req: Request) {
    const periodId = req.query.periodId as string | undefined
    return prisma.payrollRun.findMany({
      where: { tenantId, ...(periodId ? { periodId } : {}) },
      include: {
        period: { select: { id: true, label: true, startDate: true, endDate: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { lines: true, payslips: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  },

  async getRun(tenantId: string, id: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { id, tenantId },
      include: {
        period: true,
        branch: { select: { id: true, name: true } },
        lines: {
          include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
          orderBy: [{ employeeId: 'asc' }, { code: 'asc' }],
        },
        payslips: {
          include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
        },
      },
    })
    if (!run) throw new AppError('Payroll run not found', 404)
    return run
  },

  async createDraft(tenantId: string, req: Request, body: Record<string, unknown>, actorEmail?: string) {
    const periodId = String(body.periodId ?? '')
    const period = await prisma.payrollPeriod.findFirst({ where: { id: periodId, tenantId } })
    if (!period) throw new AppError('Period not found', 404)
    if (period.status !== 'OPEN') throw new AppError('Period is closed', 400)

    const branchId = body.branchId ? String(body.branchId) : undefined
    if (branchId) await assertBranchAccess(req, branchId)

    const open = await prisma.payrollRun.findFirst({
      where: {
        tenantId,
        periodId,
        branchId: branchId ?? null,
        status: { in: ['DRAFT', 'PROCESSING', 'REVIEW', 'APPROVED'] },
      },
    })
    if (open) throw new AppError('An open payroll run already exists for this period/branch', 409)

    const run = await prisma.payrollRun.create({
      data: {
        tenantId,
        periodId,
        branchId: branchId ?? null,
        status: 'DRAFT',
        note: body.note ? String(body.note) : null,
      },
      include: { period: true },
    })
    void recordAuditEventSafe({
      tenantId,
      branchId: branchId ?? undefined,
      eventType: 'HR_PAYROLL_DRAFT_CREATED',
      entityType: 'PayrollRun',
      entityId: run.id,
      actorEmail,
    })
    return run
  },

  async process(tenantId: string, id: string, req: Request, actorEmail?: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { id, tenantId },
      include: { period: true },
    })
    if (!run) throw new AppError('Payroll run not found', 404)
    if (run.status !== 'DRAFT' && run.status !== 'REVIEW' && run.status !== 'PROCESSING') {
      throw new AppError('Only DRAFT/REVIEW runs can be processed', 400)
    }

    const priorStatus = run.status === 'PROCESSING' ? 'DRAFT' : run.status
    await prisma.payrollRun.update({ where: { id }, data: { status: 'PROCESSING' } })

    try {
      return await this._processInner(tenantId, id, run, req, actorEmail)
    } catch (e) {
      await prisma.payrollRun.update({
        where: { id },
        data: { status: priorStatus as PayrollRunStatus, note: `Process failed: ${String((e as Error)?.message ?? e).slice(0, 200)}` },
      }).catch(() => undefined)
      throw e
    }
  },

  async _processInner(
    tenantId: string,
    id: string,
    run: { id: string; branchId: string | null; period: { startDate: Date; endDate: Date; label: string } },
    req: Request,
    actorEmail?: string,
  ) {
    const allowed = await resolveAllowedBranchIds(req)
    const branchWhere = branchFilterForEmployees(req, allowed)
    const employees = await prisma.employee.findMany({
      where: {
        tenantId,
        isActive: true,
        status: { in: ['ACTIVE', 'ON_LEAVE'] },
        ...(run.branchId ? { primaryBranchId: run.branchId } : branchWhere),
      },
      select: { id: true, fullName: true, employeeCode: true, userId: true, primaryBranchId: true },
    })

    const from = run.period.startDate
    const to = new Date(run.period.endDate)
    to.setUTCHours(23, 59, 59, 999)
    const asOf = run.period.endDate.toISOString().slice(0, 10)

    const allLines: Prisma.PayrollLineCreateManyInput[] = []
    const payslipRows: Array<{
      employeeId: string
      gross: number
      deductions: number
      net: number
      lines: unknown
    }> = []
    const hashes: string[] = []

    for (const emp of employees) {
      const pkg = await salaryService.getCurrentPackage(tenantId, emp.id, asOf)
      if (!pkg) continue

      const commissionAmount = emp.userId
        ? await attributedCommission(tenantId, emp.userId, from, to)
        : 0

      const advances = await prisma.employeeAdvance.findMany({
        where: { tenantId, employeeId: emp.id, status: 'DISBURSED' },
      })
      const advanceRecovery = round2(
        advances.reduce((s, a) => s + Math.max(0, a.amount - a.recoveredAmount), 0),
      )

      const dueInstallments = await prisma.loanInstallment.findMany({
        where: {
          status: { in: ['PENDING', 'PARTIAL'] },
          dueDate: { lte: run.period.endDate },
          loan: { tenantId, employeeId: emp.id, status: 'ACTIVE' },
        },
      })
      const loanRecovery = round2(
        dueInstallments.reduce((s, i) => s + Math.max(0, i.amount - i.paidAmount), 0),
      )

      const result = calculateCompensationResult({
        basicSalary: pkg.basicSalary,
        components: pkg.lines.map(l => ({
          code: l.component.code,
          label: l.component.name,
          kind: l.component.kind,
          calcType: l.component.calcType,
          amount: l.amount,
        })),
        commissionAmount,
        advanceRecovery,
        loanRecovery,
      })

      hashes.push(`${emp.id}:${result.deterministicHash}`)
      for (const line of result.lines) {
        allLines.push({
          runId: id,
          employeeId: emp.id,
          code: line.code,
          label: line.label,
          kind: line.kind,
          amount: line.amount,
          metaJson: { employeeCode: emp.employeeCode },
        })
      }
      payslipRows.push({
        employeeId: emp.id,
        gross: result.gross,
        deductions: result.deductions,
        net: result.net,
        lines: result.lines,
      })
    }

    const deterministicHash = createHash('sha256').update(hashes.sort().join('|')).digest('hex').slice(0, 24)

    await prisma.$transaction(async (tx) => {
      await tx.payrollLine.deleteMany({ where: { runId: id } })
      await tx.payslip.deleteMany({ where: { runId: id } })
      if (allLines.length) await tx.payrollLine.createMany({ data: allLines })
      if (payslipRows.length) {
        await tx.payslip.createMany({
          data: payslipRows.map(p => ({
            tenantId,
            runId: id,
            employeeId: p.employeeId,
            gross: p.gross,
            deductions: p.deductions,
            net: p.net,
            linesJson: p.lines as Prisma.InputJsonValue,
          })),
        })
      }
      await tx.payrollRun.update({
        where: { id },
        data: {
          status: 'REVIEW',
          processedAt: new Date(),
          deterministicHash,
          inputSnapshot: {
            employeeCount: employees.length,
            periodLabel: run.period.label,
            asOf,
          },
          resultSnapshot: {
            lineCount: allLines.length,
            payslipCount: payslipRows.length,
            totalNet: round2(payslipRows.reduce((s, p) => s + p.net, 0)),
          },
        },
      })
    })

    void recordAuditEventSafe({
      tenantId,
      branchId: run.branchId ?? undefined,
      eventType: 'HR_PAYROLL_PROCESSED',
      entityType: 'PayrollRun',
      entityId: id,
      actorEmail,
      afterJson: { deterministicHash, payslips: payslipRows.length },
    })

    return this.getRun(tenantId, id)
  },

  async approve(tenantId: string, id: string, _req: Request, _body: Record<string, unknown>, actorEmail?: string) {
    const run = await this.getRun(tenantId, id)
    if (run.status !== 'REVIEW') throw new AppError('Only REVIEW runs can be approved', 400)

    const byEmployee = new Map<string, { name: string; net: number; userId?: string }>()
    for (const slip of run.payslips) {
      byEmployee.set(slip.employeeId, {
        name: slip.employee.fullName,
        net: slip.net,
        userId: undefined,
      })
    }
    const empIds = [...byEmployee.keys()]
    const emps = await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, userId: true, fullName: true },
    })
    for (const e of emps) {
      const row = byEmployee.get(e.id)
      if (row) {
        row.userId = e.userId ?? undefined
        row.name = e.fullName
      }
    }

    const lines = [...byEmployee.values()]
      .filter(l => l.net > 0)
      .map(l => ({ employeeName: l.name, userId: l.userId, amount: l.net }))

    if (!lines.length) throw new AppError('No payable net amounts in this run', 400)

    // HR net already includes package deductions — never re-apply statutory on GL accrual.
    const accountingRunId = run.accountingRunId ?? randomUUID()
    try {
      const journal = await createPayrollAccrual(
        tenantId,
        {
          branchId: run.branchId ?? undefined,
          entryDate: businessDateFromInstant(),
          periodLabel: run.period.label,
          lines,
          applyStatutory: false,
        },
        actorEmail,
      )
      const postedRef = (journal as { sourceRefId?: string } | null)?.sourceRefId
      if (postedRef) {
        // Accrual uses its own runId — store that for pay matching
        await prisma.payrollRun.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedByEmail: actorEmail,
            accountingRunId: postedRef,
          },
        })
      } else {
        await prisma.payrollRun.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedByEmail: actorEmail,
            accountingRunId,
          },
        })
      }
    } catch (e: unknown) {
      if (isAccountingUnavailable(e)) {
        // Approve HR snapshot without GL; pay will require accounting.
        await prisma.payrollRun.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedByEmail: actorEmail,
            accountingRunId: null,
            note: 'Approved without GL — initialize accounting before pay',
          },
        })
      } else {
        throw e
      }
    }

    void recordAuditEventSafe({
      tenantId,
      branchId: run.branchId ?? undefined,
      eventType: 'HR_PAYROLL_APPROVED',
      entityType: 'PayrollRun',
      entityId: id,
      actorEmail,
      afterJson: { employeeCount: lines.length },
    })

    // Recoveries apply on pay (not approve) so cancel of APPROVED stays safe.
    return this.getRun(tenantId, id)
  },

  async pay(tenantId: string, id: string, req: Request, body: Record<string, unknown>, actorEmail?: string) {
    const run = await this.getRun(tenantId, id)
    if (run.status !== 'APPROVED') throw new AppError('Only APPROVED runs can be paid', 400)
    if (!run.accountingRunId) {
      throw new AppError('No GL accrual on this run — re-approve after accounting is ready', 400)
    }

    const branchId = String(body.branchId ?? run.branchId ?? effectiveBranchId(req) ?? '')
    if (!branchId) throw new AppError('branchId required for payment', 400)
    await assertBranchAccess(req, branchId)

    await accountingPayPayrollRun(
      tenantId,
      run.accountingRunId,
      {
        branchId,
        entryDate: normalizeBusinessDate(String(body.entryDate ?? businessDateFromInstant())),
        paymentMethod: (body.paymentMethod as any) || 'CASH',
        memo: body.memo ? String(body.memo) : undefined,
      },
      actorEmail,
    )

    await applyPayrollRecoveries(
      tenantId,
      id,
      run.lines.map(l => ({ employeeId: l.employeeId, code: l.code, amount: l.amount })),
    )

    const updated = await prisma.payrollRun.update({
      where: { id },
      data: {
        status: 'PAID' as PayrollRunStatus,
        paidAt: new Date(),
        paidByEmail: actorEmail,
      },
      include: { period: true },
    })

    void recordAuditEventSafe({
      tenantId,
      branchId,
      eventType: 'HR_PAYROLL_PAID',
      entityType: 'PayrollRun',
      entityId: id,
      actorEmail,
    })
    return updated
  },

  async cancel(tenantId: string, id: string, actorEmail?: string) {
    const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } })
    if (!run) throw new AppError('Payroll run not found', 404)
    if (run.status === 'PAID') throw new AppError('Paid runs cannot be cancelled', 400)
    if (run.status === 'CANCELLED') return run
    const updated = await prisma.payrollRun.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })
    void recordAuditEventSafe({
      tenantId,
      eventType: 'HR_PAYROLL_CANCELLED',
      entityType: 'PayrollRun',
      entityId: id,
      actorEmail,
    })
    return updated
  },

  async listPayslips(tenantId: string, req: Request) {
    const requestedId = req.query.employeeId as string | undefined
    const where: Prisma.PayslipWhereInput = {
      tenantId,
      run: { status: { in: ['APPROVED', 'PAID', 'REVIEW'] } },
    }

    if (!isHrManager(req)) {
      const me = await prisma.employee.findFirst({
        where: { tenantId, userId: req.user?.userId },
        select: { id: true },
      })
      if (!me) return []
      where.employeeId = me.id
    } else if (requestedId) {
      const emp = await prisma.employee.findFirst({ where: { id: requestedId, tenantId }, select: { primaryBranchId: true } })
      if (!emp) throw new AppError('Employee not found', 404)
      await assertBranchAccess(req, emp.primaryBranchId)
      where.employeeId = requestedId
    }

    return prisma.payslip.findMany({
      where,
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
        run: {
          select: {
            id: true,
            status: true,
            period: { select: { label: true, startDate: true, endDate: true } },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    })
  },
}
