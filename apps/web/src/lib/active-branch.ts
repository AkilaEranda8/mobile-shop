import { authStorage, type AuthUser, type BranchScope, type BranchSummary } from './auth'

export type { BranchScope, BranchSummary }

const LAST_BRANCH_PREFIX = 'hx_active_branch_'

function lastBranchKey(userId: string) {
  return `${LAST_BRANCH_PREFIX}${userId}`
}

export function pickBranchId(
  branches: BranchSummary[],
  assignedIds: string[],
  preferredId?: string | null,
): string | undefined {
  const pool = assignedIds.length
    ? branches.filter(b => assignedIds.includes(b.id) && b.isActive !== false)
    : branches.filter(b => b.isActive !== false)
  if (!pool.length) return undefined

  if (preferredId && pool.some(b => b.id === preferredId)) return preferredId

  const stored = typeof window !== 'undefined'
    ? localStorage.getItem(lastBranchKey(authStorage.getUser()?.id ?? ''))
    : null
  if (stored && pool.some(b => b.id === stored)) return stored

  const def = pool.find(b => b.isDefault)
  if (def) return def.id

  const firstAssigned = assignedIds.find(id => pool.some(b => b.id === id))
  if (firstAssigned) return firstAssigned

  const hq = pool.find(b => b.isHeadquarters)
  if (hq) return hq.id

  return pool[0]?.id
}

export function getBranchScope(): BranchScope {
  const user = authStorage.getUser()
  return user?.branchScope ?? 'single'
}

export function isAllBranchesScope(): boolean {
  return getBranchScope() === 'all'
}

/** Active branch for operations; undefined when owner scope is "all". */
export function getActiveBranchId(): string | undefined {
  const user = authStorage.getUser()
  if (!user) return undefined
  if (user.branchScope === 'all') return undefined
  if (user.activeBranchId) return user.activeBranchId
  if (user.branchIds?.[0]) return user.branchIds[0]
  return user.suggestedBranchId
}

/** Always returns a branch id for modules that require one (POS, sales create). */
export function requireActiveBranchId(): string {
  const id = getActiveBranchId()
  if (!id) throw new Error('No active branch')
  return id
}

export function setActiveBranchId(branchId: string, scope: BranchScope = 'assigned') {
  const user = authStorage.getUser()
  if (!user) return
  const allowed = user.branchIds ?? []
  if (scope !== 'all' && branchId !== 'all' && allowed.length && !allowed.includes(branchId)) return
  const next: AuthUser = {
    ...user,
    activeBranchId: scope === 'all' ? undefined : branchId,
    branchScope: scope,
  }
  localStorage.setItem('hx_user', JSON.stringify(next))
  if (scope !== 'all' && branchId) {
    localStorage.setItem(lastBranchKey(user.id), branchId)
  }
}

export function initializeSessionBranch(loginUser: AuthUser) {
  const branches = loginUser.branches ?? []
  const assigned = loginUser.branchIds ?? []
  const scope: BranchScope =
    loginUser.role === 'OWNER' && branches.length > 1 ? (loginUser.branchScope ?? 'assigned') : 'single'

  let activeId = loginUser.suggestedBranchId
    ?? pickBranchId(branches, assigned, loginUser.activeBranchId)

  if (!activeId && assigned[0]) activeId = assigned[0]

  const next: AuthUser = {
    ...loginUser,
    branchScope: scope === 'all' ? 'all' : (branches.length <= 1 ? 'single' : 'assigned'),
    activeBranchId: scope === 'all' ? undefined : activeId,
  }
  localStorage.setItem('hx_user', JSON.stringify(next))
  if (activeId) localStorage.setItem(lastBranchKey(loginUser.id), activeId)
  return next
}

export function getBranchLabel(branches: BranchSummary[], branchId?: string): string {
  if (!branchId) return 'All Branches'
  return branches.find(b => b.id === branchId)?.name ?? 'Branch'
}
