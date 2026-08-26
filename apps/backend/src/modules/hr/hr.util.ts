import { Request } from 'express'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { effectiveBranchId } from '../../utils/active-branch'

export async function resolveAllowedBranchIds(req: Request): Promise<string[] | null> {
  const actor = req.user
  if (!actor || actor.role === 'OWNER' || actor.role === 'PLATFORM_ADMIN') return null
  const mine = await prisma.userBranch.findMany({
    where: { userId: actor.userId },
    select: { branchId: true },
  })
  return mine.map(b => b.branchId)
}

export async function assertBranchAccess(req: Request, branchId: string) {
  const allowed = await resolveAllowedBranchIds(req)
  if (allowed && !allowed.includes(branchId)) {
    throw new AppError('You cannot access employees for this branch', 403)
  }
}

export function branchFilterForEmployees(req: Request, allowedBranchIds: string[] | null) {
  const branchId = (req.query.branchId as string | undefined) || effectiveBranchId(req) || undefined
  if (branchId) return { primaryBranchId: branchId }
  if (allowedBranchIds?.length) return { primaryBranchId: { in: allowedBranchIds } }
  return {}
}

export async function nextEmployeeCode(tenantId: string): Promise<string> {
  const last = await prisma.employee.findFirst({
    where: { tenantId, employeeCode: { startsWith: 'EMP-' } },
    orderBy: { employeeCode: 'desc' },
    select: { employeeCode: true },
  })
  const n = last?.employeeCode?.match(/^EMP-(\d+)$/)?.[1]
  const seq = n ? Number(n) + 1 : 1
  return `EMP-${String(seq).padStart(4, '0')}`
}

export const DEFAULT_DEPARTMENTS = [
  { name: 'Sales', code: 'SALES', sortOrder: 1 },
  { name: 'Cashier', code: 'CASHIER', sortOrder: 2 },
  { name: 'Repairs', code: 'REPAIRS', sortOrder: 3 },
  { name: 'Inventory', code: 'INVENTORY', sortOrder: 4 },
  { name: 'Purchasing', code: 'PURCH', sortOrder: 5 },
  { name: 'Management', code: 'MGMT', sortOrder: 6 },
  { name: 'Administration', code: 'ADMIN', sortOrder: 7 },
]

export const DEFAULT_DESIGNATIONS = [
  { name: 'Owner', code: 'OWNER', sortOrder: 1 },
  { name: 'Manager', code: 'MANAGER', sortOrder: 2 },
  { name: 'Cashier', code: 'CASHIER', sortOrder: 3 },
  { name: 'Salesperson', code: 'SALES', sortOrder: 4 },
  { name: 'Technician', code: 'TECH', sortOrder: 5 },
  { name: 'Storekeeper', code: 'STORE', sortOrder: 6 },
  { name: 'Accountant', code: 'ACCT', sortOrder: 7 },
]

export async function ensureHrDefaults(tenantId: string) {
  const [deptCount, desigCount] = await Promise.all([
    prisma.hrDepartment.count({ where: { tenantId } }),
    prisma.hrDesignation.count({ where: { tenantId } }),
  ])
  if (deptCount === 0) {
    await prisma.hrDepartment.createMany({
      data: DEFAULT_DEPARTMENTS.map(d => ({ tenantId, ...d })),
      skipDuplicates: true,
    })
  }
  if (desigCount === 0) {
    await prisma.hrDesignation.createMany({
      data: DEFAULT_DESIGNATIONS.map(d => ({ tenantId, ...d })),
      skipDuplicates: true,
    })
  }
}
