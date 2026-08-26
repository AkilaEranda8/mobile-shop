import { Prisma, SalaryComponentKind, SalaryCalcType } from '@prisma/client'
import { Request } from 'express'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { businessDateDb, normalizeBusinessDate } from '../../utils/date-range'
import { recordAuditEventSafe } from '../audit-engine/audit-engine.service'
import { calculateCompensationResult } from '../hr-engine/hr-engine.compensation'
import { assertBranchAccess, branchFilterForEmployees, resolveAllowedBranchIds } from './hr.util'

const componentSelect = {
  id: true,
  name: true,
  code: true,
  kind: true,
  calcType: true,
  defaultAmount: true,
  isTaxable: true,
  isStatutory: true,
  isActive: true,
  sortOrder: true,
} as const

export const DEFAULT_SALARY_COMPONENTS = [
  { name: 'Transport Allowance', code: 'TA', kind: 'EARNING' as const, defaultAmount: 0, sortOrder: 1 },
  { name: 'Meal Allowance', code: 'MEAL', kind: 'EARNING' as const, defaultAmount: 0, sortOrder: 2 },
  { name: 'EPF Employee', code: 'EPF_EE', kind: 'DEDUCTION' as const, calcType: 'PERCENT_OF_BASIC' as const, defaultAmount: 8, isStatutory: true, sortOrder: 10 },
]

export async function ensureDefaultSalaryComponents(tenantId: string) {
  const count = await prisma.salaryComponent.count({ where: { tenantId } })
  if (count > 0) return
  await prisma.salaryComponent.createMany({
    data: DEFAULT_SALARY_COMPONENTS.map(c => ({
      tenantId,
      name: c.name,
      code: c.code,
      kind: c.kind as SalaryComponentKind,
      calcType: (c.calcType ?? 'FIXED') as SalaryCalcType,
      defaultAmount: c.defaultAmount,
      isStatutory: c.isStatutory ?? false,
      sortOrder: c.sortOrder,
    })),
    skipDuplicates: true,
  })
}

export const salaryService = {
  async listComponents(tenantId: string) {
    await ensureDefaultSalaryComponents(tenantId)
    return prisma.salaryComponent.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: componentSelect,
    })
  },

  async createComponent(tenantId: string, body: Record<string, unknown>, actorEmail?: string) {
    const name = String(body.name ?? '').trim()
    const code = String(body.code ?? '').trim().toUpperCase()
    if (!name || !code) throw new AppError('Name and code required', 400)
    try {
      const row = await prisma.salaryComponent.create({
        data: {
          tenantId,
          name,
          code,
          kind: (body.kind as SalaryComponentKind) || 'EARNING',
          calcType: (body.calcType as SalaryCalcType) || 'FIXED',
          defaultAmount: Number(body.defaultAmount) || 0,
          isTaxable: body.isTaxable !== false,
          isStatutory: Boolean(body.isStatutory),
          isActive: body.isActive !== false,
          sortOrder: Number(body.sortOrder) || 0,
        },
        select: componentSelect,
      })
      void recordAuditEventSafe({
        tenantId,
        eventType: 'HR_SALARY_COMPONENT_CREATED',
        entityType: 'SalaryComponent',
        entityId: row.id,
        actorEmail,
        afterJson: { code: row.code },
      })
      return row
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Component already exists', 409)
      throw e
    }
  },

  async updateComponent(tenantId: string, id: string, body: Record<string, unknown>, actorEmail?: string) {
    const existing = await prisma.salaryComponent.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Component not found', 404)
    const data: Prisma.SalaryComponentUpdateInput = {}
    if (body.name != null) data.name = String(body.name).trim()
    if (body.code != null) data.code = String(body.code).trim().toUpperCase()
    if (body.kind != null) data.kind = body.kind as SalaryComponentKind
    if (body.calcType != null) data.calcType = body.calcType as SalaryCalcType
    if (body.defaultAmount != null) data.defaultAmount = Number(body.defaultAmount)
    if (body.isTaxable !== undefined) data.isTaxable = Boolean(body.isTaxable)
    if (body.isStatutory !== undefined) data.isStatutory = Boolean(body.isStatutory)
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0
    try {
      const row = await prisma.salaryComponent.update({ where: { id }, data, select: componentSelect })
      void recordAuditEventSafe({
        tenantId,
        eventType: 'HR_SALARY_COMPONENT_UPDATED',
        entityType: 'SalaryComponent',
        entityId: id,
        actorEmail,
        afterJson: { code: row.code, isActive: row.isActive },
      })
      return row
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('Component already exists', 409)
      throw e
    }
  },

  async listPackages(tenantId: string, req: Request) {
    const employeeId = req.query.employeeId as string | undefined
    const allowed = await resolveAllowedBranchIds(req)
    const branchWhere = branchFilterForEmployees(req, allowed)
    const where: Prisma.EmployeeSalaryWhereInput = { tenantId }
    if (employeeId) {
      const emp = await prisma.employee.findFirst({ where: { id: employeeId, tenantId }, select: { primaryBranchId: true } })
      if (!emp) throw new AppError('Employee not found', 404)
      await assertBranchAccess(req, emp.primaryBranchId)
      where.employeeId = employeeId
    } else {
      where.employee = { isActive: true, ...branchWhere }
    }
    return prisma.employeeSalary.findMany({
      where,
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true, primaryBranchId: true } },
        lines: { include: { component: { select: componentSelect } } },
      },
      orderBy: [{ effectiveFrom: 'desc' }],
      take: 200,
    })
  },

  async getCurrentPackage(tenantId: string, employeeId: string, asOf?: string) {
    const on = businessDateDb(normalizeBusinessDate(asOf))
    return prisma.employeeSalary.findFirst({
      where: {
        tenantId,
        employeeId,
        effectiveFrom: { lte: on },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: on } }],
      },
      include: {
        lines: { include: { component: { select: componentSelect } } },
      },
      orderBy: { effectiveFrom: 'desc' },
    })
  },

  async upsertPackage(tenantId: string, req: Request, body: Record<string, unknown>, actorEmail?: string) {
    const employeeId = String(body.employeeId ?? '')
    const emp = await prisma.employee.findFirst({ where: { id: employeeId, tenantId, isActive: true } })
    if (!emp) throw new AppError('Employee not found', 404)
    await assertBranchAccess(req, emp.primaryBranchId)

    const basicSalary = Number(body.basicSalary)
    if (!(basicSalary >= 0)) throw new AppError('basicSalary required', 400)
    const effectiveFrom = normalizeBusinessDate(String(body.effectiveFrom ?? ''))
    const lines = Array.isArray(body.lines) ? body.lines as Array<{ componentId: string; amount: number }> : []

    // Close previous open package
    const prev = await this.getCurrentPackage(tenantId, employeeId, effectiveFrom)
    if (prev && prev.effectiveFrom.toISOString().slice(0, 10) === effectiveFrom) {
      // replace same-day package
      await prisma.employeeSalaryLine.deleteMany({ where: { employeeSalaryId: prev.id } })
      await prisma.employeeSalary.delete({ where: { id: prev.id } })
    } else if (prev && !prev.effectiveTo) {
      const dayBefore = new Date(businessDateDb(effectiveFrom))
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1)
      await prisma.employeeSalary.update({
        where: { id: prev.id },
        data: { effectiveTo: dayBefore },
      })
    }

    const row = await prisma.employeeSalary.create({
      data: {
        tenantId,
        employeeId,
        effectiveFrom: businessDateDb(effectiveFrom),
        basicSalary,
        currency: String(body.currency ?? 'LKR'),
        note: body.note ? String(body.note) : null,
        lines: {
          create: lines
            .filter(l => l.componentId)
            .map(l => ({ componentId: l.componentId, amount: Number(l.amount) || 0 })),
        },
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
        lines: { include: { component: { select: componentSelect } } },
      },
    })

    void recordAuditEventSafe({
      tenantId,
      branchId: emp.primaryBranchId,
      eventType: 'HR_SALARY_CHANGED',
      entityType: 'EmployeeSalary',
      entityId: row.id,
      actorEmail,
      afterJson: { employeeId, basicSalary, effectiveFrom },
    })

    await prisma.employmentEvent.create({
      data: {
        tenantId,
        employeeId,
        branchId: emp.primaryBranchId,
        eventType: 'SALARY_CHANGED',
        actorEmail,
        afterJson: { basicSalary, effectiveFrom },
      },
    })

    return row
  },

  async previewPackage(tenantId: string, employeeId: string, req: Request, asOf?: string) {
    const emp = await prisma.employee.findFirst({ where: { id: employeeId, tenantId }, select: { primaryBranchId: true } })
    if (!emp) throw new AppError('Employee not found', 404)
    await assertBranchAccess(req, emp.primaryBranchId)
    const pkg = await this.getCurrentPackage(tenantId, employeeId, asOf)
    if (!pkg) throw new AppError('No salary package for employee', 404)
    return calculateCompensationResult({
      basicSalary: pkg.basicSalary,
      components: pkg.lines.map(l => ({
        code: l.component.code,
        label: l.component.name,
        kind: l.component.kind,
        calcType: l.component.calcType,
        amount: l.amount,
      })),
    })
  },
}
