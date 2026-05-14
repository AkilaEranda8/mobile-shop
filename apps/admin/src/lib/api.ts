/**
 * Hexalyte Admin API client — real data only, no mock fallbacks
 */

const ADMIN_BASE = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3001/admin/v1'
const API_BASE   = process.env.NEXT_PUBLIC_API_URL       || 'http://localhost:3001/api/v1'

// ─── Token storage ────────────────────────────────────────────────────────────
const TOKEN_KEY = 'admin_token'

export const adminAuth = {
  getToken: () => (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null),
  setToken: (t: string) => {
    localStorage.setItem(TOKEN_KEY, t)
    document.cookie = `admin_token=${t}; path=/; max-age=${60 * 60 * 8}; SameSite=Strict`
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    document.cookie = 'admin_token=; path=/; max-age=0'
  },
}

// ─── Base fetch ───────────────────────────────────────────────────────────────
async function req<T>(
  base: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = adminAuth.getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${base}${path}`, { ...options, headers })

  if (res.status === 401) {
    adminAuth.clear()
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('Session expired. Please log in again.')
  }

  const json = await res.json()
  if (!res.ok) throw new Error(json.message || 'Request failed')
  return json.data ?? json
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PlatformStats {
  totalTenants: number; activeTenants: number; trialTenants: number
  suspendedTenants: number; mrr: number; arr: number; totalUsers: number
  newTenantsThisMonth: number; mrrDelta: number; churnRate: number
}

export interface TenantRow {
  id: string; name: string; ownerEmail: string; ownerName: string
  plan: string; status: string; mrr: number | null
  subscriptionEndsAt: string | null; trialEndsAt: string | null
  createdAt: string; branches?: unknown[]; _count?: { users: number; sales: number; repairs: number }
}

export interface SubscriptionRow {
  id: string; name: string; ownerEmail: string; plan: string
  status: string; mrr: number | null; subscriptionEndsAt: string | null; trialEndsAt: string | null
}

export interface GmvMonth      { month: string; gmv: number; invoices: number }
export interface TenantMonth   { month: string; newTenants: number; cumulative: number }
export interface PlanRow       { plan: string; _count: number; _sum: { mrr: number | null } }
export interface TopTenant     { id: string; name: string; mrr: number | null; plan: string; status: string; _count: { sales: number; users: number } }
export interface InactiveTenant { id: string; name: string; plan: string; status: string; mrr: number | null; createdAt: string }

export interface AnalyticsData {
  totalGMV: number; totalInvoices: number; totalRepairs: number
  totalCustomers: number; newTenantsThisMonth: number; activeTenantsCount: number
  tenantsByPlan: PlanRow[]
  topTenantsByRevenue: TopTenant[]
  gmvMonths: GmvMonth[]
  tenantMonths: TenantMonth[]
  inactiveTenants: InactiveTenant[]
}

export interface MrrPoint { month: string; mrr: number }

export interface HealthData {
  api: { status: string; responseTimeMs: number }
  database: { status: string; responseTimeMs: number }
  redis: { status: string; responseTimeMs: number }
  keycloak: { status: string; responseTimeMs: number }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function adminLogin(email: string, password: string) {
  const data = await req<{ accessToken: string; user: { role: string } }>(
    API_BASE, '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) },
  )
  if (data.user.role !== 'PLATFORM_ADMIN') throw new Error('Not a platform admin')
  adminAuth.setToken(data.accessToken)
  return data
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function fetchStats(): Promise<PlatformStats> {
  return req<PlatformStats>(ADMIN_BASE, '/stats')
}

// ─── Tenants ──────────────────────────────────────────────────────────────────
export async function fetchTenants(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params) : ''
  return req<{ data: TenantRow[]; total: number; page: number; limit: number }>(ADMIN_BASE, `/tenants${qs}`)
}

export async function fetchTenant(id: string) {
  return req<TenantRow>(ADMIN_BASE, `/tenants/${id}`)
}

export async function updateTenantStatus(id: string, status: string) {
  return req<TenantRow>(ADMIN_BASE, `/tenants/${id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status }),
  })
}

export async function updateTenant(id: string, data: Record<string, unknown>) {
  return req<TenantRow>(ADMIN_BASE, `/tenants/${id}`, {
    method: 'PATCH', body: JSON.stringify(data),
  })
}

export async function deleteTenant(id: string) {
  return req<null>(ADMIN_BASE, `/tenants/${id}`, { method: 'DELETE' })
}

export async function createTenant(data: { shopName: string; ownerName: string; email: string; phone?: string; plan: string; password?: string }) {
  return req<{ tenant: TenantRow; subdomain: string; ownerEmail: string; tempPassword?: string }>(
    ADMIN_BASE, '/tenants', { method: 'POST', body: JSON.stringify(data) },
  )
}

// ─── Subscriptions ────────────────────────────────────────────────────────────
export async function fetchSubscriptions(status?: string) {
  const qs = status ? `?status=${status}` : ''
  return req<{ data: SubscriptionRow[]; mrrTotal: number }>(ADMIN_BASE, `/subscriptions${qs}`)
}

export async function updateSubscription(id: string, data: { plan?: string; status?: string; mrr?: number; subscriptionEndsAt?: string }) {
  return req<SubscriptionRow>(ADMIN_BASE, `/tenants/${id}`, {
    method: 'PATCH', body: JSON.stringify(data),
  })
}

// ─── Users (cross-tenant) ────────────────────────────────────────────────────
export interface UserRow {
  id: string; name: string; email: string; role: string
  isActive: boolean; createdAt: string
  tenant: { id: string; name: string; plan: string }
}

export async function fetchUsers(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params) : ''
  return req<{ data: UserRow[]; total: number }>(ADMIN_BASE, `/users${qs}`)
}

export async function revokeSessionsForTenant(id: string) {
  return req<null>(ADMIN_BASE, `/tenants/${id}/revoke-sessions`, { method: 'POST' })
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function fetchAnalytics(): Promise<AnalyticsData> {
  return req<AnalyticsData>(ADMIN_BASE, '/analytics')
}

export async function fetchMrrChart(): Promise<MrrPoint[]> {
  return req<MrrPoint[]>(ADMIN_BASE, '/mrr-chart')
}

// ─── System Health ────────────────────────────────────────────────────────────
export async function fetchHealth(): Promise<HealthData> {
  return req<HealthData>(ADMIN_BASE, '/health')
}

export interface ServerStats {
  process: {
    nodeVersion: string; platform: string; uptimeSeconds: number
    heapUsedMB: number; heapTotalMB: number; rssMB: number; externalMB: number
  }
  db: { tables: { name: string; rows: number }[] }
}

export async function fetchServerStats(): Promise<ServerStats> {
  return req<ServerStats>(ADMIN_BASE, '/server-stats')
}

// ─── Activity Logs ────────────────────────────────────────────────────────────
export interface ActivityLog {
  id: string; timestamp: string; eventType: string; severity: string
  actorType: string; actor: string; target: string; details: string; ip: string
}
export interface ActivityLogResponse {
  data: ActivityLog[]; total: number; page: number; limit: number
  summary: { INFO: number; WARN: number; ERROR: number; CRITICAL: number }
}
export interface ActivityLogParams {
  search?: string; severity?: string; eventType?: string
  actorType?: string; page?: number; limit?: number
}
export async function fetchActivityLogs(params?: ActivityLogParams): Promise<ActivityLogResponse> {
  const p: Record<string, string> = {}
  if (params?.search)    p.search    = params.search
  if (params?.severity)  p.severity  = params.severity
  if (params?.eventType) p.eventType = params.eventType
  if (params?.actorType) p.actorType = params.actorType
  if (params?.page)      p.page      = String(params.page)
  if (params?.limit)     p.limit     = String(params.limit)
  const qs = Object.keys(p).length ? '?' + new URLSearchParams(p) : ''
  return req<ActivityLogResponse>(ADMIN_BASE, `/activity-logs${qs}`)
}
