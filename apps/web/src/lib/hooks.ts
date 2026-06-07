'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  productsApi, customersApi, salesApi, repairsApi,
  warrantyApi, suppliersApi, financeApi, analyticsApi,
  imeiApi, usersApi, branchesApi, tenantApi, dailyReloadApi,
} from './api'
import { isFeatureEnabled, clearFeaturesCache, PRICED_FEATURES } from './tenant-features'

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

export function useDailyReloadReport(params?: Record<string, string>) {
  return useApi<unknown>(
    () => dailyReloadApi.getReport(params) as Promise<{ data: unknown }>,
    [JSON.stringify(params)],
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
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(customersApi.list.bind(null, p)),
    [JSON.stringify(p)],
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
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(repairsApi.list.bind(null, p)),
    [JSON.stringify(p)],
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

export function useTransactions(params?: Record<string, string>) {
  const p = { ...ALL, ...params }
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(financeApi.transactions.bind(null, p)),
    [JSON.stringify(p)],
  )
}

export function useFinanceSummary(params?: Record<string, string>) {
  return useApi<unknown>(
    () => financeApi.summary(params) as Promise<{ data: unknown }>,
    [JSON.stringify(params)],
  )
}

export function useAnalyticsDashboard() {
  return useApi<unknown>(
    () => analyticsApi.dashboard() as Promise<{ data: unknown }>,
    [],
  )
}

export function useRevenue(params?: Record<string, string>) {
  return useApi<unknown[]>(
    () => analyticsApi.revenue(params) as Promise<{ data: unknown[] }>,
    [JSON.stringify(params)],
  )
}

export function useTopProducts(params?: Record<string, string>) {
  return useApi<unknown[]>(
    () => analyticsApi.topProducts(params) as Promise<{ data: unknown[] }>,
    [JSON.stringify(params)],
  )
}

export function useRepairsByStatus() {
  return useApi<unknown[]>(
    () => analyticsApi.repairsByStatus() as Promise<{ data: unknown[] }>,
    [],
  )
}

export function useInventorySummary() {
  return useApi<unknown>(
    () => analyticsApi.inventorySummary() as Promise<{ data: unknown }>,
    [],
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
