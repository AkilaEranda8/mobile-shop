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

export interface AnalyticsData {
  totalGMV: number; totalInvoices: number; totalRepairs: number
  totalCustomers: number; tenantsByPlan: unknown[]; topTenantsByRevenue: unknown[]
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

// ─── Subscriptions ────────────────────────────────────────────────────────────
export async function fetchSubscriptions(status?: string) {
  const qs = status ? `?status=${status}` : ''
  return req<{ data: SubscriptionRow[]; mrrTotal: number }>(ADMIN_BASE, `/subscriptions${qs}`)
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
