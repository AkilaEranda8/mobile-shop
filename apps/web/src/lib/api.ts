import { authStorage } from './auth'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = authStorage.getRefreshToken()
  if (!refreshToken) return null
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) { authStorage.clear(); return null }
    const data = await res.json()
    const user = authStorage.getUser()!
    authStorage.save(data.data.accessToken, data.data.refreshToken, user)
    return data.data.accessToken
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

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken()
    if (newToken) return request<T>(path, options, false)
    authStorage.clear()
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  const json = await res.json()
  if (!res.ok) {
    const err: any = new Error(json.message || 'Request failed')
    err.status = res.status
    throw err
  }
  return json
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
    const res = await fetch(`${BASE_URL}/upload/logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.message || 'Upload failed')
    return json.data
  },
  repairPhoto: async (file: File): Promise<{ url: string }> => {
    const token = authStorage.getAccessToken()
    const form = new FormData()
    form.append('photo', file)
    const res = await fetch(`${BASE_URL}/upload/repair-photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.message || 'Upload failed')
    return json.data
  },
  productImage: async (file: File): Promise<{ url: string }> => {
    const token = authStorage.getAccessToken()
    const form = new FormData()
    form.append('image', file)
    const res = await fetch(`${BASE_URL}/upload/product-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.message || 'Upload failed')
    return json.data
  },
}

export const tenantApi = {
  get: (id: string) => api.get(`/tenants/${id}`),
  update: (id: string, body: unknown) => api.put(`/tenants/${id}`, body),
  getInvoiceSettings: (id: string) => api.get(`/tenants/${id}/invoice-settings`),
  updateInvoiceSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/invoice-settings`, body),
  getReloadSettings: (id: string) => api.get(`/tenants/${id}/reload-settings`),
  updateReloadSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/reload-settings`, body),
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
  brands: () => api.get('/products/brands'),
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
  collectPayment: (id: string, body: { discount?: number; paymentMethod: string }) =>
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
  registerPoImei: (poId: string, items: { productId: string; branchId: string; imei: string }[]) =>
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
  uploadFile: async (file: File): Promise<{ imported: number }> => {
    const { authStorage } = await import('@/lib/auth')
    const token = authStorage.getAccessToken()
    const base = process.env.NEXT_PUBLIC_API_URL ?? ''
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${base}/daily-reloads/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.message ?? 'Upload failed')
    return json.data
  },
}

export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
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
