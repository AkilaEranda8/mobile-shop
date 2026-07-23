import { useEffect, useState } from 'react'
import { tenantApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'

/** Accounting types stored on SalePayment / Transaction (Prisma PaymentMethod enum, excl. CREDIT). */
export const PAYMENT_METHOD_KEYS = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'CHEQUE'] as const
export type PaymentMethodKey = (typeof PAYMENT_METHOD_KEYS)[number]

/**
 * Tenant-configured checkout buttons.
 * Multiple methods may share the same `key` (accounting type) with different labels
 * e.g. Wallet → "eZ Cash", Wallet → "Genie".
 */
export interface TenantPaymentMethod {
  /** Unique row id (defaults to key for built-ins). */
  id: string
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
  CHEQUE: 'Cheque',
}

export const DEFAULT_PAYMENT_METHODS: TenantPaymentMethod[] = [
  { id: 'CASH', key: 'CASH', label: 'Cash' },
  { id: 'CARD', key: 'CARD', label: 'Card' },
  { id: 'BANK_TRANSFER', key: 'BANK_TRANSFER', label: 'Bank Transfer' },
]

const PAYMENT_METHODS_CHANGED = 'hexalyte:payment-methods-changed'

function slugifyLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'method'
}

/** Infer accounting key from a free-form display name. */
export function inferPaymentMethodKey(label: string): PaymentMethodKey {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, ' ')
  for (const k of PAYMENT_METHOD_KEYS) {
    if (DEFAULT_PAYMENT_METHOD_LABELS[k].toLowerCase() === normalized) return k
  }
  if (/cheque|check/.test(normalized)) return 'CHEQUE'
  if (/bank\s*transfer|bank/.test(normalized)) return 'BANK_TRANSFER'
  if (/\bcard\b|visa|master|debit|credit\s*card/.test(normalized)) return 'CARD'
  if (/\bcash\b|මුදල්/.test(normalized)) return 'CASH'
  if (/\bupi\b|\bqr\b/.test(normalized)) return 'UPI'
  return 'WALLET'
}

/** Build a unique id for a new custom method. */
export function makePaymentMethodId(key: PaymentMethodKey, label: string, existing: TenantPaymentMethod[]): string {
  const base = `${key}_${slugifyLabel(label)}`
  if (!existing.some(m => m.id === base)) return base
  let n = 2
  while (existing.some(m => m.id === `${base}_${n}`)) n += 1
  return `${base}_${n}`
}

function resolveKey(rawKey: string, label: string): PaymentMethodKey | null {
  if (!(PAYMENT_METHOD_KEYS as readonly string[]).includes(rawKey)) return null
  let k = rawKey as PaymentMethodKey
  if (k === 'BANK_TRANSFER' && /cheque|check/i.test(label)) k = 'CHEQUE'
  return k
}

export function sanitize(methods: unknown): TenantPaymentMethod[] {
  if (!Array.isArray(methods)) return DEFAULT_PAYMENT_METHODS
  const seenIds = new Set<string>()
  const out: TenantPaymentMethod[] = []
  for (const raw of methods) {
    if (!raw || typeof raw !== 'object') continue
    const m = raw as Record<string, unknown>
    const labelRaw = typeof m.label === 'string' ? m.label.trim().slice(0, 40) : ''
    const keyRaw = typeof m.key === 'string' ? m.key : ''
    const k = resolveKey(keyRaw, labelRaw || DEFAULT_PAYMENT_METHOD_LABELS[keyRaw as PaymentMethodKey] || '')
    if (!k) continue
    const label = labelRaw || DEFAULT_PAYMENT_METHOD_LABELS[k]
    let id = typeof m.id === 'string' && m.id.trim() ? m.id.trim().slice(0, 64) : k
    if (k === 'CHEQUE' && (id === 'BANK_TRANSFER' || /^BANK_TRANSFER_/.test(id))) {
      id = !seenIds.has('CHEQUE') && label === DEFAULT_PAYMENT_METHOD_LABELS.CHEQUE
        ? 'CHEQUE'
        : makePaymentMethodId(k, label, out)
    }
    if (seenIds.has(id)) {
      id = makePaymentMethodId(k, label, out)
    }
    seenIds.add(id)
    out.push({ id, key: k, label })
  }
  if (!out.some(m => m.key === 'CASH')) {
    out.unshift({ id: 'CASH', key: 'CASH', label: 'Cash' })
  }
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

/** Call after Settings → Payment Methods is saved so POS / Repairs / etc. refetch. */
export function notifyPaymentMethodsChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PAYMENT_METHODS_CHANGED))
}

/** Enabled payment methods for the current tenant (falls back to defaults while loading). */
export function usePaymentMethods(): TenantPaymentMethod[] {
  const [methods, setMethods] = useState<TenantPaymentMethod[]>(DEFAULT_PAYMENT_METHODS)
  useEffect(() => {
    let alive = true
    const load = () => {
      fetchPaymentMethods().then(m => { if (alive) setMethods(m) })
    }
    load()
    const onChanged = () => load()
    const onFocus = () => load()
    window.addEventListener(PAYMENT_METHODS_CHANGED, onChanged)
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      window.removeEventListener(PAYMENT_METHODS_CHANGED, onChanged)
      window.removeEventListener('focus', onFocus)
    }
  }, [])
  return methods
}
