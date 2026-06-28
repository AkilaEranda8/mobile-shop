import { authStorage } from './auth'
import { getActiveBranchId, getBranchScope } from './active-branch'
import { getTenantSlugFromHost } from './tenant-context'

function resolveApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'
  if (typeof window === 'undefined') return configured
  const slug = getTenantSlugFromHost()
  if (!slug) return configured
  // Tenant shop URLs load API via same host (/api → nginx → backend).
  return `${window.location.origin}/api/v1`
}

function getApiBaseUrl(): string {
  return resolveApiBaseUrl()
}

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

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = authStorage.getRefreshToken()
  if (!refreshToken) return null
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) { authStorage.clear(); return null }
    const { json: data } = await parseResponseBody(res)
    const user = authStorage.getUser()!
    const payload = data.data as { accessToken: string; refreshToken: string }
    authStorage.save(payload.accessToken, payload.refreshToken, user)
    return payload.accessToken
  } catch {
    authStorage.clear()
    return null
  }
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = authStorage.getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const tenantSlug = getTenantSlugFromHost()
  if (tenantSlug) headers['x-tenant-id'] = tenantSlug
  const activeBranchId = getActiveBranchId()
  const branchScope = getBranchScope()
  if (activeBranchId) headers['x-active-branch-id'] = activeBranchId
  if (branchScope) headers['x-branch-scope'] = branchScope

  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers })

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken()
    if (newToken) return request<T>(path, options, false)
    authStorage.clear()
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  const { json, text } = await parseResponseBody(res)
  if (!res.ok) {
    const err: any = new Error(responseErrorMessage(json, text))
    err.status = res.status
    throw err
  }
  return json as T
}

export const api = {
  get: <T = unknown>(path: string) =>
    request<T>(path, { method: 'GET' }),

  post: <T = unknown>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  put: <T = unknown>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),

  patch: <T = unknown>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T = unknown>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ data: { accessToken: string; refreshToken: string; user: import('./auth').AuthUser } }>(
      '/auth/login', { email, password }
    ),

  register: (body: {
    ownerName: string
    ownerEmail: string
    password: string
    shopName: string
    plan?: 'STARTER' | 'PRO' | 'ENTERPRISE'
    phone?: string
    city?: string
  }) =>
    api.post<{
      data: {
        accessToken: string
        refreshToken: string
        user: import('./auth').AuthUser
        tenant: { id: string; name: string; slug: string; plan: string; status: string; trialEndsAt: string }
        subdomain: string
      }
    }>('/auth/register', body),

  logout: () => api.post('/auth/logout', {}),

  me: () => api.get<{ data: import('./auth').AuthUser }>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),
}

export const usersApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/users${params ? '?' + new URLSearchParams(params) : ''}`),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (body: unknown) => api.post('/users', body),
  update: (id: string, body: unknown) => api.put(`/users/${id}`, body),
  remove: (id: string) => api.delete(`/users/${id}`),
}

export const uploadApi = {
  logo: async (file: File): Promise<{ url: string }> => {
    const token = authStorage.getAccessToken()
    const form = new FormData()
    form.append('logo', file)
    const res = await fetch(`${getApiBaseUrl()}/upload/logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const { json, text } = await parseResponseBody(res)
    if (!res.ok) throw new Error(responseErrorMessage(json, text, 'Upload failed'))
    return json.data as { url: string }
  },
  repairPhoto: async (file: File): Promise<{ url: string }> => {
    const token = authStorage.getAccessToken()
    const form = new FormData()
    form.append('photo', file)
    const res = await fetch(`${getApiBaseUrl()}/upload/repair-photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const { json, text } = await parseResponseBody(res)
    if (!res.ok) throw new Error(responseErrorMessage(json, text, 'Upload failed'))
    return json.data as { url: string }
  },
  productImage: async (file: File): Promise<{ url: string }> => {
    const token = authStorage.getAccessToken()
    const form = new FormData()
    form.append('image', file)
    const res = await fetch(`${getApiBaseUrl()}/upload/product-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const { json, text } = await parseResponseBody(res)
    if (!res.ok) throw new Error(responseErrorMessage(json, text, 'Upload failed'))
    return json.data as { url: string }
  },
}

export const tenantApi = {
  me: () => api.get('/tenants/me'),
  get: (id: string) => api.get(`/tenants/${id}`),
  update: (id: string, body: unknown) => api.put(`/tenants/${id}`, body),
  getInvoiceSettings: (id: string, branchId?: string) =>
    api.get(`/tenants/${id}/invoice-settings${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`),
  updateInvoiceSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/invoice-settings`, body),
  getReloadSettings: (id: string) => api.get(`/tenants/${id}/reload-settings`),
  updateReloadSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/reload-settings`, body),
  getProductVariantSettings: (id: string) => api.get(`/tenants/${id}/product-variant-settings`),
  updateProductVariantSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/product-variant-settings`, body),
  myFeatures: () => api.get<{ data: { features: Record<string, boolean>; prices: Record<string, number | null> } }>('/tenants/my-features'),
  updateMyFeatures: (features: Record<string, boolean>) =>
    api.patch<{ data: { features: Record<string, boolean>; prices: Record<string, number | null> } }>('/tenants/my-features', { features }),
}

export const servicesApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/services${params ? '?' + new URLSearchParams(params) : ''}`),
  categories: () => api.get<string[]>('/services/categories'),
  getById: (id: string) => api.get(`/services/${id}`),
  create: (body: unknown) => api.post('/services', body),
  update: (id: string, body: unknown) => api.put(`/services/${id}`, body),
  delete: (id: string) => api.delete(`/services/${id}`),
}

export const productsApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/products${params ? '?' + new URLSearchParams(params) : ''}`),
  getById: (id: string) => api.get(`/products/${id}`),
  create: (body: unknown) => api.post('/products', body),
  update: (id: string, body: unknown) => api.put(`/products/${id}`, body),
  delete: (id: string) => api.delete(`/products/${id}`),
  categories: () => api.get('/products/categories'),
  createCategory: (body: { name: string; icon?: string }) => api.post('/products/categories', body),
  deleteCategory: (id: string, reassignToId?: string) =>
    api.delete(`/products/categories/${id}${reassignToId ? `?reassignToId=${encodeURIComponent(reassignToId)}` : ''}`),
  brands: () => api.get('/products/brands'),
  createBrand: (body: { name: string }) => api.post('/products/brands', body),
  imeiHealth: () => api.get('/products/imei-health'),
  bulkInferTrackImei: () => api.post('/products/bulk-infer-track-imei', {}),
}

export const inventoryApi = {
  listTransfers: (params?: Record<string, string>) =>
    api.get(`/inventory/transfers${params ? '?' + new URLSearchParams(params) : ''}`),
  listTransferImeis: (productId: string, fromBranchId: string, variationKey?: string) => {
    const q = new URLSearchParams({ productId, fromBranchId })
    if (variationKey) q.set('variationKey', variationKey)
    return api.get(`/inventory/transfer/imeis?${q}`)
  },
  previewTransfer: (productId: string, toBranchId: string, variationKey?: string) => {
    const q = new URLSearchParams({ productId, toBranchId })
    if (variationKey) q.set('variationKey', variationKey)
    return api.get(`/inventory/transfer/preview?${q}`)
  },
  transfer: (body: {
    productId: string
    fromBranchId: string
    toBranchId: string
    quantity: number
    notes?: string
    variationKey?: string
    imeis?: string[]
  }) => api.post('/inventory/transfer', body),
}

export const customersApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/customers${params ? '?' + new URLSearchParams(params) : ''}`),
  getById: (id: string) => api.get(`/customers/${id}`),
  create: (body: unknown) => api.post('/customers', body),
  update: (id: string, body: unknown) => api.put(`/customers/${id}`, body),
  search: (q: string) => api.get(`/customers/search?q=${encodeURIComponent(q)}`),
  creditPayment: (id: string, body: unknown) => api.post(`/customers/${id}/credit-payment`, body),
}

export const salesApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/sales${params ? '?' + new URLSearchParams(params) : ''}`),
  getById: (id: string) => api.get(`/sales/${id}`),
  create: (body: unknown) => api.post('/sales', body),
  processReturn: (saleId: string, body: unknown) => api.post(`/sales/${saleId}/returns`, body),
  listReturns: (params?: Record<string, string>) =>
    api.get(`/sales/returns${params ? '?' + new URLSearchParams(params) : ''}`),
}

export const repairsApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/repairs${params ? '?' + new URLSearchParams(params) : ''}`),
  getById: (id: string) => api.get(`/repairs/${id}`),
  create: (body: unknown) => api.post('/repairs', body),
  update: (id: string, body: unknown) => api.put(`/repairs/${id}`, body),
  updateStatus: (id: string, status: string, note?: string) =>
    api.patch(`/repairs/${id}/status`, { status, note }),
  addPart: (id: string, body: { productId: string; quantity: number; unitCost?: number }) =>
    api.post(`/repairs/${id}/parts`, body),
  removePart: (id: string, partId: string) =>
    api.delete(`/repairs/${id}/parts/${partId}`),
  collectPayment: (id: string, body: { discount?: number; paymentMethod: string; paidAmount?: number }) =>
    api.post(`/repairs/${id}/collect-payment`, body),
  updatePhotos: (id: string, photos: string[]) =>
    api.put(`/repairs/${id}/photos`, { photos }),
}

export const deviceCatalogApi = {
  listBrands: () => api.get('/device-catalog/brands'),
  createBrand: (name: string) => api.post('/device-catalog/brands', { name }),
  deleteBrand: (id: string) => api.delete(`/device-catalog/brands/${id}`),
  listModels: (brandId?: string) =>
    api.get(`/device-catalog/models${brandId ? `?brandId=${brandId}` : ''}`),
  createModel: (brandId: string, name: string) => api.post('/device-catalog/models', { brandId, name }),
  deleteModel: (id: string) => api.delete(`/device-catalog/models/${id}`),
}

export const warrantyApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/warranties${params ? '?' + new URLSearchParams(params) : ''}`),
  verify: (code: string) => api.get(`/warranties/verify/${code}`),
  verifyPublic: async (code: string) => {
    const res = await fetch(`${resolveApiBaseUrl()}/warranties/verify/${encodeURIComponent(code)}`)
    const text = await res.text()
    const json = text ? JSON.parse(text) : {}
    if (!res.ok) throw new Error(json.message || 'Warranty not found')
    return (json.data ?? json) as {
      warrantyCode: string; status: string; productName: string; brandName: string
      imei?: string | null; customerName: string; startDate: string; endDate: string
      monthsDuration: number; invoiceNumber?: string | null; shopName: string
    }
  },
  create: (body: unknown) => api.post('/warranties', body),
  update: (id: string, body: unknown) => api.put(`/warranties/${id}`, body),
  remove: (id: string) => api.delete(`/warranties/${id}`),
  addClaim: (id: string, body: unknown) => api.post(`/warranties/${id}/claims`, body),
  updateClaim: (id: string, claimId: string, body: unknown) => api.put(`/warranties/${id}/claims/${claimId}`, body),
  sendEmail: (id: string, email?: string) => api.post(`/warranties/${id}/email`, { email }),
}

export const branchesApi = {
  list: () => api.get('/branches'),
  create: (body: unknown) => api.post('/branches', body),
  update: (id: string, body: unknown) => api.put(`/branches/${id}`, body),
}

export const suppliersApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/suppliers${params ? '?' + new URLSearchParams(params) : ''}`),
  create: (body: unknown) => api.post('/suppliers', body),
  update: (id: string, body: unknown) => api.put(`/suppliers/${id}`, body),
  purchaseOrders: (params?: Record<string, string>) =>
    api.get(`/suppliers/purchase-orders${params ? '?' + new URLSearchParams(params) : ''}`),
  createPO: (body: unknown) => api.post('/suppliers/purchase-orders', body),
  updatePO: (id: string, body: unknown) => api.put(`/suppliers/purchase-orders/${id}`, body),
  registerPoImei: (poId: string, items: {
    productId?: string
    productName?: string
    branchId: string
    imei: string
    variation?: string | null
    poItemId?: string
  }[]) =>
    api.post(`/suppliers/purchase-orders/${poId}/register-imei`, { items }),
  recordPayment: (supplierId: string, body: unknown) => api.post(`/suppliers/${supplierId}/payments`, body),
}

export const financeApi = {
  transactions: (params?: Record<string, string>) =>
    api.get(`/finance/transactions${params ? '?' + new URLSearchParams(params) : ''}`),
  create: (body: unknown) => api.post('/finance/transactions', body),
  summary: (params?: Record<string, string>) =>
    api.get(`/finance/summary${params ? '?' + new URLSearchParams(params) : ''}`),
  dailySummaries: (params?: Record<string, string>) =>
    api.get(`/finance/daily-summaries${params ? '?' + new URLSearchParams(params) : ''}`),
}

export const dailyClosingApi = {
  preview: (params: Record<string, string>) =>
    api.get(`/daily-closing/preview?${new URLSearchParams(params)}`),
  list: (params?: Record<string, string>) =>
    api.get(`/daily-closing${params ? '?' + new URLSearchParams(params) : ''}`),
  saveDraft: (body: unknown) => api.post('/daily-closing/draft', body),
  saveCashCount: (body: unknown) => api.post('/daily-closing/cash-count', body),
  close: (body: unknown) => api.post('/daily-closing/close', body),
  reopen: (body: unknown) => api.post('/daily-closing/reopen', body),
  dayStartStatus: (params: Record<string, string>) =>
    api.get(`/daily-closing/day-start?${new URLSearchParams(params)}`),
  startDay: (body: unknown) => api.post('/daily-closing/day-start', body),
  saveOpeningCash: (body: unknown) => api.post('/daily-closing/opening-cash', body),
}

export const profitAllocationApi = {
  dashboard: (params: Record<string, string>) =>
    api.get(`/profit-allocation/dashboard?${new URLSearchParams(params)}`),
  calculate: (body: unknown) => api.post('/profit-allocation/calculate', body),
  save: (body: unknown) => api.post('/profit-allocation/save', body),
  resave: (body: unknown) => api.post('/profit-allocation/resave', body),
  deleteAllocation: (date: string, branchId: string) =>
    api.delete(`/profit-allocation/allocations/${date}?branchId=${encodeURIComponent(branchId)}`),
  categoryTable: (params: Record<string, string>) =>
    api.get(`/profit-allocation/category-table?${new URLSearchParams(params)}`),
  funds: (params: Record<string, string>) =>
    api.get(`/profit-allocation/funds?${new URLSearchParams(params)}`),
  createFund: (body: unknown) => api.post('/profit-allocation/funds', body),
  updateFund: (id: string, body: unknown) => api.put(`/profit-allocation/funds/${id}`, body),
  deleteFund: (id: string) => api.delete(`/profit-allocation/funds/${id}`),
  toggleFund: (id: string, isActive: boolean) =>
    api.patch(`/profit-allocation/funds/${id}/toggle`, { isActive }),
  transactions: (params?: Record<string, string>) =>
    api.get(`/profit-allocation/transactions${params ? '?' + new URLSearchParams(params) : ''}`),
  withdraw: (body: unknown) => api.post('/profit-allocation/withdraw', body),
  deposit: (body: unknown) => api.post('/profit-allocation/deposit', body),
  adjustment: (body: unknown) => api.post('/profit-allocation/adjustment', body),
  monthlySummary: (params: Record<string, string>) =>
    api.get(`/profit-allocation/monthly-summary?${new URLSearchParams(params)}`),
  periodSummary: (params: Record<string, string>) =>
    api.get(`/profit-allocation/period-summary?${new URLSearchParams(params)}`),
}

export const imeiApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/imei${params ? '?' + new URLSearchParams(params) : ''}`),
  lookup: (imei: string) => api.get(`/imei/lookup/${imei}`),
  create: (body: unknown) => api.post('/imei', body),
  updateStatus: (id: string, status: string) => api.patch(`/imei/${id}/status`, { status }),
}

export const plansApi = {
  list: () => api.get('/plans'),
}

export const exchangesApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/exchanges${params ? '?' + new URLSearchParams(params) : ''}`),
  create: (body: unknown) => api.post('/exchanges', body),
  complete: (body: unknown) => api.post('/exchanges/complete', body),
  listAvailableStock: (params?: { search?: string; excludeImei?: string }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.excludeImei) q.set('excludeImei', params.excludeImei)
    const qs = q.toString()
    return api.get(`/exchanges/available-stock${qs ? `?${qs}` : ''}`)
  },
  getById: (id: string) => api.get(`/exchanges/${id}`),
  update: (id: string, body: unknown) => api.put(`/exchanges/${id}`, body),
  remove: (id: string) => api.delete(`/exchanges/${id}`),
}

export const dailyReloadApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/daily-reloads${params ? '?' + new URLSearchParams(params) : ''}`),
  create: (body: unknown) => api.post('/daily-reloads', body),
  bulkImport: (rows: unknown[]) => api.post('/daily-reloads/bulk', { rows }),
  remove: (id: string) => api.delete(`/daily-reloads/${id}`),
  getReport: (params?: Record<string, string>) =>
    api.get(`/daily-reloads/report${params ? '?' + new URLSearchParams(params) : ''}`),
  payProvider: (body: { date: string; provider: string; amount?: number; paymentMethod?: string; branchId?: string }) =>
    api.post('/daily-reloads/pay-provider', body),
  uploadFile: async (file: File): Promise<{ imported: number }> => {
    const { authStorage } = await import('@/lib/auth')
    const token = authStorage.getAccessToken()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${getApiBaseUrl()}/daily-reloads/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const { json, text } = await parseResponseBody(res)
    if (!res.ok) throw new Error(responseErrorMessage(json, text, 'Upload failed'))
    return json.data as { imported: number }
  },
}

export const analyticsApi = {
  dashboard: (params?: Record<string, string>) =>
    params ? api.get(`/analytics/dashboard?${new URLSearchParams(params)}`) : api.get('/analytics/dashboard'),
  revenue: (params?: Record<string, string>) =>
    api.get(`/analytics/revenue${params ? '?' + new URLSearchParams(params) : ''}`),
  topProducts: (params?: Record<string, string>) =>
    api.get(`/analytics/top-products${params ? '?' + new URLSearchParams(params) : ''}`),
  repairsByStatus: () => api.get('/analytics/repairs-by-status'),
  inventorySummary: () => api.get('/analytics/inventory-summary'),
  deliverySummary: (params?: Record<string, string>) =>
    api.get(`/analytics/delivery-summary${params ? '?' + new URLSearchParams(params) : ''}`),
  categorySales: (params?: Record<string, string>) =>
    api.get(`/analytics/category-sales${params ? '?' + new URLSearchParams(params) : ''}`),
  categoryProducts: (params?: Record<string, string>) =>
    api.get(`/analytics/category-products${params ? '?' + new URLSearchParams(params) : ''}`),
}

export type PlatformAnnouncement = {
  id: string
  title: string
  body: string
  type: string
  sentAt: string | null
}

export type PlatformStatus = {
  maintenance: { enabled: boolean; message: string }
  announcements: PlatformAnnouncement[]
}

export const platformApi = {
  listAnnouncements: () => api.get('/platform/announcements'),
  dismissAnnouncement: (id: string) => api.post(`/platform/announcements/${id}/dismiss`, {}),
}

export type ReleaseItem = {
  id: string
  category: string
  module: string | null
  featureName: string
  description: string
  badge: string | null
  displayOrder: number
  imageUrl: string | null
  videoUrl: string | null
  docUrl: string | null
}

export type ReleaseNote = {
  id: string
  version: string
  title: string
  summary: string
  releaseDate: string
  status: string
  popupEnabled: boolean
  active: boolean
  imageUrl: string | null
  videoUrl: string | null
  docUrl: string | null
  items: ReleaseItem[]
  counts: {
    newFeatures: number
    improvements: number
    bugFixes: number
    securityUpdates: number
    comingSoon: number
  }
  isRead: boolean
  readAt: string | null
}

export type ReleasePopup = {
  id: string
  version: string
  title: string
  summary: string
  releaseDate: string
}

export const releaseNotesApi = {
  list: (params?: { search?: string; category?: string; page?: number }) => {
    const p = new URLSearchParams()
    if (params?.search) p.set('search', params.search)
    if (params?.category) p.set('category', params.category)
    if (params?.page) p.set('page', String(params.page))
    const qs = p.toString()
    return api.get(`/release-notes${qs ? `?${qs}` : ''}`)
  },
  latest: () => api.get('/release-notes/latest'),
  unreadPopup: () => api.get('/release-notes/unread-popup'),
  getById: (id: string, category?: string) => {
    const qs = category ? `?category=${category}` : ''
    return api.get(`/release-notes/${id}${qs}`)
  },
  markRead: (id: string) => api.post(`/release-notes/${id}/read`, {}),
}

export async function fetchPlatformStatus(): Promise<PlatformStatus> {
  const res = await fetch(`${getApiBaseUrl()}/platform/status`)
  const { json, text } = await parseResponseBody(res)
  if (!res.ok) throw new Error(responseErrorMessage(json, text, 'Failed to load platform status'))
  return (json.data ?? json) as PlatformStatus
}
