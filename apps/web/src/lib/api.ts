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

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl()
}

/** Resolve product/logo upload URLs so localhost / relative paths work on prod. */
export function resolveUploadUrl(raw?: string | null): string | null {
  if (!raw || !String(raw).trim()) return null
  let url = String(raw).trim()
  if (url.startsWith('http://')) url = `https://${url.slice(7)}`

  const configured = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'
  let apiOrigin = 'http://localhost:3001'
  try {
    apiOrigin = new URL(configured).origin
  } catch {
    /* keep default */
  }

  if (url.startsWith('/uploads/')) return `${apiOrigin}${url}`

  try {
    const u = new URL(url)
    if (u.pathname.startsWith('/uploads/')) {
      return `${apiOrigin}${u.pathname}${u.search}`
    }
  } catch {
    /* keep as-is */
  }
  return url
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
    const payload = data.data as { accessToken: string; refreshToken?: string }
    authStorage.save(payload.accessToken, payload.refreshToken || refreshToken, user)
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
    // POS unlock/switch may historically return 401 for wrong PIN. That is NOT session expiry —
    // refreshing then failing would clear tokens and dump the cashier on /login mid-shift.
    const isPosPinGate =
      path.includes('/auth/pos-pin/unlock') || path.includes('/auth/pos-pin/switch')
    if (isPosPinGate) {
      const peek = res.clone()
      const { json: peekJson, text: peekText } = await parseResponseBody(peek)
      const peekMsg = responseErrorMessage(peekJson, peekText, '')
      if (/invalid pin|pin locked|too many pin|another cashier|use switch/i.test(peekMsg)) {
        const err: any = new Error(peekMsg || 'Invalid PIN')
        err.status = 401
        throw err
      }
    }

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
    err.code = typeof json.code === 'string' ? json.code : undefined
    if (
      err.code === 'ACCOUNT_SUSPENDED_PAYMENT'
      && typeof window !== 'undefined'
      && !window.location.pathname.startsWith('/dashboard/billing')
      && !window.location.pathname.includes('/settings')
      && !path.startsWith('/billing')
      && !path.startsWith('/tenants/me')
    ) {
      window.location.href = '/dashboard/settings?tab=billing&suspended=1'
    }
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
        shopUrl: string
        sessionCode: string
        whatsappSent?: boolean
        whatsappError?: string
      }
    }>('/auth/register', body),

  logout: () => {
    const refreshToken = authStorage.getRefreshToken()
    return api.post('/auth/logout', refreshToken ? { refreshToken } : {})
  },

  me: () => api.get<{ data: import('./auth').AuthUser }>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),

  /** Cold POS PIN login. Pass shopSlug when not on a tenant subdomain. */
  posPinLogin: (pin: string, shopSlug?: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const slug = (shopSlug || getTenantSlugFromHost() || '').trim().toLowerCase()
    if (slug) headers['x-tenant-id'] = slug
    return fetch(`${getApiBaseUrl()}/auth/pos-pin/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ pin }),
    }).then(async (res) => {
      const { json, text } = await parseResponseBody(res)
      if (!res.ok) {
        const err: any = new Error(responseErrorMessage(json, text, 'PIN login failed'))
        err.status = res.status
        throw err
      }
      return json as { data: { accessToken: string; refreshToken: string; user: import('./auth').AuthUser } }
    })
  },

  /** Public: whether shop shows PIN on login (Security policy). */
  posPinAvailability: (shopSlug?: string) => {
    const headers: Record<string, string> = {}
    const slug = (shopSlug || getTenantSlugFromHost() || '').trim().toLowerCase()
    if (slug) headers['x-tenant-id'] = slug
    return fetch(`${getApiBaseUrl()}/auth/pos-pin/availability`, { headers }).then(async (res) => {
      const { json, text } = await parseResponseBody(res)
      if (!res.ok) {
        throw new Error(responseErrorMessage(json, text, 'Failed to check PIN availability'))
      }
      const data = (json as any)?.data ?? json
      return {
        available: Boolean(data?.available),
        pinLength: (Number(data?.pinLength) === 4 ? 4 : 6) as 4 | 6,
      }
    })
  },

  posPinSwitch: (pin: string) =>
    api.post<{ data: { accessToken: string; refreshToken: string; user: import('./auth').AuthUser } }>(
      '/auth/pos-pin/switch',
      { pin },
    ),

  posPinUnlock: (pin: string) =>
    api.post<{ data: { unlocked: boolean; userId: string } }>('/auth/pos-pin/unlock', { pin }),

  posPinMyStatus: () =>
    api.get<{ data: { enabled: boolean; mustChange: boolean; updatedAt: string | null; locked: boolean; failedAttempts: number } }>(
      '/auth/pos-pin/me/status',
    ),

  setOwnPosPin: (body: { pin: string; currentPin?: string; currentPassword?: string }) =>
    api.post<{ data: { enabled: boolean } }>('/auth/pos-pin/me', body),
}

export const usersApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/users${params ? '?' + new URLSearchParams(params) : ''}`),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (body: unknown) => api.post('/users', body),
  update: (id: string, body: unknown) => api.put(`/users/${id}`, body),
  remove: (id: string) => api.delete(`/users/${id}`),
  posPinStatus: (id: string) =>
    api.get<{ data: { enabled: boolean; mustChange: boolean; updatedAt: string | null; locked: boolean; failedAttempts: number } }>(
      `/users/${id}/pos-pin`,
    ),
  resetPosPin: (id: string, body: { pin: string; mustChange?: boolean }) =>
    api.post<{ data: { enabled: boolean; mustChange: boolean } }>(`/users/${id}/pos-pin/reset`, body),
  disablePosPin: (id: string) =>
    api.post<{ data: { enabled: boolean } }>(`/users/${id}/pos-pin/disable`, {}),
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
  hirePurchaseDocument: async (
    agreementId: string,
    type: string,
    file: File,
    guarantorId?: string,
  ): Promise<{ id: string; fileUrl: string }> => {
    const form = new FormData()
    form.append('agreementId', agreementId)
    form.append('type', type)
    if (guarantorId) form.append('guarantorId', guarantorId)
    form.append('file', file)
    const headers: Record<string, string> = {}
    const token = authStorage.getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const branchId = getActiveBranchId()
    if (branchId) headers['x-active-branch-id'] = branchId
    const res = await fetch(`${getApiBaseUrl()}/upload/hire-purchase-document`, { method: 'POST', headers, body: form })
    const body = await res.json()
    if (!res.ok) throw new Error(body.message || 'Upload failed')
    return body.data
  },
}

export const tenantApi = {
  me: () => api.get('/tenants/me'),
  get: (id: string) => api.get(`/tenants/${id}`),
  update: (id: string, body: unknown) => api.put(`/tenants/${id}`, body),
  getInvoiceSettings: (id: string, branchId?: string) =>
    api.get(`/tenants/${id}/invoice-settings${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`),
  updateInvoiceSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/invoice-settings`, body),
  listInvoiceTemplates: () => api.get('/tenants/invoice-templates'),
  getReloadSettings: (id: string) => api.get(`/tenants/${id}/reload-settings`),
  updateReloadSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/reload-settings`, body),
  getPaymentMethodSettings: (id: string) => api.get(`/tenants/${id}/payment-method-settings`),
  updatePaymentMethodSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/payment-method-settings`, body),
  getProductVariantSettings: (id: string) => api.get(`/tenants/${id}/product-variant-settings`),
  updateProductVariantSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/product-variant-settings`, body),
  getProductCodeSettings: (id: string) => api.get(`/tenants/${id}/product-code-settings`),
  updateProductCodeSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/product-code-settings`, body),
  getPosUiSettings: (id: string) => api.get(`/tenants/${id}/pos-ui-settings`),
  updatePosUiSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/pos-ui-settings`, body),
  getPosPinSettings: (id: string) => api.get(`/tenants/${id}/pos-pin-settings`),
  updatePosPinSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/pos-pin-settings`, body),
  getRolePermissions: (id: string) => api.get(`/tenants/${id}/role-permissions`),
  updateRolePermissions: (id: string, body: unknown) => api.patch(`/tenants/${id}/role-permissions`, body),
  myRolePermissions: () => api.get('/tenants/me/role-permissions'),
  myFeatures: () => api.get<{ data: { features: Record<string, boolean>; prices: Record<string, number | null> } }>('/tenants/my-features'),
  updateMyFeatures: (features: Record<string, boolean>) =>
    api.patch<{ data: { features: Record<string, boolean>; prices: Record<string, number | null> } }>('/tenants/my-features', { features }),
  demoDataStatus: () => api.get('/tenants/me/demo-data'),
  clearDemoData: () => api.delete('/tenants/me/demo-data'),
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
  deleteBrand: (id: string, reassignToId?: string) =>
    api.delete(`/products/brands/${id}${reassignToId ? `?reassignToId=${encodeURIComponent(reassignToId)}` : ''}`),
  imeiHealth: () => api.get('/products/imei-health'),
  bulkInferTrackImei: () => api.post('/products/bulk-infer-track-imei', {}),
  nextCodes: () => api.get('/products/next-codes'),
  lookupCode: (code: string) => api.get(`/products/lookup?code=${encodeURIComponent(code)}`),
  importFromMaster: (body: unknown) => api.post('/products/import-from-master', body),
}

function traceabilityQs(params?: Record<string, string>) {
  return params ? '?' + new URLSearchParams(params) : ''
}

export const productTraceabilityApi = {
  summary: (productId: string, params?: Record<string, string>) =>
    api.get(`/product-traceability/${productId}/summary${traceabilityQs(params)}`),
  purchases: (productId: string, params?: Record<string, string>) =>
    api.get(`/product-traceability/${productId}/purchases${traceabilityQs(params)}`),
  sales: (productId: string, params?: Record<string, string>) =>
    api.get(`/product-traceability/${productId}/sales${traceabilityQs(params)}`),
  movements: (productId: string, params?: Record<string, string>) =>
    api.get(`/product-traceability/${productId}/movements${traceabilityQs(params)}`),
  transfers: (productId: string, params?: Record<string, string>) =>
    api.get(`/product-traceability/${productId}/transfers${traceabilityQs(params)}`),
  serials: (productId: string, params?: Record<string, string>) =>
    api.get(`/product-traceability/${productId}/serials${traceabilityQs(params)}`),
  timeline: (productId: string, params?: Record<string, string>) =>
    api.get(`/product-traceability/${productId}/timeline${traceabilityQs(params)}`),
}

export const masterCatalogApi = {
  listCategories: () => api.get('/master-catalog/categories'),
  listBrands: (type?: 'PHONE' | 'ACCESSORY', opts?: { withPhoneModels?: boolean; withAccessories?: boolean }) => {
    const q = new URLSearchParams()
    if (type) q.set('type', type)
    if (opts?.withPhoneModels) q.set('withPhoneModels', 'true')
    if (opts?.withAccessories) q.set('withAccessories', 'true')
    const qs = q.toString()
    return api.get(`/master-catalog/brands${qs ? `?${qs}` : ''}`)
  },
  listPhoneModels: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : ''
    return api.get(`/master-catalog/phone-models${qs}`)
  },
  getPhoneModel: (id: string) => api.get(`/master-catalog/phone-models/${id}`),
  listAccessories: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : ''
    return api.get(`/master-catalog/accessories${qs}`)
  },
}

export const inventoryApi = {
  listTransfers: (params?: Record<string, string>) =>
    api.get(`/inventory/transfers${params ? '?' + new URLSearchParams(params) : ''}`),
  listTransferImeis: (productId: string, fromBranchId: string, variationKey?: string) => {
    const q = new URLSearchParams({ productId, fromBranchId })
    if (variationKey) q.set('variationKey', variationKey)
    return api.get(`/inventory/transfer/imeis?${q}`)
  },
  previewTransfer: (productId: string, toBranchId: string, fromBranchId?: string, variationKey?: string) => {
    const q = new URLSearchParams({ productId, toBranchId })
    if (fromBranchId) q.set('fromBranchId', fromBranchId)
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
  unpaidInvoices: (id: string) => api.get(`/customers/${id}/unpaid-invoices`),
  creditPayment: (id: string, body: unknown) => api.post(`/customers/${id}/credit-payment`, body),
  setActive: (id: string, isActive: boolean) => api.patch(`/customers/${id}/active`, { isActive }),
  remove: (id: string) => api.delete(`/customers/${id}`),
}

export const salesApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/sales${params ? '?' + new URLSearchParams(params) : ''}`),
  getById: (id: string) => api.get(`/sales/${id}`),
  create: (body: unknown) => api.post('/sales', body),
  update: (id: string, body: unknown) => api.patch(`/sales/${id}`, body),
  void: (id: string, body: unknown) => api.post(`/sales/${id}/void`, body),
  processReturn: (saleId: string, body: unknown) => api.post(`/sales/${saleId}/returns`, body),
  listReturns: (params?: Record<string, string>) =>
    api.get(`/sales/returns${params ? '?' + new URLSearchParams(params) : ''}`),
}

export const repairsApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/repairs${params ? '?' + new URLSearchParams(params) : ''}`),
  getById: (id: string) => api.get(`/repairs/${id}`),
  create: (body: unknown) => api.post('/repairs', body),
  faultOptions: () => api.get('/repairs/fault-options'),
  createFaultOption: (name: string) => api.post('/repairs/fault-options', { name }),
  update: (id: string, body: unknown) => api.put(`/repairs/${id}`, body),
  updateStatus: (id: string, status: string, note?: string) =>
    api.patch(`/repairs/${id}/status`, { status, note }),
  addPart: (id: string, body: { productId: string; quantity: number; unitCost?: number }) =>
    api.post(`/repairs/${id}/parts`, body),
  removePart: (id: string, partId: string) =>
    api.delete(`/repairs/${id}/parts/${partId}`),
  collectPayment: (id: string, body: { discount?: number; paymentMethod: string; paidAmount?: number; reference?: string }) =>
    api.post(`/repairs/${id}/collect-payment`, body),
  updatePhotos: (id: string, photos: string[]) =>
    api.put(`/repairs/${id}/photos`, { photos }),
  addNote: (id: string, body: { text: string; isPublic?: boolean }) =>
    api.post(`/repairs/${id}/notes`, body),
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

export const hirePurchaseApi = {
  dashboard: () => api.get('/hire-purchase/dashboard'),
  agreements: (params?: Record<string, string>) =>
    api.get(`/hire-purchase/agreements${params ? `?${new URLSearchParams(params)}` : ''}`),
  agreement: (id: string) => api.get(`/hire-purchase/agreements/${id}`),
  calculate: (body: unknown) => api.post('/hire-purchase/calculate', body),
  createAgreement: (body: unknown) => api.post('/hire-purchase/agreements', body),
  createFromPos: (body: unknown) => api.post('/hire-purchase/from-pos', body),
  updateStatus: (id: string, status: string, reason?: string) =>
    api.patch(`/hire-purchase/agreements/${id}/status`, { status, reason }),
  collectPayment: (id: string, body: unknown) =>
    api.post(`/hire-purchase/agreements/${id}/payments`, body),
  reversePayment: (paymentId: string, reason?: string) =>
    api.post(`/hire-purchase/payments/${paymentId}/reverse`, { reason }),
  earlySettlementQuote: (id: string) =>
    api.get(`/hire-purchase/agreements/${id}/early-settlement`),
  earlySettlement: (id: string, body: unknown) =>
    api.post(`/hire-purchase/agreements/${id}/early-settlement`, body),
  dues: (scope: string) => api.get(`/hire-purchase/dues?scope=${encodeURIComponent(scope)}`),
  guarantors: () => api.get('/hire-purchase/guarantors'),
  addGuarantor: (agreementId: string, body: unknown) =>
    api.post(`/hire-purchase/agreements/${agreementId}/guarantors`, body),
  updateGuarantor: (id: string, body: unknown) =>
    api.patch(`/hire-purchase/guarantors/${id}`, body),
  deleteGuarantor: (id: string) => api.delete(`/hire-purchase/guarantors/${id}`),
  settings: () => api.get('/hire-purchase/settings'),
  updateSettings: (body: unknown) => api.patch('/hire-purchase/settings', body),
  report: (type: string, params?: Record<string, string>) =>
    api.get(`/hire-purchase/reports/${encodeURIComponent(type)}${params ? `?${new URLSearchParams(params)}` : ''}`),
  logs: () => api.get('/hire-purchase/logs'),
  applyPenalties: () => api.post('/hire-purchase/maintenance/apply-penalties', {}),
  sendReminders: (agreementIds: string[], channel: 'WHATSAPP' | 'EMAIL' | 'SMS' = 'WHATSAPP') =>
    api.post('/hire-purchase/reminders/send', { agreementIds, channel }),
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
  deletePO: (id: string) => api.delete(`/suppliers/purchase-orders/${id}`),
  getPoLabels: (id: string) => api.get(`/suppliers/purchase-orders/${id}/labels`),
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
  unpaidPurchaseOrders: (supplierId: string) => api.get(`/suppliers/${supplierId}/unpaid-purchase-orders`),
  payments: (params?: Record<string, string>) =>
    api.get(`/suppliers/payments${params ? '?' + new URLSearchParams(params) : ''}`),
  purchaseReturns: (params?: Record<string, string>) =>
    api.get(`/suppliers/purchase-returns${params ? '?' + new URLSearchParams(params) : ''}`),
  createPurchaseReturn: (body: {
    purchaseOrderId: string
    items: Array<{ poItemId: string; quantity: number; imei?: string | null }>
    reason: string
    settlementMethod?: string
    notes?: string | null
  }) => api.post('/suppliers/purchase-returns', body),
  getPurchaseReturn: (id: string) => api.get(`/suppliers/purchase-returns/${id}`),
}

export const financeApi = {
  transactions: (params?: Record<string, string>) =>
    api.get(`/finance/transactions${params ? '?' + new URLSearchParams(params) : ''}`),
  create: (body: unknown) => api.post('/finance/transactions', body),
  summary: (params?: Record<string, string>) =>
    api.get(`/finance/summary${params ? '?' + new URLSearchParams(params) : ''}`),
  plStatement: (params?: Record<string, string>) =>
    api.get(`/finance/pl-statement${params ? '?' + new URLSearchParams(params) : ''}`),
  paymentMethodCashflow: (params?: Record<string, string>) =>
    api.get(`/finance/payment-method-cashflow${params ? '?' + new URLSearchParams(params) : ''}`),
  dailySummaries: (params?: Record<string, string>) =>
    api.get(`/finance/daily-summaries${params ? '?' + new URLSearchParams(params) : ''}`),
}

export const accountingApi = {
  status: () => api.get('/accounting/status'),
  initialize: () => api.post('/accounting/initialize', {}),
  coaAccounts: () => api.get('/accounting/coa/accounts'),
  syncIntegration: (params?: Record<string, string>) =>
    api.post(`/accounting/integration/sync${params ? '?' + new URLSearchParams(params) : ''}`, {}),
  processIntegration: (body?: { limit?: number }) =>
    api.post('/accounting/integration/process', body ?? {}),
  outbox: (params?: Record<string, string>) =>
    api.get(`/accounting/integration/outbox${params ? '?' + new URLSearchParams(params) : ''}`),
  trialBalance: (params: Record<string, string>) =>
    api.get(`/accounting/reports/trial-balance?${new URLSearchParams(params)}`),
  profitLoss: (params: Record<string, string>) =>
    api.get(`/accounting/reports/profit-loss?${new URLSearchParams(params)}`),
  balanceSheet: (params: Record<string, string>) =>
    api.get(`/accounting/reports/balance-sheet?${new URLSearchParams(params)}`),
  cashFlow: (params: Record<string, string>) =>
    api.get(`/accounting/reports/cash-flow?${new URLSearchParams(params)}`),
  periods: () => api.get('/accounting/periods'),
  periodPreview: (id: string) => api.get(`/accounting/periods/${id}/preview`),
  softClosePeriod: (id: string) => api.post(`/accounting/periods/${id}/soft-close`, {}),
  hardClosePeriod: (id: string) => api.post(`/accounting/periods/${id}/hard-close`, {}),
  reopenPeriod: (id: string) => api.post(`/accounting/periods/${id}/reopen`, {}),
  arSummary: (params?: Record<string, string>) =>
    api.get(`/accounting/ar/summary${params ? '?' + new URLSearchParams(params) : ''}`),
  arCustomer: (customerId: string, params?: Record<string, string>) =>
    api.get(`/accounting/ar/customers/${customerId}${params ? '?' + new URLSearchParams(params) : ''}`),
  apSummary: (params?: Record<string, string>) =>
    api.get(`/accounting/ap/summary${params ? '?' + new URLSearchParams(params) : ''}`),
  apSupplier: (supplierId: string, params?: Record<string, string>) =>
    api.get(`/accounting/ap/suppliers/${supplierId}${params ? '?' + new URLSearchParams(params) : ''}`),
  recordArPayment: (body: {
    customerId: string
    branchId?: string
    amount: number
    paymentMethod: string
    reference?: string
    notes?: string
    bankAccountId?: string
    paymentAt?: string
    allocations?: Array<{ saleId: string; amount: number }>
  }) => api.post('/accounting/ar/payments', body),
  recordApPayment: (body: {
    supplierId: string
    branchId?: string
    amount: number
    paymentMethod: string
    reference?: string
    notes?: string
    bankAccountId?: string
    paymentAt?: string
    allocations?: Array<{ purchaseOrderId: string; amount: number }>
  }) => api.post('/accounting/ap/payments', body),
  journals: (params?: Record<string, string>) =>
    api.get(`/accounting/journals${params ? '?' + new URLSearchParams(params) : ''}`),
  journal: (id: string) => api.get(`/accounting/journals/${id}`),
  createManualJournal: (body: {
    branchId?: string
    entryDate: string
    memo?: string
    lines: Array<{
      accountId: string
      description?: string
      debit?: number
      credit?: number
      customerId?: string
      supplierId?: string
    }>
  }) => api.post('/accounting/journals/manual', body),
  reverseJournal: (id: string, body?: { memo?: string }) =>
    api.post(`/accounting/journals/${id}/reverse`, body ?? {}),
  pendingJournals: () => api.get('/accounting/journals/pending-approval'),
  approveJournal: (id: string) => api.post(`/accounting/journals/${id}/approve`, {}),
  rejectJournal: (id: string, body?: { reason?: string }) =>
    api.post(`/accounting/journals/${id}/reject`, body ?? {}),
  accountLedger: (accountId: string, params?: Record<string, string>) =>
    api.get(`/accounting/coa/accounts/${accountId}/ledger${params ? '?' + new URLSearchParams(params) : ''}`),
  updateGlAccount: (id: string, body: { name?: string; description?: string; isActive?: boolean }) =>
    api.patch(`/accounting/coa/accounts/${id}`, body),
  createGlAccount: (body: {
    code: string
    name: string
    type: string
    subtype?: string
    parentAccountId?: string
    branchId?: string
    description?: string
  }) => api.post('/accounting/coa/accounts', body),
  accountingSettings: () => api.get('/accounting/settings'),
  updateAccountingSettings: (body: Record<string, unknown>) => api.patch('/accounting/settings', body),
  cashBankRegisters: () => api.get('/accounting/cash-bank/registers'),
  createBankAccount: (body: {
    bankName: string
    accountType?: 'CURRENT' | 'SAVINGS'
    name?: string
    branchId?: string
    accountNo?: string
  }) => api.post('/accounting/cash-bank/accounts', body),
  cashBankTransfer: (body: {
    branchId?: string
    entryDate: string
    amount: number
    fromType: string
    toType: string
    fromId?: string
    toId?: string
    memo?: string
  }) => api.post('/accounting/cash-bank/transfers', body),
  settleClearing: (body: {
    branchId?: string
    entryDate: string
    clearingType: 'CARD' | 'UPI'
    amount: number
    bankAccountId?: string
    memo?: string
  }) => api.post('/accounting/cash-bank/settle-clearing', body),
  reconcileBank: (body: {
    branchId?: string
    entryDate: string
    statementBalance: number
    bankAccountId?: string
    memo?: string
  }) => api.post('/accounting/cash-bank/reconcile', body),
  taxCodes: () => api.get('/accounting/tax/codes'),
  vatSummary: (params: Record<string, string>) =>
    api.get(`/accounting/tax/vat-summary?${new URLSearchParams(params)}`),
  vatPayment: (body: {
    branchId?: string
    entryDate: string
    amount: number
    paymentMethod: string
    memo?: string
    from?: string
    to?: string
  }) => api.post('/accounting/tax/vat-payment', body),
  pettyCash: () => api.get('/accounting/petty-cash'),
  pettyCashExpense: (body: { branchId?: string; entryDate: string; amount: number; description: string; category?: string }) =>
    api.post('/accounting/petty-cash/expenses', body),
  replenishPettyCash: (body: { branchId?: string; entryDate: string; amount: number; memo?: string }) =>
    api.post('/accounting/petty-cash/replenish', body),
  payrollRuns: () => api.get('/accounting/payroll/runs'),
  payrollEmployees: () => api.get('/accounting/payroll/employees'),
  createPayrollRun: (body: {
    branchId?: string
    entryDate: string
    periodLabel: string
    applyStatutory?: boolean
    lines: Array<{ employeeName: string; userId?: string; amount: number }>
  }) => api.post('/accounting/payroll/runs', body),
  payPayrollRun: (runId: string, body: { branchId?: string; entryDate: string; paymentMethod: string; memo?: string }) =>
    api.post(`/accounting/payroll/runs/${runId}/pay`, body),
  postStatutoryRemittance: (body: {
    type: 'EPF' | 'ETF'
    amount: number
    branchId?: string
    entryDate: string
    paymentMethod: string
    memo?: string
  }) => api.post('/accounting/payroll/statutory-remittance', body),
  auditEvents: (params?: Record<string, string>) =>
    api.get(`/accounting/audit${params ? '?' + new URLSearchParams(params) : ''}`),
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
  normalizePercentages: (body: { branchId: string }) =>
    api.post('/profit-allocation/funds/normalize-percentages', body),
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
  repairsByStatus: (params?: Record<string, string>) =>
    api.get(`/analytics/repairs-by-status${params ? '?' + new URLSearchParams(params) : ''}`),
  inventorySummary: (params?: Record<string, string>) =>
    api.get(`/analytics/inventory-summary${params ? '?' + new URLSearchParams(params) : ''}`),
  deliverySummary: (params?: Record<string, string>) =>
    api.get(`/analytics/delivery-summary${params ? '?' + new URLSearchParams(params) : ''}`),
  categorySales: (params?: Record<string, string>) =>
    api.get(`/analytics/category-sales${params ? '?' + new URLSearchParams(params) : ''}`),
  categoryProducts: (params?: Record<string, string>) =>
    api.get(`/analytics/category-products${params ? '?' + new URLSearchParams(params) : ''}`),
  customerSales: (params?: Record<string, string>) =>
    api.get(`/analytics/customer-sales${params ? '?' + new URLSearchParams(params) : ''}`),
  customerSalesDetail: (params?: Record<string, string>) =>
    api.get(`/analytics/customer-sales-detail${params ? '?' + new URLSearchParams(params) : ''}`),
  purchaseReport: (params?: Record<string, string>) =>
    api.get(`/analytics/purchase-report${params ? '?' + new URLSearchParams(params) : ''}`),
  purchaseReportDetail: (params?: Record<string, string>) =>
    api.get(`/analytics/purchase-report-detail${params ? '?' + new URLSearchParams(params) : ''}`),
  paymentMethodCashflow: (params?: Record<string, string>) =>
    api.get(`/analytics/payment-method-cashflow${params ? '?' + new URLSearchParams(params) : ''}`),
}

export type PlatformAnnouncement = {
  id: string
  title: string
  body: string
  type: string
  sentAt: string | null
  dismissible?: boolean
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

export type FeatureSuggestionStatus =
  | 'NEW'
  | 'UNDER_REVIEW'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'RELEASED'
  | 'DECLINED'

export type FeatureSuggestionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type FeatureSuggestionCategory =
  | 'POS'
  | 'Inventory'
  | 'Sales'
  | 'Purchasing'
  | 'Repairs'
  | 'Customers'
  | 'Suppliers'
  | 'Accounting'
  | 'Reports'
  | 'Dashboard'
  | 'Mobile App'
  | 'Printing'
  | 'Barcode'
  | 'Integrations'
  | 'Performance'
  | 'Security'
  | 'Other'

export type FeatureSuggestionHistory = {
  id: string
  action: string
  oldStatus: FeatureSuggestionStatus | null
  newStatus: FeatureSuggestionStatus | null
  oldPriority: FeatureSuggestionPriority | null
  newPriority: FeatureSuggestionPriority | null
  publicResponse: string | null
  performedByEmail: string
  createdAt: string
}

export type FeatureSuggestion = {
  id: string
  category: string
  title: string
  description: string
  status: FeatureSuggestionStatus
  priority: FeatureSuggestionPriority
  publicResponse: string | null
  createdAt: string
  updatedAt: string
  /** Admin replied or changed status — not opened yet */
  hasUnreadUpdate?: boolean
  history?: FeatureSuggestionHistory[]
}

export type UserNotification = {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  relatedId: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

export type CreateFeatureSuggestionBody = {
  category: FeatureSuggestionCategory
  title: string
  description: string
}

export const featureSuggestionsApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const p = new URLSearchParams()
    if (params?.page) p.set('page', String(params.page))
    if (params?.limit) p.set('limit', String(params.limit))
    const qs = p.toString()
    return api.get<{
      data: FeatureSuggestion[]
      meta: { total: number; page: number; limit: number; totalPages: number }
    }>(`/feature-suggestions${qs ? `?${qs}` : ''}`)
  },
  getById: (id: string) =>
    api.get<{ data: FeatureSuggestion }>(`/feature-suggestions/${id}`),
  create: (body: CreateFeatureSuggestionBody) =>
    api.post<{ data: FeatureSuggestion }>('/feature-suggestions', body),
}

export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
export type SupportTicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type SupportTicketCategory = 'BUG' | 'BILLING' | 'HOW_TO' | 'ACCOUNT' | 'FEATURE' | 'OTHER'

export type SupportTicket = {
  id: string
  ticketNumber: string
  subject: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  category: SupportTicketCategory
  slaDueAt: string
  slaBreached?: boolean
  assigneeAdminEmail?: string | null
  createdAt: string
  messages?: Array<{
    id: string
    body: string
    isInternal?: boolean
    authorType: string
    authorEmail: string
    createdAt: string
  }>
  attachments?: Array<{ id: string; fileName: string; url: string }>
}

export type SupportChatSession = {
  id: string
  status: 'WAITING' | 'ACTIVE' | 'ENDED'
  subject?: string | null
  assigneeAdminEmail?: string | null
  lastMessageAt: string
  messages?: Array<{
    id: string
    body: string
    authorType: string
    authorEmail: string
    createdAt: string
  }>
  ticket?: { id: string; ticketNumber: string } | null
  tenant?: { id: string; name: string; slug: string }
  startedBy?: { id: string; name: string; email: string }
}

export const supportTicketsApi = {
  list: (params?: Record<string, string>) =>
    api.get<{ data: SupportTicket[]; meta: { total: number; page: number; limit: number } }>(
      `/support-tickets${params ? '?' + new URLSearchParams(params) : ''}`,
    ),
  get: (id: string) => api.get<{ data: SupportTicket }>(`/support-tickets/${id}`),
  create: (body: {
    subject: string
    body: string
    category?: SupportTicketCategory
    priority?: SupportTicketPriority
  }) => api.post<{ data: SupportTicket }>('/support-tickets', body),
  reply: (id: string, body: string) =>
    api.post<{ data: SupportTicket }>(`/support-tickets/${id}/messages`, { body }),
  close: (id: string) => api.patch<{ data: SupportTicket }>(`/support-tickets/${id}/close`, {}),
}

export const supportChatApi = {
  start: (body?: { subject?: string; body?: string }) =>
    api.post<{ data: SupportChatSession }>('/support-chat/sessions', body ?? {}),
  mine: () => api.get<{ data: SupportChatSession[] }>('/support-chat/sessions/mine'),
  get: (id: string) => api.get<{ data: SupportChatSession }>(`/support-chat/sessions/${id}/messages`),
  send: (id: string, body: string) =>
    api.post<{ data: SupportChatSession['messages'] extends (infer M)[] | undefined ? M : never }>(
      `/support-chat/sessions/${id}/messages`,
      { body },
    ),
  end: (id: string) => api.post<{ data: SupportChatSession }>(`/support-chat/sessions/${id}/end`, {}),
}

export type CustomerServiceTicket = {
  id: string
  ticketNumber: string
  subject: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  customerId?: string | null
  createdAt: string
  messages?: Array<{
    id: string
    body: string
    authorType: string
    authorEmail: string
    createdAt: string
  }>
}

export const customerServiceTicketsApi = {
  list: (params?: Record<string, string>) =>
    api.get<{ data: CustomerServiceTicket[]; meta: { total: number } }>(
      `/customer-service-tickets${params ? '?' + new URLSearchParams(params) : ''}`,
    ),
  get: (id: string) => api.get<{ data: CustomerServiceTicket }>(`/customer-service-tickets/${id}`),
  create: (body: {
    subject: string
    body: string
    customerId?: string | null
    branchId?: string | null
    priority?: SupportTicketPriority
  }) => api.post<{ data: CustomerServiceTicket }>('/customer-service-tickets', body),
  reply: (id: string, body: string) =>
    api.post<{ data: CustomerServiceTicket }>(`/customer-service-tickets/${id}/messages`, { body }),
  patch: (id: string, body: { status?: SupportTicketStatus }) =>
    api.patch<{ data: CustomerServiceTicket }>(`/customer-service-tickets/${id}`, body),
}

export const hrApi = {
  overview: () => api.get('/hr/overview'),
  listDepartments: () => api.get('/hr/departments'),
  createDepartment: (body: unknown) => api.post('/hr/departments', body),
  updateDepartment: (id: string, body: unknown) => api.patch(`/hr/departments/${id}`, body),
  listDesignations: () => api.get('/hr/designations'),
  createDesignation: (body: unknown) => api.post('/hr/designations', body),
  updateDesignation: (id: string, body: unknown) => api.patch(`/hr/designations/${id}`, body),
  listEmployees: (params?: Record<string, string>) =>
    api.get(`/hr/employees${params ? '?' + new URLSearchParams(params) : ''}`),
  getEmployee: (id: string) => api.get(`/hr/employees/${id}`),
  createEmployee: (body: unknown) => api.post('/hr/employees', body),
  updateEmployee: (id: string, body: unknown) => api.patch(`/hr/employees/${id}`, body),
  linkUser: (id: string, userId: string | null) =>
    api.post(`/hr/employees/${id}/link-user`, { userId }),
  listShifts: (params?: Record<string, string>) =>
    api.get(`/hr/shifts${params ? '?' + new URLSearchParams(params) : ''}`),
  createShift: (body: unknown) => api.post('/hr/shifts', body),
  updateShift: (id: string, body: unknown) => api.patch(`/hr/shifts/${id}`, body),
  listShiftAssignments: (params?: Record<string, string>) =>
    api.get(`/hr/shift-assignments${params ? '?' + new URLSearchParams(params) : ''}`),
  assignShift: (body: unknown) => api.post('/hr/shift-assignments', body),
  attendanceBoard: (params?: Record<string, string>) =>
    api.get(`/hr/attendance/board${params ? '?' + new URLSearchParams(params) : ''}`),
  attendanceMyToday: () => api.get('/hr/attendance/my-today'),
  attendanceCheckIn: (body?: { employeeId?: string; note?: string }) =>
    api.post('/hr/attendance/check-in', body ?? {}),
  attendanceCheckOut: (body?: { employeeId?: string }) =>
    api.post('/hr/attendance/check-out', body ?? {}),
  attendanceCorrect: (body: unknown) => api.post('/hr/attendance/correct', body),
  listLeaveTypes: () => api.get('/hr/leave/types'),
  createLeaveType: (body: unknown) => api.post('/hr/leave/types', body),
  updateLeaveType: (id: string, body: unknown) => api.patch(`/hr/leave/types/${id}`, body),
  listLeaveBalances: (params?: Record<string, string>) =>
    api.get(`/hr/leave/balances${params ? '?' + new URLSearchParams(params) : ''}`),
  listLeaveRequests: (params?: Record<string, string>) =>
    api.get(`/hr/leave/requests${params ? '?' + new URLSearchParams(params) : ''}`),
  submitLeave: (body: unknown) => api.post('/hr/leave/requests', body),
  approveLeave: (id: string, body?: { reviewerNote?: string | null }) =>
    api.post(`/hr/leave/requests/${id}/approve`, body ?? {}),
  rejectLeave: (id: string, body?: { reviewerNote?: string | null }) =>
    api.post(`/hr/leave/requests/${id}/reject`, body ?? {}),
  cancelLeave: (id: string) => api.post(`/hr/leave/requests/${id}/cancel`, {}),
  listSalaryComponents: () => api.get('/hr/salary/components'),
  createSalaryComponent: (body: unknown) => api.post('/hr/salary/components', body),
  updateSalaryComponent: (id: string, body: unknown) => api.patch(`/hr/salary/components/${id}`, body),
  listSalaryPackages: (params?: Record<string, string>) =>
    api.get(`/hr/salary/packages${params ? '?' + new URLSearchParams(params) : ''}`),
  upsertSalaryPackage: (body: unknown) => api.post('/hr/salary/packages', body),
  previewSalaryPackage: (employeeId: string, asOf?: string) =>
    api.get(`/hr/salary/packages/${employeeId}/preview${asOf ? `?asOf=${asOf}` : ''}`),
  listCommissionRules: () => api.get('/hr/commission/rules'),
  createCommissionRule: (body: unknown) => api.post('/hr/commission/rules', body),
  updateCommissionRule: (id: string, body: unknown) => api.patch(`/hr/commission/rules/${id}`, body),
  commissionPreview: (params: Record<string, string>) =>
    api.get(`/hr/commission/preview?${new URLSearchParams(params)}`),
  listPayrollPeriods: () => api.get('/hr/payroll/periods'),
  createPayrollPeriod: (body: unknown) => api.post('/hr/payroll/periods', body),
  listPayrollRuns: (params?: Record<string, string>) =>
    api.get(`/hr/payroll/runs${params ? '?' + new URLSearchParams(params) : ''}`),
  getPayrollRun: (id: string) => api.get(`/hr/payroll/runs/${id}`),
  createPayrollRun: (body: unknown) => api.post('/hr/payroll/runs', body),
  processPayrollRun: (id: string) => api.post(`/hr/payroll/runs/${id}/process`, {}),
  approvePayrollRun: (id: string, body?: unknown) => api.post(`/hr/payroll/runs/${id}/approve`, body ?? {}),
  payPayrollRun: (id: string, body: unknown) => api.post(`/hr/payroll/runs/${id}/pay`, body),
  cancelPayrollRun: (id: string) => api.post(`/hr/payroll/runs/${id}/cancel`, {}),
  listPayslips: (params?: Record<string, string>) =>
    api.get(`/hr/payslips${params ? '?' + new URLSearchParams(params) : ''}`),
  listAdvances: (params?: Record<string, string>) =>
    api.get(`/hr/advances${params ? '?' + new URLSearchParams(params) : ''}`),
  requestAdvance: (body: unknown) => api.post('/hr/advances', body),
  approveAdvance: (id: string, body?: unknown) => api.post(`/hr/advances/${id}/approve`, body ?? {}),
  rejectAdvance: (id: string, body?: unknown) => api.post(`/hr/advances/${id}/reject`, body ?? {}),
  disburseAdvance: (id: string, body?: unknown) => api.post(`/hr/advances/${id}/disburse`, body ?? {}),
  listLoans: (params?: Record<string, string>) =>
    api.get(`/hr/loans${params ? '?' + new URLSearchParams(params) : ''}`),
  requestLoan: (body: unknown) => api.post('/hr/loans', body),
  approveLoan: (id: string, body?: unknown) => api.post(`/hr/loans/${id}/approve`, body ?? {}),
  rejectLoan: (id: string, body?: unknown) => api.post(`/hr/loans/${id}/reject`, body ?? {}),
  activateLoan: (id: string, body: unknown) => api.post(`/hr/loans/${id}/activate`, body),
}

export const notificationsApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const p = new URLSearchParams()
    if (params?.page) p.set('page', String(params.page))
    if (params?.limit) p.set('limit', String(params.limit))
    const qs = p.toString()
    return api.get<{
      data: {
        data: UserNotification[]
        total: number
        unreadCount: number
        page: number
        limit: number
      }
    }>(`/notifications${qs ? `?${qs}` : ''}`)
  },
  unread: (params?: { page?: number; limit?: number }) => {
    const p = new URLSearchParams()
    if (params?.page) p.set('page', String(params.page))
    if (params?.limit) p.set('limit', String(params.limit))
    const qs = p.toString()
    return api.get<{
      data: {
        data: UserNotification[]
        total: number
        unreadCount: number
        page: number
        limit: number
      }
    }>(`/notifications/unread${qs ? `?${qs}` : ''}`)
  },
  markRead: (id: string) =>
    api.patch<{ data: UserNotification }>(`/notifications/${id}/read`, {}),
  markRelatedRead: (relatedId: string) =>
    api.patch<{ data: { updated: number } }>(`/notifications/related/${relatedId}/read`, {}),
  unreadFeatureSuggestionCount: () =>
    api.get<{ data: { count: number } }>('/notifications/unread-count'),
  markAllRead: () =>
    api.patch<{ data: { updated: number } }>('/notifications/read-all', {}),
}

export async function fetchPlatformStatus(): Promise<PlatformStatus> {
  const res = await fetch(`${getApiBaseUrl()}/platform/status`)
  const { json, text } = await parseResponseBody(res)
  if (!res.ok) throw new Error(responseErrorMessage(json, text, 'Failed to load platform status'))
  return (json.data ?? json) as PlatformStatus
}

// ── Platform SaaS billing (subscription invoices) ─────────────────────────────
export const billingApi = {
  overview: () => api.get<{ data: any }>('/billing/overview'),
  config: () => api.get<{ data: any }>('/billing/config'),
  invoices: (params?: { status?: string; search?: string }) => {
    const p = new URLSearchParams()
    if (params?.status) p.set('status', params.status)
    if (params?.search) p.set('search', params.search)
    const qs = p.toString()
    return api.get<{ data: any[] }>(`/billing/invoices${qs ? `?${qs}` : ''}`)
  },
  invoice: (id: string) => api.get<{ data: any }>(`/billing/invoices/${id}`),
  submitPayment: (body: {
    invoiceId: string
    amount: number
    channel?: string
    methodLabel?: string
    paymentDate: string
    bankName?: string
    accountRef?: string
    transactionRef?: string
    slipUrl?: string
    slipFilename?: string
    notes?: string
  }) => api.post<{ data: any }>('/billing/payments', body),
  uploadSlip: async (file: File): Promise<{ url: string; filename: string }> => {
    const token = authStorage.getAccessToken()
    const form = new FormData()
    form.append('slip', file)
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const tenantSlug = getTenantSlugFromHost()
    if (tenantSlug) headers['x-tenant-id'] = tenantSlug
    const res = await fetch(`${getApiBaseUrl()}/billing/payments/slip`, {
      method: 'POST',
      headers,
      body: form,
    })
    const { json, text } = await parseResponseBody(res)
    if (!res.ok) throw new Error(responseErrorMessage(json, text, 'Slip upload failed'))
    return json.data as { url: string; filename: string }
  },
  downloadPdf: async (invoiceId: string, invoiceNumber: string, opts?: { openInTab?: boolean }) => {
    const token = authStorage.getAccessToken()
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const tenantSlug = getTenantSlugFromHost()
    if (tenantSlug) headers['x-tenant-id'] = tenantSlug
    const activeBranchId = getActiveBranchId()
    const branchScope = getBranchScope()
    if (activeBranchId) headers['x-active-branch-id'] = activeBranchId
    if (branchScope) headers['x-branch-scope'] = branchScope
    const res = await fetch(`${getApiBaseUrl()}/billing/invoices/${invoiceId}/pdf`, { headers })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || 'Failed to download invoice PDF')
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    if (opts?.openInTab) {
      window.open(url, '_blank', 'noopener,noreferrer')
      // Revoke later so the tab can load
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return
    }
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoiceNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
  createHelaposQr: (invoiceId: string) =>
    api.post<{ data: {
      paymentId: string
      invoiceId: string
      invoiceNumber: string
      amount: number
      subscriptionAmount: number
      processingFee: number
      customerPayableAmount: number
      expectedSettlementAmount: number
      feeApplies: boolean
      feeRate: number
      reference: string
      qrPayload: string
      mock: boolean
      status: string
      notifyUrl: string
      expiresAt?: string
    } }>(`/billing/invoices/${invoiceId}/helapos/qr`, {}),
  helaposQuote: (invoiceId: string) =>
    api.get<{ data: {
      invoiceId: string
      invoiceNumber: string
      subscriptionAmount: number
      processingFee: number
      customerPayableAmount: number
      expectedSettlementAmount: number
      feeApplies: boolean
      feeRate: number
    } }>(`/billing/invoices/${invoiceId}/helapos/quote`),
  helaposPaymentStatus: (paymentId: string) =>
    api.get<{ data: {
      paymentId: string
      status: string
      amount: number
      subscriptionAmount?: number
      processingFee?: number
      customerPayableAmount?: number
      settlementAmount?: number
      feeApplies?: boolean
      reference: string | null
      paid: boolean
      mock: boolean
      qrPayload: string | null
      invoice: { id: string; invoiceNumber: string; status: string; total: number; paidAt: string | null }
    } }>(`/billing/helapos/payments/${paymentId}`),
  helaposMockPay: (paymentId: string) =>
    api.post<{ data: any }>(`/billing/helapos/payments/${paymentId}/mock-pay`, {}),
  requestUpgrade: (targetPlan: 'STARTER' | 'PRO') =>
    api.post<{ data: {
      invoice: any
      reused: boolean
      fromPlan: string
      targetPlan: string
      amount: number
      targetMrr: number
    } }>('/billing/upgrade', { targetPlan }),
}

