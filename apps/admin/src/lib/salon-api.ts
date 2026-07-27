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

function errMsg(json: Record<string, unknown>, text: string, fallback: string) {
  if (typeof json.message === 'string' && json.message) return json.message
  return text || fallback
}

type SalonUser = {
  id?: string | number
  name?: string
  username?: string
  email?: string
  role?: string
}

function acceptPlatformUser(user: SalonUser | undefined, username: string, token: string) {
  if (!token) throw new Error('Salon login response missing token')
  if (!user || user.role !== 'platform_admin') {
    throw new Error('Platform admin account required for Salon.')
  }
  hubSession.setSalonSession(token, {
    id: user.id != null ? String(user.id) : undefined,
    name: user.name || user.username || username,
    email: user.email || username,
    role: 'platform_admin',
  })
  return { accessToken: token, user }
}

/** Confirm token works with whatever auth mode Salon is running (legacy vs Keycloak). */
async function probeMe(token: string): Promise<SalonUser | null> {
  const meRes = await fetch(`${HUB}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const { json } = await parseBody(meRes)
  if (!meRes.ok) return null
  const user = (json as { user?: SalonUser }).user
  return user?.role === 'platform_admin' ? user : null
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
    throw new Error(errMsg(json, text, 'Salon API request failed'))
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
  const body = JSON.stringify({ username, password })
  const headers = { 'Content-Type': 'application/json' }

  // 1) Legacy first — platform_admin usually uses HS256 cookie JWT (proxy injects token into JSON)
  const legacy = await fetch(`${HUB}/auth/login`, { method: 'POST', headers, body })
  const legacyBody = await parseBody(legacy)
  const legacyJson = legacyBody.json as {
    requires2fa?: boolean
    access_token?: string
    token?: string
    user?: SalonUser
    message?: string
  }

  if (legacy.ok) {
    if (legacyJson.requires2fa) {
      throw new Error(
        'This Salon account has 2FA enabled. Disable 2FA temporarily or use an account without 2FA for the hub.',
      )
    }
    const token = legacyJson.access_token || legacyJson.token || ''
    if (token && legacyJson.user?.role === 'platform_admin') {
      const probed = await probeMe(token)
      if (probed) return acceptPlatformUser(probed, username, token)
      // Token issued but auth mode mismatch — fall through to Keycloak
    }
  }

  // 2) Keycloak password grant (when KEYCLOAK_AUTH_ENABLED)
  const kc = await fetch(`${HUB}/auth/kc-login`, { method: 'POST', headers, body })
  const kcBody = await parseBody(kc)
  if (kc.ok) {
    const accessToken = (kcBody.json as { access_token?: string }).access_token
    if (accessToken) {
      const user = await probeMe(accessToken)
      if (user) return acceptPlatformUser(user, username, accessToken)
    }
  }

  throw new Error(
    errMsg(legacyBody.json, legacyBody.text, '') ||
      errMsg(kcBody.json, kcBody.text, '') ||
      'Salon login failed',
  )
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

export type SalonOnboardInput = {
  businessName: string
  ownerName: string
  ownerEmail: string
  password: string
  phone?: string
  slug?: string
  plan?: string
  branchName?: string
}

export type SalonOnboardResult = {
  tenant_url?: string
  tenant: {
    id: number | string
    name: string
    slug: string
    email?: string
    plan?: string
    status?: string
    trial_ends_at?: string | null
  }
  branch?: { id: number | string; name: string }
  owner?: { id: number | string; name: string; username: string; role: string }
}

export async function createSalonTenant(input: SalonOnboardInput) {
  return salonReq<SalonOnboardResult>('/platform/tenants', {
    method: 'POST',
    body: JSON.stringify({
      businessName: input.businessName,
      ownerName: input.ownerName,
      ownerEmail: input.ownerEmail,
      password: input.password,
      phone: input.phone || undefined,
      slug: input.slug || undefined,
      plan: input.plan || 'trial',
      branchName: input.branchName || undefined,
      status: 'active',
    }),
  })
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
  subscriptions: () => salonReq<SalonSubscriptionRow[]>('/platform/subscriptions'),
  plans: () => salonReq<SalonPlanRow[]>('/platform/plans'),
  invoices: async (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params || { limit: '100' })
    const data = await salonReq<{
      total?: number
      invoices?: SalonInvoiceRow[]
    } | SalonInvoiceRow[]>(`/platform/invoices?${qs}`)
    if (Array.isArray(data)) return { total: data.length, invoices: data }
    return { total: data.total ?? data.invoices?.length ?? 0, invoices: data.invoices ?? [] }
  },
  updateTenant: (id: string | number, body: Record<string, unknown>) =>
    salonReq(`/platform/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getTenant: (id: string | number) =>
    salonReq<SalonTenantRow & Record<string, unknown>>(`/platform/tenants/${id}`),
  deleteTenant: (id: string | number) =>
    salonReq(`/platform/tenants/${id}`, { method: 'DELETE' }),
  clearTenantData: (id: string | number, confirm: string) =>
    salonReq(`/platform/tenants/${id}/clear-data`, {
      method: 'POST',
      body: JSON.stringify({ confirm }),
    }),
  tenantStats: (id: string | number) =>
    salonReq<Record<string, number>>(`/platform/tenants/${id}/stats`),
  getFeatures: (id: string | number) =>
    salonReq<{
      catalog?: { key: string; label?: string }[]
      enabled_features?: string[] | null
      effective?: string[]
      plan?: string
      adminControlled?: boolean
    }>(`/platform/tenants/${id}/features`),
  updateFeatures: (id: string | number, enabled_features: string[] | null) =>
    salonReq(`/platform/tenants/${id}/features`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled_features }),
    }),
  quickStatus: (id: string | number, action: 'activate' | 'suspend' | 'cancel') =>
    salonReq(`/platform/tenants/${id}/quick-status`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }),
  adjustTrial: (id: string | number, body: { days?: number; trial_ends_at?: string }) =>
    salonReq(`/platform/tenants/${id}/trial/adjust`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSubscription: (id: string | number, body: Record<string, unknown>) =>
    salonReq(`/platform/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  createSubscription: (body: Record<string, unknown>) =>
    salonReq('/platform/subscriptions', { method: 'POST', body: JSON.stringify(body) }),
  deleteSubscription: (id: string | number) =>
    salonReq(`/platform/subscriptions/${id}`, { method: 'DELETE' }),
  createInvoice: (body: Record<string, unknown>) =>
    salonReq('/platform/invoices', { method: 'POST', body: JSON.stringify(body) }),
  updateInvoice: (id: string | number, body: Record<string, unknown>) =>
    salonReq(`/platform/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteInvoice: (id: string | number) =>
    salonReq(`/platform/invoices/${id}`, { method: 'DELETE' }),
  emailInvoice: (id: string | number, email?: string) =>
    salonReq(`/platform/invoices/${id}/email`, {
      method: 'POST',
      body: JSON.stringify(email ? { email } : {}),
    }),
  updatePlan: (id: string | number, body: Record<string, unknown>) =>
    salonReq(`/platform/plans/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  createPlan: (body: Record<string, unknown>) =>
    salonReq('/platform/plans', { method: 'POST', body: JSON.stringify(body) }),
  stats: () => salonReq<SalonStats>('/platform/stats'),
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
    salonReq<{
      token?: string
      tenant_url?: string
      loginUrl?: string
      tenant?: { id?: number | string; name?: string; slug?: string }
      user?: { id?: number | string; name?: string; username?: string }
    }>(`/platform/tenants/${tenantId}/impersonate`, { method: 'POST' }),

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

export type SalonSubscriptionRow = {
  id: number | string
  tenant_id?: number | string
  plan?: string
  status?: string
  current_period_start?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean
  tenant?: { id?: number | string; name?: string; slug?: string; email?: string }
}

export type SalonPlanRow = {
  id: number | string
  key: string
  label?: string
  price_display?: string | null
  price_period?: string | null
  tagline?: string | null
  max_branches?: number
  max_staff?: number
  max_services?: number
  features?: string[]
  trial_days?: number
  is_popular?: boolean
  is_active?: boolean
  sort_order?: number
}

export type SalonInvoiceRow = {
  id: number | string
  invoice_number?: string
  tenant_id?: number | string
  amount?: number
  total?: number
  status?: string
  plan?: string
  issued_at?: string | null
  due_at?: string | null
  paid_at?: string | null
  notes?: string | null
  tenant?: { id?: number | string; name?: string; slug?: string; email?: string; plan?: string }
}
