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
}

export const usersApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/users${params ? '?' + new URLSearchParams(params) : ''}`),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (body: unknown) => api.post('/users', body),
  update: (id: string, body: unknown) => api.put(`/users/${id}`, body),
  remove: (id: string) => api.delete(`/users/${id}`),
}

export const tenantApi = {
  get: (id: string) => api.get(`/tenants/${id}`),
  update: (id: string, body: unknown) => api.put(`/tenants/${id}`, body),
  getInvoiceSettings: (id: string) => api.get(`/tenants/${id}/invoice-settings`),
  updateInvoiceSettings: (id: string, body: unknown) => api.patch(`/tenants/${id}/invoice-settings`, body),
}

export const productsApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/products${params ? '?' + new URLSearchParams(params) : ''}`),
  getById: (id: string) => api.get(`/products/${id}`),
  create: (body: unknown) => api.post('/products', body),
  update: (id: string, body: unknown) => api.put(`/products/${id}`, body),
  delete: (id: string) => api.delete(`/products/${id}`),
  categories: () => api.get('/products/categories'),
  brands: () => api.get('/products/brands'),
}

export const customersApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/customers${params ? '?' + new URLSearchParams(params) : ''}`),
  getById: (id: string) => api.get(`/customers/${id}`),
  create: (body: unknown) => api.post('/customers', body),
  update: (id: string, body: unknown) => api.put(`/customers/${id}`, body),
  search: (q: string) => api.get(`/customers/search?q=${encodeURIComponent(q)}`),
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
}

export const warrantyApi = {
  list: (params?: Record<string, string>) =>
    api.get(`/warranties${params ? '?' + new URLSearchParams(params) : ''}`),
  verify: (code: string) => api.get(`/warranties/verify/${code}`),
  create: (body: unknown) => api.post('/warranties', body),
  update: (id: string, body: unknown) => api.put(`/warranties/${id}`, body),
  remove: (id: string) => api.delete(`/warranties/${id}`),
  addClaim: (id: string, body: unknown) => api.post(`/warranties/${id}/claims`, body),
  sendEmail: (id: string, email?: string) => api.post(`/warranties/${id}/email`, { email }),
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
}
