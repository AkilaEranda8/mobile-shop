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
async function parseResponseBody(res: Response): Promise<{ json: Record<string, unknown>; text: string }> {
  const text = await res.text()
  if (!text) return { json: {}, text: '' }
  try {
    return { json: JSON.parse(text) as Record<string, unknown>, text }
  } catch {
    return { json: {}, text }
  }
}

function responseErrorMessage(
  json: Record<string, unknown>,
  text: string,
  fallback = 'Request failed',
): string {
  if (typeof json.message === 'string' && json.message) return json.message
  if (text) return text
  return fallback
}

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

  const { json, text } = await parseResponseBody(res)
  if (!res.ok) throw new Error(responseErrorMessage(json, text))
  return (json.data ?? json) as T
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PlatformStats {
  totalTenants: number; activeTenants: number; trialTenants: number
  suspendedTenants: number; mrr: number; arr: number; totalUsers: number
  newTenantsThisMonth: number; mrrDelta: number; churnRate: number
}

export interface TenantUser {
  id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string
}
export interface TenantRow {
  id: string; name: string; ownerEmail: string; ownerName: string
  plan: string; status: string; mrr: number | null
  subscriptionEndsAt: string | null; trialEndsAt: string | null
  createdAt: string; branches?: unknown[]
  users?: TenantUser[]
  _count?: { users: number; sales: number; repairs: number; customers?: number; products?: number }
}

export interface SubscriptionRow {
  id: string; name: string; ownerEmail: string; ownerName?: string; ownerPhone?: string | null
  plan: string; status: string; mrr: number | null; subscriptionEndsAt: string | null; trialEndsAt: string | null
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
  if (data.user.role !== 'PLATFORM_ADMIN') {
    throw new Error('This account is not a platform admin. Use your platform admin email, not a shop login.')
  }
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

export async function clearTenantTrialData(id: string, confirmName: string) {
  return req<{ counts: Record<string, number>; totalDeleted: number }>(
    ADMIN_BASE,
    `/tenants/${id}/clear-trial-data`,
    { method: 'POST', body: JSON.stringify({ confirmName }) },
  )
}

export type TenantFeaturesPayload = {
  features: Record<string, boolean>
  prices: Record<string, number | null>
}

export async function fetchTenantFeatures(id: string) {
  return req<TenantFeaturesPayload>(ADMIN_BASE, `/tenants/${id}/features`)
}

export async function updateTenantFeatures(
  id: string,
  features: Record<string, boolean>,
  prices?: Record<string, number | null>,
) {
  return req<TenantFeaturesPayload>(ADMIN_BASE, `/tenants/${id}/features`, {
    method: 'PUT', body: JSON.stringify({ features, prices }),
  })
}

// ─── Tenant WhatsApp (platform admin) ─────────────────────────────────────────
export type WAStatus = 'connected' | 'disconnected' | 'token_expired' | 'qr_pending' | 'connecting'
export type WAConnectionMode = 'qr' | 'meta'

export interface WAStatusInfo {
  status: WAStatus
  connectionMode?: WAConnectionMode
  enabled?: boolean
  qr?: string
  phoneNumber?: string
  displayName?: string
  lastChecked?: string
  qualityRating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'
}

export interface WAConfig {
  connectionMode?: WAConnectionMode
  accessToken: string
  phoneNumberId: string
  wabaId: string
  verifyToken: string
  enabled: boolean
  autoSendInvoice: boolean
  sendPdfInvoice: boolean
  invoiceTemplate: string
  validatePhones: boolean
}

function tenantWhatsappPath(tenantId: string, suffix: string) {
  return `/tenants/${tenantId}/whatsapp${suffix}`
}

export interface AdminWhatsappApi {
  getStatus:        () => Promise<WAStatusInfo>
  getConfig:        () => Promise<WAConfig>
  getQrSession:     () => Promise<WAStatusInfo>
  startQrConnect:   () => Promise<WAStatusInfo>
  refreshQrConnect: () => Promise<WAStatusInfo>
  connect:          (body: Partial<WAConfig>) => Promise<WAStatusInfo>
  disconnect:       () => Promise<{ success: boolean }>
  updateConfig:     (body: Partial<WAConfig>) => Promise<WAConfig>
  testConnection:   () => Promise<{ success: boolean; message: string }>
  sendTestMessage:  (phone: string) => Promise<{ success: boolean; message: string }>
}

export function whatsappApiForTenant(tenantId: string): AdminWhatsappApi {
  return {
    getStatus:        () => req<WAStatusInfo>(ADMIN_BASE, tenantWhatsappPath(tenantId, '/status')),
    getConfig:        () => req<WAConfig>(ADMIN_BASE, tenantWhatsappPath(tenantId, '/config')),
    getQrSession:     () => req<WAStatusInfo>(ADMIN_BASE, tenantWhatsappPath(tenantId, '/qr')),
    startQrConnect:   () => req<WAStatusInfo>(ADMIN_BASE, tenantWhatsappPath(tenantId, '/qr/start'), { method: 'POST', body: '{}' }),
    refreshQrConnect: () => req<WAStatusInfo>(ADMIN_BASE, tenantWhatsappPath(tenantId, '/qr/refresh'), { method: 'POST', body: '{}' }),
    connect:          (body) => req<WAStatusInfo>(ADMIN_BASE, tenantWhatsappPath(tenantId, '/connect'), { method: 'POST', body: JSON.stringify(body) }),
    disconnect:       () => req<{ success: boolean }>(ADMIN_BASE, tenantWhatsappPath(tenantId, '/disconnect'), { method: 'POST', body: '{}' }),
    updateConfig:     (body) => req<WAConfig>(ADMIN_BASE, tenantWhatsappPath(tenantId, '/config'), { method: 'PUT', body: JSON.stringify(body) }),
    testConnection:   () => req<{ success: boolean; message: string }>(ADMIN_BASE, tenantWhatsappPath(tenantId, '/test'), { method: 'POST', body: '{}' }),
    sendTestMessage:  (phone) => req<{ success: boolean; message: string }>(ADMIN_BASE, tenantWhatsappPath(tenantId, '/test-message'), { method: 'POST', body: JSON.stringify({ phone }) }),
  }
}

/** @deprecated use whatsappApiForTenant */
export const tenantWhatsappApi = {
  getStatus:        (tenantId: string) => whatsappApiForTenant(tenantId).getStatus(),
  getConfig:        (tenantId: string) => whatsappApiForTenant(tenantId).getConfig(),
  getQrSession:     (tenantId: string) => whatsappApiForTenant(tenantId).getQrSession(),
  startQrConnect:   (tenantId: string) => whatsappApiForTenant(tenantId).startQrConnect(),
  refreshQrConnect: (tenantId: string) => whatsappApiForTenant(tenantId).refreshQrConnect(),
  connect:          (tenantId: string, body: Partial<WAConfig>) => whatsappApiForTenant(tenantId).connect(body),
  disconnect:       (tenantId: string) => whatsappApiForTenant(tenantId).disconnect(),
  updateConfig:     (tenantId: string, body: Partial<WAConfig>) => whatsappApiForTenant(tenantId).updateConfig(body),
  testConnection:   (tenantId: string) => whatsappApiForTenant(tenantId).testConnection(),
  sendTestMessage:  (tenantId: string, phone: string) => whatsappApiForTenant(tenantId).sendTestMessage(phone),
}

const BILLING_WA = '/billing/whatsapp'

/** Platform billing WhatsApp — Hexalyte's own number for subscription invoices (shops need not connect). */
export const billingWhatsappApi: AdminWhatsappApi = {
  getStatus:        () => req<WAStatusInfo>(ADMIN_BASE, `${BILLING_WA}/status`),
  getConfig:        () => req<WAConfig>(ADMIN_BASE, `${BILLING_WA}/config`),
  getQrSession:     () => req<WAStatusInfo>(ADMIN_BASE, `${BILLING_WA}/qr`),
  startQrConnect:   () => req<WAStatusInfo>(ADMIN_BASE, `${BILLING_WA}/qr/start`, { method: 'POST', body: '{}' }),
  refreshQrConnect: () => req<WAStatusInfo>(ADMIN_BASE, `${BILLING_WA}/qr/refresh`, { method: 'POST', body: '{}' }),
  connect:          (body) => req<WAStatusInfo>(ADMIN_BASE, `${BILLING_WA}/connect`, { method: 'POST', body: JSON.stringify(body) }),
  disconnect:       () => req<{ success: boolean }>(ADMIN_BASE, `${BILLING_WA}/disconnect`, { method: 'POST', body: '{}' }),
  updateConfig:     (body) => req<WAConfig>(ADMIN_BASE, `${BILLING_WA}/config`, { method: 'PUT', body: JSON.stringify(body) }),
  testConnection:   () => req<{ success: boolean; message: string }>(ADMIN_BASE, `${BILLING_WA}/test`, { method: 'POST', body: '{}' }),
  sendTestMessage:  (phone) => req<{ success: boolean; message: string }>(ADMIN_BASE, `${BILLING_WA}/test-message`, { method: 'POST', body: JSON.stringify({ phone }) }),
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

export async function sendSubscriptionInvoice(
  tenantId: string,
  body: {
    phone: string
    orderId: string
    customerName?: string
    amount?: number
    message?: string
    pdfBase64?: string
    pdfFilename?: string
  },
) {
  return req<{ success: boolean; messageId: string }>(
    ADMIN_BASE,
    `/subscriptions/${tenantId}/send-invoice`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export interface SubscriptionContact {
  id: string
  name: string
  ownerEmail: string
  ownerName: string
  ownerPhone: string | null
  phoneSource: 'branch' | 'invoice_settings' | 'customer' | null
}

export async function fetchSubscriptionContact(tenantId: string) {
  return req<SubscriptionContact>(ADMIN_BASE, `/subscriptions/${tenantId}/contact`)
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

export interface TenantSale {
  id: string; invoiceNumber: string; total: number; paidAmount: number; dueAmount: number
  status: string; cashierName: string; customerName: string | null; createdAt: string
}
export async function fetchTenantSales(id: string): Promise<TenantSale[]> {
  return req<TenantSale[]>(ADMIN_BASE, `/tenants/${id}/sales`)
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

// ─── Support Tools ────────────────────────────────────────────────────────────
export interface SupportNote {
  id: string; tenantId: string; note: string
  adminName: string; ticketRef?: string; createdAt: string
  tenant?: { name: string }
}
export async function fetchSupportNotes(tenantId?: string): Promise<SupportNote[]> {
  const qs = tenantId ? `?tenantId=${tenantId}` : ''
  return req<SupportNote[]>(ADMIN_BASE, `/support/notes${qs}`)
}
export async function createSupportNote(data: { tenantId: string; note: string; adminName?: string; ticketRef?: string }): Promise<SupportNote> {
  return req<SupportNote>(ADMIN_BASE, '/support/notes', { method: 'POST', body: JSON.stringify(data) })
}
export async function deleteSupportNote(id: string): Promise<null> {
  return req<null>(ADMIN_BASE, `/support/notes/${id}`, { method: 'DELETE' })
}
export async function impersonateTenant(tenantId: string): Promise<{ token: string; ownerEmail: string; tenantId: string }> {
  return req<{ token: string; ownerEmail: string; tenantId: string }>(ADMIN_BASE, `/support/impersonate/${tenantId}`, { method: 'POST' })
}
export interface TenantDebug {
  tenant: { id: string; name: string; plan: string; status: string; createdAt: string }
  counts: { products: number; customers: number; sales: number; repairs: number; users: number }
  lastActivity: string | null
  recentWarrantyClaims: { status: string; createdAt: string; issue: string }[]
  recentPurchaseOrders: { status: string; createdAt: string; poNumber: string; total: number }[]
}
export async function fetchTenantDebug(tenantId: string): Promise<TenantDebug> {
  return req<TenantDebug>(ADMIN_BASE, `/support/tenant-debug/${tenantId}`)
}

export interface ResetLoginRateLimitResult {
  email?: string
  keysCleared?: number
  keys?: string[]
  scope?: string
}

export async function resetLoginRateLimit(data: {
  email?: string
  ip?: string
  resetAll?: boolean
}): Promise<ResetLoginRateLimitResult> {
  return req<ResetLoginRateLimitResult>(
    ADMIN_BASE,
    '/support/reset-login-rate-limit',
    { method: 'POST', body: JSON.stringify(data) },
  )
}

// ─── Announcements ────────────────────────────────────────────────────────────
export interface AnnouncementRow {
  id: string; title: string; body: string
  type: string; status: string; target: string
  scheduledAt: string | null; sentAt: string | null
  seenCount: number; createdBy: string; createdAt: string
}
export async function fetchAnnouncements(): Promise<AnnouncementRow[]> {
  return req<AnnouncementRow[]>(ADMIN_BASE, '/announcements')
}
export async function createAnnouncement(data: {
  title: string; body: string; type: string; target: string
  scheduledAt?: string; sendNow?: boolean
}): Promise<AnnouncementRow> {
  return req<AnnouncementRow>(ADMIN_BASE, '/announcements', { method: 'POST', body: JSON.stringify(data) })
}
export async function sendAnnouncement(id: string): Promise<AnnouncementRow> {
  return req<AnnouncementRow>(ADMIN_BASE, `/announcements/${id}/send`, { method: 'PATCH' })
}
export async function deleteAnnouncement(id: string): Promise<null> {
  return req<null>(ADMIN_BASE, `/announcements/${id}`, { method: 'DELETE' })
}

// ─── Release Notes ────────────────────────────────────────────────────────────
export type ReleaseItemInput = {
  category: string
  module?: string
  featureName: string
  description: string
  badge?: string
  displayOrder?: number
  imageUrl?: string
  videoUrl?: string
  docUrl?: string
}

export interface ReleaseRow {
  id: string
  version: string
  title: string
  summary: string
  releaseDate: string
  status: string
  popupEnabled: boolean
  active: boolean
  targetType: string
  targetPlans: string[]
  targetTenants: string[]
  imageUrl: string | null
  videoUrl: string | null
  docUrl: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  items?: ReleaseItemInput[]
  counts?: {
    newFeatures: number
    improvements: number
    bugFixes: number
    securityUpdates: number
    comingSoon: number
  }
  itemCount?: number
  readCount?: number
}

export interface ReleaseListResponse {
  data: ReleaseRow[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export async function fetchReleases(params?: { search?: string; status?: string; page?: number }): Promise<{ data: ReleaseRow[]; total: number; page: number; limit: number }> {
  const p: Record<string, string> = {}
  if (params?.search) p.search = params.search
  if (params?.status) p.status = params.status
  if (params?.page) p.page = String(params.page)
  const qs = Object.keys(p).length ? '?' + new URLSearchParams(p) : ''
  const token = adminAuth.getToken()
  const res = await fetch(`${ADMIN_BASE}/releases${qs}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const { json, text } = await parseResponseBody(res)
  if (!res.ok) throw new Error(responseErrorMessage(json, text))
  const meta = (json.meta ?? {}) as Record<string, number>
  return {
    data: (json.data ?? []) as ReleaseRow[],
    total: meta.total ?? 0,
    page: meta.page ?? 1,
    limit: meta.limit ?? 20,
  }
}

export async function fetchRelease(id: string): Promise<ReleaseRow> {
  return req<ReleaseRow>(ADMIN_BASE, `/releases/${id}`)
}

export async function createRelease(data: Partial<ReleaseRow> & { items?: ReleaseItemInput[] }): Promise<ReleaseRow> {
  return req<ReleaseRow>(ADMIN_BASE, '/releases', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateRelease(id: string, data: Partial<ReleaseRow> & { items?: ReleaseItemInput[] }): Promise<ReleaseRow> {
  return req<ReleaseRow>(ADMIN_BASE, `/releases/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function publishRelease(id: string): Promise<ReleaseRow> {
  return req<ReleaseRow>(ADMIN_BASE, `/releases/${id}/publish`, { method: 'PATCH' })
}

export async function deleteRelease(id: string): Promise<null> {
  return req<null>(ADMIN_BASE, `/releases/${id}`, { method: 'DELETE' })
}

// ─── Notifications ────────────────────────────────────────────────────────────
export interface PlatformNotification {
  id: string; type: string; title: string; message: string
  severity: string; createdAt: string; tenantId?: string
}
export interface NotificationResponse {
  data: PlatformNotification[]; total: number
  summary: { INFO: number; WARN: number; ERROR: number }
}
export async function fetchNotifications(): Promise<NotificationResponse> {
  return req<NotificationResponse>(ADMIN_BASE, '/notifications')
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

// ─── Settings ─────────────────────────────────────────────────────────────────
export type PlatformConfigMap = Record<string, string>

export async function fetchPlatformConfig(): Promise<PlatformConfigMap> {
  return req<PlatformConfigMap>(ADMIN_BASE, '/settings/config')
}
export async function savePlatformConfig(data: PlatformConfigMap): Promise<null> {
  return req<null>(ADMIN_BASE, '/settings/config', { method: 'PUT', body: JSON.stringify(data) })
}

export interface AdminUserRow {
  id: string; name: string; email: string; role: string
  isActive: boolean; createdAt: string; lastLoginAt: string | null
}
export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  return req<AdminUserRow[]>(ADMIN_BASE, '/settings/admins')
}
export async function createAdminUser(data: { name: string; email: string; password: string }): Promise<AdminUserRow> {
  return req<AdminUserRow>(ADMIN_BASE, '/settings/admins', { method: 'POST', body: JSON.stringify(data) })
}
export async function deleteAdminUser(id: string): Promise<null> {
  return req<null>(ADMIN_BASE, `/settings/admins/${id}`, { method: 'DELETE' })
}
