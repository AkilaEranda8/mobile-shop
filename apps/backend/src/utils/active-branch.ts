import { Request } from 'express'
import { prisma } from '../config/database'
import { AppError } from '../middleware/error.middleware'

export type BranchScope = 'all' | 'assigned' | 'single'

export interface BranchSummary {
  id: string
  name: string
  city: string
  isHeadquarters: boolean
  isDefault: boolean
  isActive: boolean
}

declare global {
  namespace Express {
    interface Request {
      activeBranchId?: string
      branchScope?: BranchScope
    }
  }
}

const OWNER_ROLES = new Set(['OWNER', 'PLATFORM_ADMIN'])

export async function getUserBranchIds(userId: string, tenantId: string, role: string): Promise<string[]> {
  if (OWNER_ROLES.has(role)) {
    const branches = await prisma.branch.findMany({
      where: { tenantId, isActive: true },
      select: { id: true },
      orderBy: [{ isDefault: 'desc' }, { isHeadquarters: 'desc' }, { createdAt: 'asc' }],
    })
    return branches.map(b => b.id)
  }
  const links = await prisma.userBranch.findMany({
    where: { userId },
    select: { branchId: true },
  })
  return links.map(l => l.branchId)
}

export async function getTenantBranches(tenantId: string): Promise<BranchSummary[]> {
  return prisma.branch.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true, city: true, isHeadquarters: true, isDefault: true, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { isHeadquarters: 'desc' }, { name: 'asc' }],
  })
}

export function pickDefaultBranchId(
  branches: BranchSummary[],
  assignedIds: string[],
  preferredId?: string | null,
): string | undefined {
  const allowed = assignedIds.length
    ? branches.filter(b => assignedIds.includes(b.id))
    : branches
  if (!allowed.length) return undefined

  if (preferredId && allowed.some(b => b.id === preferredId)) return preferredId

  const def = allowed.find(b => b.isDefault)
  if (def) return def.id

  const firstAssigned = assignedIds.find(id => allowed.some(b => b.id === id))
  if (firstAssigned) return firstAssigned

  const hq = allowed.find(b => b.isHeadquarters)
  if (hq) return hq.id

  return allowed[0]?.id
}

/** Validate explicit branch id; returns undefined when scope is "all" (no single branch). */
export async function resolveActiveBranch(
  req: Request,
  options?: { required?: boolean; allowAll?: boolean },
): Promise<string | undefined> {
  const user = req.user
  const tenantId = req.tenantId
  if (!user || !tenantId) {
    if (options?.required) throw new AppError('Unauthorized', 401)
    return undefined
  }

  const headerBranch = (req.headers['x-active-branch-id'] as string | undefined)?.trim()
  const queryBranch = (req.query.branchId as string | undefined)?.trim()
  const explicit = headerBranch || queryBranch
  const scopeHeader = (req.headers['x-branch-scope'] as string | undefined)?.trim() as BranchScope | undefined

  const assignedIds = await getUserBranchIds(user.userId, tenantId, user.role)
  const tenantBranches = await getTenantBranches(tenantId)

  if (scopeHeader === 'all' && OWNER_ROLES.has(user.role)) {
    req.branchScope = 'all'
    req.activeBranchId = undefined
    if (options?.allowAll) return undefined
    if (!explicit) return undefined
  }

  if (explicit === 'all' && OWNER_ROLES.has(user.role) && options?.allowAll) {
    req.branchScope = 'all'
    return undefined
  }

  const allowedSet = new Set(assignedIds)
  let branchId = explicit

  if (branchId && !allowedSet.has(branchId)) {
    throw new AppError('Branch access denied', 403)
  }

  if (!branchId) {
    branchId = pickDefaultBranchId(tenantBranches, assignedIds)
  }

  if (!branchId && options?.required) {
    throw new AppError('No branch available', 400)
  }

  if (branchId) {
    req.activeBranchId = branchId
    req.branchScope = assignedIds.length <= 1 ? 'single' : 'assigned'
  }

  return branchId
}

/** Branch id for list/report queries: respects owner "all branches" scope. */
export function effectiveBranchId(req: Request): string | undefined {
  if (req.branchScope === 'all') {
    const q = (req.query.branchId as string | undefined)?.trim()
    return q || undefined
  }
  const q = (req.query.branchId as string | undefined)?.trim()
  return q || req.activeBranchId
}

export function assertBranchRecordAccess(req: Request, recordBranchId?: string | null) {
  if (!recordBranchId || req.branchScope === 'all') return
  const allowed = effectiveBranchId(req)
  if (allowed && recordBranchId !== allowed) {
    throw new AppError('Branch access denied', 403)
  }
}

export async function resolveOperationalBranchId(
  tenantId: string,
  role: string,
  explicitBranchId?: string,
): Promise<string> {
  const branches = await getTenantBranches(tenantId)
  if (!branches.length) throw new AppError('No branch found for tenant', 400)

  if (explicitBranchId) {
    const match = branches.find(b => b.id === explicitBranchId)
    if (match) return match.id
  }

  const def = branches.find(b => b.isDefault)
  if (def) return def.id

  const hq = branches.find(b => b.isHeadquarters)
  if (hq) return hq.id

  return branches[0].id
}
