import { CommissionSource, Prisma } from '@prisma/client'
import { Request } from 'express'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { normalizeBusinessDate } from '../../utils/date-range'
import { recordAuditEventSafe } from '../audit-engine/audit-engine.service'
import {
  calculateCommissionPreview,
  type CommissionDoc,
} from '../hr-engine/hr-engine.compensation'
import { resolveAllowedBranchIds, branchFilterForEmployees } from './hr.util'

const ruleSelect = {
  id: true,
  name: true,
  code: true,
  source: true,
  ratePercent: true,
  flatPerUnit: true,
  isActive: true,
  sortOrder: true,
} as const

export const DEFAULT_COMMISSION_RULES = [
  { name: 'POS sales incentive', code: 'SALES', source: 'SALES' as const, ratePercent: 0.5, sortOrder: 1 },
  { name: 'Repair technician incentive', code: 'REPAIR', source: 'REPAIRS' as const, ratePercent: 2, sortOrder: 2 },
  { name: 'Van / wholesale rep incentive', code: 'VAN', source: 'WHOLESALE_VAN' as const, ratePercent: 1, sortOrder: 3 },
]

export async function ensureDefaultCommissionRules(tenantId: string) {
  const count = await prisma.commissionRule.count({ where: { tenantId } })
  if (count === 0) {
    await prisma.commissionRule.createMany({
      data: DEFAULT_COMMISSION_RULES.map(r => ({ tenantId, ...r })),
      skipDuplicates: true,
    })
    return
  }
  // Tenants that already had SALES/REPAIRS rules still need the van rule
  const van = await prisma.commissionRule.findFirst({
    where: { tenantId, source: 'WHOLESALE_VAN' },
    select: { id: true },
  })
  if (!van) {
    try {
      await prisma.commissionRule.create({
        data: {
          tenantId,
          name: 'Van / wholesale rep incentive',
          code: 'VAN',
          source: 'WHOLESALE_VAN',
          ratePercent: 1,
          sortOrder: 3,
        },
      })
    } catch {
      // name unique conflict — ignore
    }
  }
}

async function attributedDocs(
  tenantId: string,
  userId: string,
  from: Date,
  to: Date,
): Promise<CommissionDoc[]> {
  const docs: CommissionDoc[] = []

  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      cashierId: userId,
      createdAt: { gte: from, lte: to },
      status: { in: ['PAID', 'PARTIAL'] },
    },
    select: { total: true },
  })
  for (const s of sales) docs.push({ source: 'SALES', amount: s.total })

  const repairs = await prisma.repairTicket.findMany({
    where: {
      tenantId,
      technicianId: userId,
      status: { in: ['DELIVERED', 'READY'] },
      updatedAt: { gte: from, lte: to },
    },
    select: { actualCost: true, estimatedCost: true },
  })
  for (const r of repairs) {
    docs.push({ source: 'REPAIRS', amount: r.actualCost ?? r.estimatedCost ?? 0 })
  }

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

  const vanInvoices = await prisma.wholesaleInvoice.findMany({
    where: {
      tenantId,
      salesRepId: userId,
      channel: 'VAN',
      createdAt: { gte: from, lte: to },
      status: { in: ['POSTED', 'PARTIAL', 'PAID'] },
    },
    select: { total: true },
  })
  for (const inv of vanInvoices) docs.push({ source: 'WHOLESALE_VAN', amount: inv.total })

  return docs
}

export const commissionService = {
  async listRules(tenantId: string) {
    await ensureDefaultCommissionRules(tenantId)
    return prisma.commissionRule.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: ruleSelect,
    })
  },

  async createRule(tenantId: string, body: Record<string, unknown>, actorEmail?: string) {
    const name = String(body.name ?? '').trim()
    if (!name) throw new AppError('Name required', 400)
    const source = body.source as CommissionSource
    if (!source) throw new AppError('source required', 400)
    try {
      const row = await prisma.commissionRule.create({
        data: {
          tenantId,
          name,
          code: body.code ? String(body.code).trim() : null,
          source,
          ratePercent: Number(body.ratePercent) || 0,
          flatPerUnit: Number(body.flatPerUnit) || 0,
          isActive: body.isActive !== false,
          sortOrder: Number(body.sortOrder) || 0,
        },
        select: ruleSelect,
      })
      void recordAuditEventSafe({
        tenantId,
        eventType: 'HR_COMMISSION_RULE_CREATED',
        entityType: 'CommissionRule',
        entityId: row.id,
        actorEmail,
        afterJson: { name: row.name, source: row.source },
      })
      return row
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Rule already exists', 409)
      throw e
    }
  },

  async updateRule(tenantId: string, id: string, body: Record<string, unknown>, actorEmail?: string) {
    const existing = await prisma.commissionRule.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Rule not found', 404)
    const data: Prisma.CommissionRuleUpdateInput = {}
    if (body.name != null) data.name = String(body.name).trim()
    if (body.code !== undefined) data.code = body.code ? String(body.code).trim() : null
    if (body.source != null) data.source = body.source as CommissionSource
    if (body.ratePercent != null) data.ratePercent = Number(body.ratePercent)
    if (body.flatPerUnit != null) data.flatPerUnit = Number(body.flatPerUnit)
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0
    const row = await prisma.commissionRule.update({ where: { id }, data, select: ruleSelect })
    void recordAuditEventSafe({
      tenantId,
      eventType: 'HR_COMMISSION_RULE_UPDATED',
      entityType: 'CommissionRule',
      entityId: id,
      actorEmail,
      afterJson: { name: row.name, isActive: row.isActive },
    })
    return row
  },

  async preview(tenantId: string, req: Request) {
    await ensureDefaultCommissionRules(tenantId)
    const fromKey = normalizeBusinessDate(String(req.query.from ?? ''))
    const toKey = normalizeBusinessDate(String(req.query.to ?? ''))
    const from = new Date(`${fromKey}T00:00:00.000Z`)
    const to = new Date(`${toKey}T23:59:59.999Z`)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new AppError('from and to dates required (YYYY-MM-DD)', 400)
    }

    const employeeId = req.query.employeeId as string | undefined
    const allowed = await resolveAllowedBranchIds(req)
    const branchWhere = branchFilterForEmployees(req, allowed)

    const employees = await prisma.employee.findMany({
      where: {
        tenantId,
        isActive: true,
        status: { in: ['ACTIVE', 'ON_LEAVE'] },
        userId: { not: null },
        ...(employeeId ? { id: employeeId } : {}),
        ...branchWhere,
      },
      select: { id: true, fullName: true, employeeCode: true, userId: true },
      take: 200,
    })

    const rules = await prisma.commissionRule.findMany({
      where: { tenantId, isActive: true },
      select: { source: true, ratePercent: true, flatPerUnit: true },
    })

    const rows = []
    for (const emp of employees) {
      if (!emp.userId) continue
      const docs = await attributedDocs(tenantId, emp.userId, from, to)
      const preview = calculateCommissionPreview(docs, rules)
      rows.push({
        employee: { id: emp.id, fullName: emp.fullName, employeeCode: emp.employeeCode },
        docCount: docs.length,
        ...preview,
      })
    }

    return {
      from: fromKey,
      to: toKey,
      rows: rows.sort((a, b) => b.total - a.total),
      grandTotal: rows.reduce((s, r) => s + r.total, 0),
    }
  },
}
