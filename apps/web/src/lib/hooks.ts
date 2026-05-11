'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  productsApi, customersApi, salesApi, repairsApi,
  warrantyApi, suppliersApi, financeApi, analyticsApi,
} from './api'

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

export function useProducts(params?: Record<string, string>) {
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(productsApi.list.bind(null, params)),
    [JSON.stringify(params)],
  )
}

export function useCustomers(params?: Record<string, string>) {
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(customersApi.list.bind(null, params)),
    [JSON.stringify(params)],
  )
}

export function useSales(params?: Record<string, string>) {
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(salesApi.list.bind(null, params)),
    [JSON.stringify(params)],
  )
}

export function useRepairs(params?: Record<string, string>) {
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(repairsApi.list.bind(null, params)),
    [JSON.stringify(params)],
  )
}

export function useWarranties(params?: Record<string, string>) {
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(warrantyApi.list.bind(null, params)),
    [JSON.stringify(params)],
  )
}

export function useSuppliers(params?: Record<string, string>) {
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(suppliersApi.list.bind(null, params)),
    [JSON.stringify(params)],
  )
}

export function usePurchaseOrders(params?: Record<string, string>) {
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(suppliersApi.purchaseOrders.bind(null, params)),
    [JSON.stringify(params)],
  )
}

export function useTransactions(params?: Record<string, string>) {
  return useApi<{ data: unknown[]; meta: any }>(
    () => wrapPaginated(financeApi.transactions.bind(null, params)),
    [JSON.stringify(params)],
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
