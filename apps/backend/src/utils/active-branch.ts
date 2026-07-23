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
      assignedBranchIds?: string[]
    }
  }
}

const OWNER_ROLES = new Set(['OWNER', 'PLATFORM_ADMIN'])

export function isOwnerRole(role: string | undefined): boolean {
  return !!role && OWNER_ROLES.has(role)
}

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

/**
 * Pick a default within the assigned pool only.
 * Empty assignedIds ⇒ no access (do not fall open to all tenant branches).
 */
export function pickDefaultBranchId(
  branches: BranchSummary[],
  assignedIds: string[],
  preferredId?: string | null,
): string | undefined {
  if (!assignedIds.length) return undefined

  const allowed = branches.filter(b => assignedIds.includes(b.id))
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
  req.assignedBranchIds = assignedIds
  const tenantBranches = await getTenantBranches(tenantId)

  if (!OWNER_ROLES.has(user.role) && assignedIds.length === 0) {
    throw new AppError('No branch assigned to your account. Ask an owner to assign a branch.', 403)
  }

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

/** Normalize query/header branch id; treat missing/"all" as unscoped. */
export function normalizeBranchId(id?: string | null): string | undefined {
  const trimmed = id?.trim()
  if (!trimmed || trimmed === 'all') return undefined
  return trimmed
}

/** Branch id for list/report queries: respects owner "all branches" scope. */
export function effectiveBranchId(req: Request): string | undefined {
  if (req.branchScope === 'all') {
    return normalizeBranchId(req.query.branchId as string | undefined)
  }
  return normalizeBranchId(req.query.branchId as string | undefined) || req.activeBranchId
}

/**
 * Record access: under a concrete active branch, only that branch's records.
 * Owner "All Branches" may access any tenant record. Without an active branch,
 * fall back to assignment membership.
 */
export function assertBranchRecordAccess(req: Request, recordBranchId?: string | null) {
  if (req.branchScope === 'all') return
  // Null branch records are only visible under All Branches (legacy / unscoped rows)
  if (!recordBranchId) {
    throw new AppError('Branch access denied', 403)
  }
  const active = effectiveBranchId(req)
  if (active) {
    if (recordBranchId === active) return
    throw new AppError('Branch access denied', 403)
  }
  if (req.assignedBranchIds?.includes(recordBranchId)) return
  throw new AppError('Branch access denied', 403)
}

/**
 * Resolve a concrete branch for creates/mutations.
 * Prefers body preferred → active branch header → assigned default.
 * Under Owner "All Branches", preferred (body) is required unless a default can be picked.
 * Always validates against the caller's assigned branches.
 */
export async function resolveMutationBranchId(
  req: Request,
  opts?: { preferred?: string | null },
): Promise<string> {
  const user = req.user
  const tenantId = req.tenantId
  if (!user || !tenantId) throw new AppError('Unauthorized', 401)

  const assignedIds =
    req.assignedBranchIds ?? (await getUserBranchIds(user.userId, tenantId, user.role))

  if (!OWNER_ROLES.has(user.role) && assignedIds.length === 0) {
    throw new AppError('No branch assigned to your account', 403)
  }

  const preferred = opts?.preferred ? String(opts.preferred).trim() : undefined
  const active = effectiveBranchId(req)
  const candidate = preferred || active

  if (candidate) {
    if (!assignedIds.includes(candidate)) {
      throw new AppError('Branch access denied', 403)
    }
    const branch = await prisma.branch.findFirst({
      where: { id: candidate, tenantId, isActive: true },
      select: { id: true },
    })
    if (!branch) throw new AppError('Branch not found', 404)
    return branch.id
  }

  if (req.branchScope === 'all') {
    throw new AppError('Select a branch before continuing', 400)
  }

  const tenantBranches = await getTenantBranches(tenantId)
  const fallback = pickDefaultBranchId(tenantBranches, assignedIds)
  if (!fallback) {
    throw new AppError('Select a branch before continuing', 400)
  }
  return fallback
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
