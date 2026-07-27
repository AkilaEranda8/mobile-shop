/**
 * Fashion ERP platform API client (via Enterprise admin hub proxy).
 */
import { hubSession } from './hub-session'

const HUB = '/api/hub/fashion'

async function parseBody(res: Response) {
  const text = await res.text()
  if (!text) return { json: {} as Record<string, unknown>, text: '' }
  try {
    return { json: JSON.parse(text) as Record<string, unknown>, text }
  } catch {
    return { json: {}, text }
  }
}

function unwrap<T>(json: Record<string, unknown>): T {
  if (json && typeof json === 'object' && 'data' in json && json.success !== false) {
    return json.data as T
  }
  return json as T
}

export async function fashionReq<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = hubSession.getToken('fashion')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers.Authorization = `Bearer ${token}`
  headers['x-tenant-id'] = hubSession.getFashionTenant()

  const res = await fetch(`${HUB}${path}`, { ...options, headers })
  const { json, text } = await parseBody(res)

  if (res.status === 401) {
    hubSession.clearProduct('fashion')
    if (typeof window !== 'undefined') window.location.href = '/login?product=fashion'
    throw new Error('Fashion session expired. Please log in again.')
  }

  if (!res.ok) {
    const msg =
      (typeof json.message === 'string' && json.message) ||
      text ||
      'Fashion API request failed'
    throw new Error(msg)
  }

  return unwrap<T>(json)
}

export type FashionTenantRow = {
  id: string
  name: string
  subdomain: string
  email: string
  phone?: string
  plan: string
  status: string
  shopType?: string
  currency?: string
  trialEndsAt?: string | null
  createdAt: string
  _count?: { users: number; branches: number }
}

export type FashionOverview = {
  stats: {
    totalTenants: number
    activeTenants: number
    trialTenants: number
    suspendedTenants?: number
    mrr?: number
    totalUsers?: number
    newThisMonth?: number
  }
  alerts?: { type: string; severity: string; message: string }[]
  recentTenants?: { id: string; name: string; status: string; plan: string; createdAt: string }[]
}

export async function fashionLogin(email: string, password: string) {
  const res = await fetch(`${HUB}/auth/platform-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const { json, text } = await parseBody(res)
  if (!res.ok) {
    throw new Error((typeof json.message === 'string' && json.message) || text || 'Login failed')
  }
  const data = unwrap<{
    accessToken: string
    user: {
      id?: string
      email?: string
      firstName?: string
      lastName?: string
      roles?: string[]
    }
  }>(json)

  if (!data.accessToken) throw new Error('No token received from Fashion ERP')
  const roles = data.user?.roles ?? []
  if (!roles.includes('SUPER_ADMIN')) {
    throw new Error('This account does not have Fashion company admin access (SUPER_ADMIN).')
  }

  const name =
    [data.user.firstName, data.user.lastName].filter(Boolean).join(' ') ||
    data.user.email ||
    email

  hubSession.setFashionSession(data.accessToken, {
    id: data.user.id,
    name,
    email: data.user.email || email,
    role: 'SUPER_ADMIN',
  })

  return data
}

export async function fetchFashionOverview() {
  return fashionReq<FashionOverview>('/tenants/platform-overview')
}

export async function fetchFashionTenants(params?: Record<string, string>) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.status) qs.set('status', params.status)
  if (params?.plan) qs.set('plan', params.plan)
  const q = qs.toString()
  const arr = await fashionReq<FashionTenantRow[]>(`/tenants${q ? `?${q}` : ''}`)
  const list = Array.isArray(arr) ? arr : []
  return { data: list, total: list.length }
}

export async function updateFashionTenant(id: string, data: Record<string, unknown>) {
  return fashionReq(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function fetchFashionBillingSummary() {
  return fashionReq<Record<string, unknown>>('/tenants/billing-summary')
}

export async function fetchFashionPlans() {
  return fashionReq<unknown[]>('/tenants/subscription-plans')
}

export async function fetchFashionPlatformConfig() {
  return fashionReq<Record<string, unknown>>('/tenants/platform-config')
}

export async function updateFashionPlatformConfig(data: Record<string, unknown>) {
  return fashionReq('/tenants/platform-config', { method: 'PUT', body: JSON.stringify(data) })
}

export async function fetchFashionHealth() {
  return fashionReq<Record<string, unknown>>('/health')
}

export async function fetchFashionAuditLogs(params?: Record<string, string>) {
  const qs = new URLSearchParams(params || {})
  return fashionReq<unknown>(`/audit-logs/platform${qs.toString() ? `?${qs}` : ''}`)
}

export async function fetchFashionUsers(params?: Record<string, string>) {
  const qs = new URLSearchParams(params || {})
  return fashionReq<unknown>(`/users/platform${qs.toString() ? `?${qs}` : ''}`)
}

// Platform ops (W1–W3)
export const fashionPlatform = {
  notifications: () => fashionReq<{ data: unknown[]; total: number }>('/platform/notifications'),
  analytics: () => fashionReq<Record<string, unknown>>('/platform/analytics'),
  mrrChart: () => fashionReq<unknown[]>('/platform/analytics/mrr-chart'),

  listAnnouncements: () => fashionReq<unknown[]>('/platform/announcements'),
  createAnnouncement: (body: Record<string, unknown>) =>
    fashionReq('/platform/announcements', { method: 'POST', body: JSON.stringify(body) }),
  sendAnnouncement: (id: string) =>
    fashionReq(`/platform/announcements/${id}/send`, { method: 'PATCH' }),
  deleteAnnouncement: (id: string) =>
    fashionReq(`/platform/announcements/${id}`, { method: 'DELETE' }),

  listReleases: (status?: string) =>
    fashionReq<unknown[]>(`/platform/releases${status ? `?status=${status}` : ''}`),
  createRelease: (body: Record<string, unknown>) =>
    fashionReq('/platform/releases', { method: 'POST', body: JSON.stringify(body) }),
  publishRelease: (id: string) =>
    fashionReq(`/platform/releases/${id}/publish`, { method: 'PATCH' }),
  deleteRelease: (id: string) =>
    fashionReq(`/platform/releases/${id}`, { method: 'DELETE' }),

  suggestionsSummary: () => fashionReq<Record<string, number>>('/platform/feature-suggestions/summary'),
  listSuggestions: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params || {})
    return fashionReq<{ data: unknown[]; total: number }>(
      `/platform/feature-suggestions${qs.toString() ? `?${qs}` : ''}`,
    )
  },
  updateSuggestion: (id: string, body: Record<string, unknown>) =>
    fashionReq(`/platform/feature-suggestions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listAdmins: () => fashionReq<unknown[]>('/platform/admins'),
  createAdmin: (body: Record<string, unknown>) =>
    fashionReq('/platform/admins', { method: 'POST', body: JSON.stringify(body) }),
  deleteAdmin: (id: string) =>
    fashionReq(`/platform/admins/${id}`, { method: 'DELETE' }),
  revokeSessions: (tenantId: string) =>
    fashionReq(`/platform/tenants/${tenantId}/revoke-sessions`, { method: 'POST' }),
  resetPassword: (userId: string) =>
    fashionReq(`/platform/users/${userId}/reset-password`, { method: 'POST' }),

  impersonate: (tenantId: string) =>
    fashionReq<{ loginUrl: string; ownerEmail: string }>('/platform/support/impersonate/' + tenantId, {
      method: 'POST',
    }),
  tenantDebug: (tenantId: string) =>
    fashionReq(`/platform/support/tenant-debug/${tenantId}`),
  listNotes: (tenantId?: string) =>
    fashionReq<unknown[]>(
      `/platform/support/notes${tenantId ? `?tenantId=${tenantId}` : ''}`,
    ),
  createNote: (body: Record<string, unknown>) =>
    fashionReq('/platform/support/notes', { method: 'POST', body: JSON.stringify(body) }),
  deleteNote: (id: string) =>
    fashionReq(`/platform/support/notes/${id}`, { method: 'DELETE' }),

  waStatus: () => fashionReq<Record<string, unknown>>('/platform/billing/whatsapp/status'),
  waConnect: () =>
    fashionReq('/platform/billing/whatsapp/connect', { method: 'POST' }),
  waDisconnect: () =>
    fashionReq('/platform/billing/whatsapp/disconnect', { method: 'POST' }),
  waTest: (phone: string, message?: string) =>
    fashionReq('/platform/billing/whatsapp/test-message', {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    }),
}
