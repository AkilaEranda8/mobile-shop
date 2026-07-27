/**
 * Salon platform API client (via Enterprise admin hub proxy).
 */
import { hubSession } from './hub-session'

const HUB = '/api/hub/salon'

async function parseBody(res: Response) {
  const text = await res.text()
  if (!text) return { json: {} as Record<string, unknown>, text: '' }
  try {
    return { json: JSON.parse(text) as Record<string, unknown>, text }
  } catch {
    return { json: {}, text }
  }
}

export async function salonReq<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = hubSession.getToken('salon')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${HUB}${path}`, { ...options, headers })
  const { json, text } = await parseBody(res)

  if (res.status === 401) {
    hubSession.clearProduct('salon')
    if (typeof window !== 'undefined') window.location.href = '/login?product=salon'
    throw new Error('Salon session expired. Please log in again.')
  }

  if (!res.ok) {
    const msg =
      (typeof json.message === 'string' && json.message) ||
      text ||
      'Salon API request failed'
    throw new Error(msg)
  }

  return json as T
}

export type SalonTenantRow = {
  id: number | string
  name: string
  slug: string
  email?: string
  plan?: string
  status?: string
  trial_ends_at?: string | null
  createdAt?: string
  subscription?: {
    plan?: string
    status?: string
    current_period_end?: string
  } | null
}

export type SalonStats = {
  totalTenants: number
  activePaid: number
  activeTrials: number
  suspended: number
  estimatedMrr?: number
  byPlan?: Record<string, number>
  byStatus?: Record<string, number>
  recentTenants?: SalonTenantRow[]
}

export async function salonLogin(username: string, password: string) {
  const loginRes = await fetch(`${HUB}/auth/kc-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const loginBody = await parseBody(loginRes)
  if (!loginRes.ok) {
    const legacy = await fetch(`${HUB}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const legacyBody = await parseBody(legacy)
    if (!legacy.ok) {
      throw new Error(
        (typeof loginBody.json.message === 'string' && loginBody.json.message) ||
          (typeof legacyBody.json.message === 'string' && legacyBody.json.message) ||
          'Salon login failed',
      )
    }
    const legacyJson = legacyBody.json as {
      access_token?: string
      token?: string
      user?: { id?: string; name?: string; username?: string; email?: string; role?: string }
    }
    const token = legacyJson.access_token || legacyJson.token
    const user = legacyJson.user
    if (!token || !user) throw new Error('Invalid salon login response')
    if (user.role !== 'platform_admin') {
      throw new Error('Platform admin account required for Salon.')
    }
    hubSession.setSalonSession(token, {
      id: user.id,
      name: user.name || user.username || username,
      email: user.email || username,
      role: 'platform_admin',
    })
    return { accessToken: token, user }
  }

  const data = loginBody.json as { access_token?: string }
  const accessToken = data.access_token
  if (!accessToken) throw new Error('No access token from Salon')

  const meRes = await fetch(`${HUB}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const meBody = await parseBody(meRes)
  if (!meRes.ok) {
    throw new Error(
      (typeof meBody.json.message === 'string' && meBody.json.message) ||
        'Failed to load Salon user profile',
    )
  }
  const me = meBody.json as {
    user?: { id?: string; name?: string; username?: string; email?: string; role?: string }
  }
  const user = me.user
  if (!user || user.role !== 'platform_admin') {
    throw new Error('Platform admin account required for Salon.')
  }

  hubSession.setSalonSession(accessToken, {
    id: user.id,
    name: user.name || user.username || username,
    email: user.email || username,
    role: 'platform_admin',
  })

  return { accessToken, user }
}

export async function fetchSalonStats() {
  return salonReq<SalonStats>('/platform/stats')
}

export async function fetchSalonTenants(params?: Record<string, string>) {
  const qs = new URLSearchParams()
  qs.set('limit', params?.limit || '100')
  qs.set('page', params?.page || '1')
  if (params?.search) qs.set('search', params.search)
  if (params?.status) qs.set('status', params.status)
  if (params?.plan) qs.set('plan', params.plan)
  const data = await salonReq<{
    total: number
    page: number
    limit: number
    tenants: SalonTenantRow[]
  }>(`/platform/tenants?${qs}`)
  return {
    data: data.tenants ?? [],
    total: data.total ?? 0,
  }
}

export const salonPlatform = {
  analytics: () => salonReq<Record<string, unknown>>('/platform/analytics'),
  mrrChart: () => salonReq<unknown[]>('/platform/analytics/mrr-chart'),
  notifications: () => salonReq<{ data: unknown[]; total: number }>('/platform/notifications'),
  monitoring: () => salonReq<Record<string, unknown>>('/platform/system/monitoring'),
  activityLogs: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params || {})
    return salonReq(`/platform/activity-logs${qs.toString() ? `?${qs}` : ''}`)
  },
  subscriptions: () => salonReq<unknown[]>('/platform/subscriptions'),
  plans: () => salonReq<unknown[]>('/platform/plans'),
  invoices: () => salonReq<unknown[]>('/platform/invoices'),
  admins: () => salonReq<unknown[]>('/platform/admins'),
  createAdmin: (body: Record<string, unknown>) =>
    salonReq('/platform/admins', { method: 'POST', body: JSON.stringify(body) }),
  updateAdmin: (id: string | number, body: Record<string, unknown>) =>
    salonReq(`/platform/admins/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAdmin: (id: string | number) =>
    salonReq(`/platform/admins/${id}`, { method: 'DELETE' }),
  resetAdminPassword: (id: string | number, body?: Record<string, unknown>) =>
    salonReq(`/platform/admins/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  resetUserPassword: (id: string | number, body?: Record<string, unknown>) =>
    salonReq(`/platform/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  revokeSessions: (tenantId: string | number) =>
    salonReq(`/platform/tenants/${tenantId}/revoke-sessions`, { method: 'POST' }),
  maintenance: () => salonReq('/platform/system/maintenance'),
  updateMaintenance: (body: Record<string, unknown>) =>
    salonReq('/platform/system/maintenance', { method: 'PATCH', body: JSON.stringify(body) }),
  smtpSms: () => salonReq('/platform/system/smtp-sms'),
  updateSmtpSms: (body: Record<string, unknown>) =>
    salonReq('/platform/system/smtp-sms', { method: 'PUT', body: JSON.stringify(body) }),

  listAnnouncements: () => salonReq<unknown[]>('/platform/announcements'),
  createAnnouncement: (body: Record<string, unknown>) =>
    salonReq('/platform/announcements', { method: 'POST', body: JSON.stringify(body) }),
  sendAnnouncement: (id: string | number) =>
    salonReq(`/platform/announcements/${id}/send`, { method: 'PATCH' }),
  deleteAnnouncement: (id: string | number) =>
    salonReq(`/platform/announcements/${id}`, { method: 'DELETE' }),

  listReleases: () => salonReq<unknown[]>('/platform/releases'),
  createRelease: (body: Record<string, unknown>) =>
    salonReq('/platform/releases', { method: 'POST', body: JSON.stringify(body) }),
  publishRelease: (id: string | number) =>
    salonReq(`/platform/releases/${id}/publish`, { method: 'PATCH' }),
  deleteRelease: (id: string | number) =>
    salonReq(`/platform/releases/${id}`, { method: 'DELETE' }),

  suggestionsSummary: () => salonReq<Record<string, number>>('/platform/feature-suggestions/summary'),
  listSuggestions: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params || {})
    return salonReq<{ data: unknown[]; total: number }>(
      `/platform/feature-suggestions${qs.toString() ? `?${qs}` : ''}`,
    )
  },
  updateSuggestion: (id: string | number, body: Record<string, unknown>) =>
    salonReq(`/platform/feature-suggestions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  catalog: () => salonReq<unknown[]>('/platform/master-catalog/categories'),
  createCatalogCategory: (body: Record<string, unknown>) =>
    salonReq('/platform/master-catalog/categories', { method: 'POST', body: JSON.stringify(body) }),
  createCatalogItem: (body: Record<string, unknown>) =>
    salonReq('/platform/master-catalog/items', { method: 'POST', body: JSON.stringify(body) }),
  deleteCatalogCategory: (id: string | number) =>
    salonReq(`/platform/master-catalog/categories/${id}`, { method: 'DELETE' }),

  impersonate: (tenantId: string | number) =>
    salonReq(`/platform/tenants/${tenantId}/impersonate`, { method: 'POST' }),

  waStatus: () => salonReq<Record<string, unknown>>('/platform/whatsapp/status'),
  waConnect: () => salonReq('/platform/whatsapp/connect', { method: 'POST' }),
  waDisconnect: () => salonReq('/platform/whatsapp/disconnect', { method: 'POST' }),
  waTest: (phone: string, message?: string) =>
    salonReq('/platform/whatsapp/test-message', {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    }),
  setWaTenant: (tenantId: string | number) =>
    salonReq('/platform/whatsapp/tenant', {
      method: 'PUT',
      body: JSON.stringify({ tenantId }),
    }),
}
