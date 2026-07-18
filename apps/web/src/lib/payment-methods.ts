import { useEffect, useState } from 'react'
import { tenantApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'

/** Payment methods a shop can offer at POS / repair checkout (Settings → Payments). */
export const PAYMENT_METHOD_KEYS = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET'] as const
export type PaymentMethodKey = (typeof PAYMENT_METHOD_KEYS)[number]

export interface TenantPaymentMethod {
  key: PaymentMethodKey
  label: string
}

export interface PaymentMethodSettings {
  methods: TenantPaymentMethod[]
}

export const DEFAULT_PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  WALLET: 'Wallet',
}

export const DEFAULT_PAYMENT_METHODS: TenantPaymentMethod[] = [
  { key: 'CASH', label: 'Cash' },
  { key: 'CARD', label: 'Card' },
  { key: 'BANK_TRANSFER', label: 'Bank Transfer' },
]

function sanitize(methods: unknown): TenantPaymentMethod[] {
  if (!Array.isArray(methods)) return DEFAULT_PAYMENT_METHODS
  const seen = new Set<string>()
  const out: TenantPaymentMethod[] = []
  for (const m of methods) {
    const key = (m as TenantPaymentMethod)?.key
    if (!PAYMENT_METHOD_KEYS.includes(key) || seen.has(key)) continue
    seen.add(key)
    const label = typeof (m as TenantPaymentMethod).label === 'string' && (m as TenantPaymentMethod).label.trim()
      ? (m as TenantPaymentMethod).label.trim()
      : DEFAULT_PAYMENT_METHOD_LABELS[key]
    out.push({ key, label })
  }
  if (!seen.has('CASH')) out.unshift({ key: 'CASH', label: 'Cash' })
  return out.length ? out : DEFAULT_PAYMENT_METHODS
}

export async function fetchPaymentMethods(): Promise<TenantPaymentMethod[]> {
  const tenantId = authStorage.getUser()?.tenantId
  if (!tenantId) return DEFAULT_PAYMENT_METHODS
  try {
    const res: any = await tenantApi.getPaymentMethodSettings(tenantId)
    return sanitize((res?.data ?? res)?.methods)
  } catch {
    return DEFAULT_PAYMENT_METHODS
  }
}

/** Enabled payment methods for the current tenant (falls back to defaults while loading). */
export function usePaymentMethods(): TenantPaymentMethod[] {
  const [methods, setMethods] = useState<TenantPaymentMethod[]>(DEFAULT_PAYMENT_METHODS)
  useEffect(() => {
    let alive = true
    fetchPaymentMethods().then(m => { if (alive) setMethods(m) })
    return () => { alive = false }
  }, [])
  return methods
}
