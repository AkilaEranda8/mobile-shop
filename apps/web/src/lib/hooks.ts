'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  productsApi, customersApi, salesApi, repairsApi,
  warrantyApi, suppliersApi, financeApi, analyticsApi,
  imeiApi, usersApi, branchesApi, tenantApi, dailyReloadApi, dailyClosingApi, profitAllocationApi,
  fetchPlatformStatus, type PlatformStatus,
} from './api'
import { isFeatureEnabled, clearFeaturesCache, PRICED_FEATURES } from './tenant-features'
import { normalizeRepairTicket } from './repair.util'
import { getActiveBranchId } from './active-branch'
import { authStorage } from './auth'
import {
  DEFAULT_ROLE_PERMISSIONS,
  normalizeRolePermissions,
  canViewModule,
  canEditModule,
  getAccessForRole,
  type RolePermissionModuleKey,
} from './role-permissions'

/** Re-renders when the header branch switcher changes. */
export function useActiveBranchId(): string | undefined {
  const [branchId, setBranchId] = useState<string | undefined>(() => getActiveBranchId())
  useEffect(() => {
    const sync = () => setBranchId(getActiveBranchId())
    window.addEventListener('active-branch-changed', sync)
    return () => window.removeEventListener('active-branch-changed', sync)
  }, [])
  return branchId
}

const FEATURES_CACHE_KEY = 'hx_tenant_features'
const FEATURES_CACHE_TTL = 5 * 1000

type FeaturesCache = {
  features: Record<string, boolean>
  prices: Record<string, number | null>
}

function readCache(): FeaturesCache | null {
  try {
    const cached = localStorage.getItem(FEATURES_CACHE_KEY)
    if (!cached) return null
    const { data, ts } = JSON.parse(cached)
    if (Date.now() - ts >= FEATURES_CACHE_TTL) return null
    if (data?.features) return data as FeaturesCache
    return { features: data as Record<string, boolean>, prices: {} }
  } catch {
    return null
  }
}

export function useTenantFeatures() {
  const [features, setFeatures] = useState<Record<string, boolean>>(() => readCache()?.features ?? {})
  const [featurePrices, setFeaturePrices] = useState<Record<string, number | null>>(() => readCache()?.prices ?? {})

  const loadFeatures = useCallback(() => {
    return tenantApi.myFeatures().then((res: any) => {
      const raw = res?.data ?? res
      const feat = raw?.features && typeof raw.features === 'object' ? raw.features : raw
      const prices = raw?.prices && typeof raw.prices === 'object' ? raw.prices : {}
      if (feat && typeof feat === 'object') {
        setFeatures(feat)
        setFeaturePrices(prices)
        try {
          localStorage.setItem(FEATURES_CACHE_KEY, JSON.stringify({
            data: { features: feat, prices },
            ts: Date.now(),
          }))
        } catch { /* noop */ }
      }
      return feat
    })
  }, [])

  useEffect(() => {
    loadFeatures().catch(() => {})
  }, [loadFeatures])

  useEffect(() => {
    const refresh = () => { loadFeatures().catch(() => {}) }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh()
    })
    return () => {
      window.removeEventListener('focus', refresh)
    }
  }, [loadFeatures])

  const hasFeature = useCallback(
    (f: string) => isFeatureEnabled(features, f),
    [features],
  )

  const refetchFeatures = useCallback(() => {
    clearFeaturesCache()
    return loadFeatures().catch(() => {})
  }, [loadFeatures])

  return { features, featurePrices, hasFeature, refetchFeatures }
}

export function useFeatureFlag(feature: string): boolean {
  const { hasFeature } = useTenantFeatures()
  return hasFeature(feature)
}

const ROLE_PERMS_CACHE_KEY = 'hx_role_permissions'

export function useRolePermissions() {
  const [matrix, setMatrix] = useState(() => {
    try {
      const raw = localStorage.getItem(ROLE_PERMS_CACHE_KEY)
      if (raw) return normalizeRolePermissions(JSON.parse(raw))
    } catch { /* noop */ }
    return DEFAULT_ROLE_PERMISSIONS
  })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res: any = await tenantApi.myRolePermissions()
      const data = normalizeRolePermissions(res?.data ?? res)
      setMatrix(data)
      try { localStorage.setItem(ROLE_PERMS_CACHE_KEY, JSON.stringify(data)) } catch { /* noop */ }
      return data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load])

  useEffect(() => {
    const onUpdated = () => { load().catch(() => {}) }
    window.addEventListener('role-permissions-updated', onUpdated)
    return () => window.removeEventListener('role-permissions-updated', onUpdated)
  }, [load])

  const canView = useCallback(
    (moduleKey: RolePermissionModuleKey) => canViewModule(matrix, authStorage.getUser()?.role, moduleKey),
    [matrix],
  )
  const canEdit = useCallback(
    (moduleKey: RolePermissionModuleKey) => canEditModule(matrix, authStorage.getUser()?.role, moduleKey),
    [matrix],
  )
  const access = useCallback(
    (moduleKey: RolePermissionModuleKey) => getAccessForRole(matrix, authStorage.getUser()?.role, moduleKey),
    [matrix],
  )

  return { matrix, loading, canView, canEdit, access, refetch: load }
}

/** Buying price / cost / margin — Owner always sees; staff via Permission Matrix → Product Cost. */
export function useCanSeeProductCost(): boolean {
  const role = authStorage.getUser()?.role
  if (role === 'OWNER' || role === 'PLATFORM_ADMIN') return true
  const { canView } = useRolePermissions()
  return canView('PRODUCT_COST')
}

export function usePlatformStatus(pollMs = 60_000) {
  const [status, setStatus] = useState<PlatformStatus | null>(null)

  const load = useCallback(() => fetchPlatformStatus().then(setStatus).catch(() => {}), [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, pollMs)
    const onFocus = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [load, pollMs])

  return status
}

export function useCategoryProducts(params?: Record<string, string>) {
  return useApi<unknown[]>(
    () => analyticsApi.categoryProducts(params) as Promise<{ data: unknown[] }>,
    [JSON.stringify(params)],
  )
}

export function useCategorySales(params?: Record<string, string>) {
  return useApi<unknown>(
    () => analyticsApi.categorySales(params) as Promise<{ data: unknown }>,
    [JSON.stringify(params)],
  )
}

export function useCustomerSales(params?: Record<string, string>) {
  return useApi<unknown>(
    () => analyticsApi.customerSales(params) as Promise<{ data: unknown }>,
    [JSON.stringify(params)],
  )
}

export function useCustomerSalesDetail(params?: Record<string, string>) {
  return useApi<unknown[]>(
    async () => {
      if (!params) return { data: [] as unknown[] }
      return analyticsApi.customerSalesDetail(params) as Promise<{ data: unknown[] }>
    },
    [JSON.stringify(params)],
  )
}

export function usePurchaseReport(params?: Record<string, string>) {
  return useApi<unknown>(
    () => analyticsApi.purchaseReport(params) as Promise<{ data: unknown }>,
    [JSON.stringify(params)],
  )
}

export function usePurchaseReportDetail(params?: Record<string, string>) {
  return useApi<unknown[]>(
    async () => {
      if (!params) return { data: [] as unknown[] }
      return analyticsApi.purchaseReportDetail(params) as Promise<{ data: unknown[] }>
    },
    [JSON.stringify(params)],
  )
}

export function useDailyReloadReport(params?: Record<string, string>) {
  return useApi<unknown>(
    () => dailyReloadApi.getReport(params) as Promise<{ data: unknown }>,
    [JSON.stringify(params)],
  )
}

export function useDailyClosingPreview(branchId: string, date: string, enabled = true) {
  return useApi<unknown>(
    () => {
      if (!branchId || !enabled) return Promise.resolve({ data: null as unknown })
      return dailyClosingApi.preview({ branchId, date }) as Promise<{ data: unknown }>
    },
    [branchId, date, enabled],
  )
}

export function useProfitAllocationDashboard(branchId: string, date: string, enabled = true) {
  return useApi<unknown>(
    () => {
      if (!branchId || !enabled) return Promise.resolve({ data: null as unknown })
      return profitAllocationApi.dashboard({ branchId, date }) as Promise<{ data: unknown }>
    },
    [branchId, date, enabled],
  )
}

export function useProfitFunds(branchId: string, enabled = true) {
  return useApi<unknown[]>(
    () => {
      if (!branchId || !enabled) return Promise.resolve({ data: [] as unknown[] })
      return profitAllocationApi.funds({ branchId }) as Promise<{ data: unknown[] }>
    },
    [branchId, enabled],
  )
}

export function useProductVariantSettings(enabled = true) {
  return useApi<import('./productVariantSettings').ProductVariantSettings>(
    async () => {
      if (!enabled) {
        const { DEFAULT_PRODUCT_VARIANT_SETTINGS } = await import('./productVariantSettings')
        return { data: DEFAULT_PRODUCT_VARIANT_SETTINGS }
      }
      const { authStorage } = await import('./auth')
      const { fetchProductVariantSettings, DEFAULT_PRODUCT_VARIANT_SETTINGS } = await import('./productVariantSettings')
      const tenantId = authStorage.getUser()?.tenantId
      if (!tenantId) return { data: DEFAULT_PRODUCT_VARIANT_SETTINGS }
      return { data: await fetchProductVariantSettings(tenantId) }
    },
    [enabled],
  )
}

export function useApi<T>(
  fetcher: () => Promise<{ data: T }>,
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetcher()
      setData(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { load() }, [load])

  return { data, loading, error, refetch: load }
}

const wrapPaginated = <T>(apiFn: () => Promise<any>): Promise<{ data: { data: T[]; meta: any } }> =>
  apiFn().then((r: any) => ({ data: { data: r.data ?? [], meta: r.meta ?? {} } }))

const ALL: Record<string, string> = { limit: '5000' }

export function useProducts(params?: Record<string, string>) {
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(productsApi.list.bind(null, p)),
    [JSON.stringify(p)],
  )
}

export function useCustomers(params?: Record<string, string>) {
  const branchId = useActiveBranchId()
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(customersApi.list.bind(null, p)),
    [JSON.stringify(p), branchId ?? 'all'],
  )
}

export function useSales(params?: Record<string, string>) {
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(salesApi.list.bind(null, p)),
    [JSON.stringify(p)],
  )
}

export function useRepairs(params?: Record<string, string>) {
  const branchId = useActiveBranchId()
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(repairsApi.list.bind(null, p)).then((res) => ({
      data: {
        ...res.data,
        data: (res.data.data ?? []).map((row) => normalizeRepairTicket(row)),
      },
    })),
    [JSON.stringify(p), branchId ?? 'all'],
  )
}

export function useWarranties(params?: Record<string, string>) {
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(warrantyApi.list.bind(null, p)),
    [JSON.stringify(p)],
  )
}

export function useSuppliers(params?: Record<string, string>) {
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(suppliersApi.list.bind(null, p)),
    [JSON.stringify(p)],
  )
}

export function usePurchaseOrders(params?: Record<string, string>) {
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(suppliersApi.purchaseOrders.bind(null, p)),
    [JSON.stringify(p)],
  )
}

export function useSupplierPayments(params?: Record<string, string>) {
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(suppliersApi.payments.bind(null, p)),
    [JSON.stringify(p)],
  )
}

export function useTransactions(params?: Record<string, string>) {
  const branchId = useActiveBranchId()
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(financeApi.transactions.bind(null, p)),
    [JSON.stringify(p), branchId ?? 'all'],
  )
}

export function useFinanceSummary(params?: Record<string, string>) {
  return useApi<unknown>(
    () => financeApi.summary(params) as Promise<{ data: unknown }>,
    [JSON.stringify(params)],
  )
}

export function usePlStatement(params?: Record<string, string>) {
  return useApi<unknown>(
    () => financeApi.plStatement(params) as Promise<{ data: unknown }>,
    [JSON.stringify(params)],
  )
}

export function useAnalyticsDashboard(branchId?: string) {
  const activeBranchId = useActiveBranchId()
  const resolved = branchId ?? activeBranchId
  const params = resolved ? { branchId: resolved } : undefined
  return useApi<unknown>(
    () => analyticsApi.dashboard(params) as Promise<{ data: unknown }>,
    [resolved ?? 'all'],
  )
}

export function useRevenue(params?: Record<string, string>) {
  const branchId = useActiveBranchId()
  return useApi<unknown[]>(
    () => analyticsApi.revenue(params) as Promise<{ data: unknown[] }>,
    [JSON.stringify(params), branchId ?? 'all'],
  )
}

export function useTopProducts(params?: Record<string, string>) {
  const branchId = useActiveBranchId()
  return useApi<unknown[]>(
    () => analyticsApi.topProducts(params) as Promise<{ data: unknown[] }>,
    [JSON.stringify(params), branchId ?? 'all'],
  )
}

export function useRepairsByStatus(params?: Record<string, string>) {
  return useApi<unknown[]>(
    () => analyticsApi.repairsByStatus(params) as Promise<{ data: unknown[] }>,
    [JSON.stringify(params ?? {})],
  )
}

export function useInventorySummary(params?: Record<string, string>) {
  return useApi<unknown>(
    () => analyticsApi.inventorySummary(params) as Promise<{ data: unknown }>,
    [JSON.stringify(params ?? {})],
  )
}

export function useBranches() {
  return useApi<unknown[]>(
    () => branchesApi.list() as Promise<{ data: unknown[] }>,
    [],
  )
}

export function useCategories() {
  return useApi<unknown[]>(
    () => productsApi.categories() as Promise<{ data: unknown[] }>,
    [],
  )
}

export function useBrands() {
  return useApi<unknown[]>(
    () => productsApi.brands() as Promise<{ data: unknown[] }>,
    [],
  )
}



export function useUsers(params?: Record<string, string>) {
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(usersApi.list.bind(null, p)),
    [JSON.stringify(p)],
  )
}

export function useImeiRecords(params?: Record<string, string>) {
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(imeiApi.list.bind(null, p)),
    [JSON.stringify(p)],
  )
}

export function useDeliverySummary(params?: Record<string, string>) {
  return useApi<unknown>(
    () => analyticsApi.deliverySummary(params) as Promise<{ data: unknown }>,
    [JSON.stringify(params)],
  )
}

export { PRICED_FEATURES, clearFeaturesCache }
