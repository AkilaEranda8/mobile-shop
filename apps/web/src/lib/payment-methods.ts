import { useEffect, useMemo, useState } from 'react'
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
export type PaymentFeeType = 'PERCENT' | 'FIXED'

export interface PaymentMethodFeeRule {
  enabled: boolean
  type: PaymentFeeType
  rate: number
  effectiveFrom?: string
  /** Server-assigned; sent back with sales so the server recomputes with the same rule. */
  version?: number
}

export interface PaymentMethodClearance {
  required: boolean
  glAccountId?: string
  expectedDeductionRate?: number
}

export interface TenantPaymentMethod {
  /** Unique row id (defaults to key for built-ins). */
  id: string
  key: PaymentMethodKey
  label: string
  /** Hidden from checkout when false (history keeps working). */
  enabled?: boolean
  fee?: PaymentMethodFeeRule
  clearance?: PaymentMethodClearance
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

function sanitizeFee(raw: unknown): PaymentMethodFeeRule | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const f = raw as Record<string, unknown>
  const type: PaymentFeeType = f.type === 'FIXED' ? 'FIXED' : 'PERCENT'
  const rateNum = Number(f.rate)
  const rate = Number.isFinite(rateNum) ? Math.max(0, type === 'PERCENT' ? Math.min(100, rateNum) : rateNum) : 0
  const out: PaymentMethodFeeRule = { enabled: f.enabled === true && rate > 0, type, rate }
  if (typeof f.effectiveFrom === 'string' && f.effectiveFrom) out.effectiveFrom = f.effectiveFrom
  const v = Number(f.version)
  if (Number.isInteger(v) && v > 0) out.version = v
  return out
}

function sanitizeClearance(raw: unknown, key: PaymentMethodKey): PaymentMethodClearance | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const c = raw as Record<string, unknown>
  const out: PaymentMethodClearance = { required: c.required === true && key !== 'CASH' }
  if (typeof c.glAccountId === 'string' && c.glAccountId) out.glAccountId = c.glAccountId
  const hint = Number(c.expectedDeductionRate)
  if (Number.isFinite(hint) && hint > 0) out.expectedDeductionRate = Math.min(100, hint)
  return out
}

/** True when the fee rule is active now (future effective dates are not yet applied). */
export function isFeeActive(fee: PaymentMethodFeeRule | undefined, now = Date.now()): fee is PaymentMethodFeeRule {
  if (!fee?.enabled || !(fee.rate > 0)) return false
  if (fee.effectiveFrom && new Date(fee.effectiveFrom).getTime() > now) return false
  return true
}

/** Amount charged to the customer on top of `amount`. Must match backend rounding (2dp). */
export function computeCustomerFee(method: TenantPaymentMethod | undefined, amount: number): number {
  const fee = method?.fee
  if (!isFeeActive(fee) || !(amount > 0)) return 0
  const raw = fee.type === 'FIXED' ? fee.rate : (amount * fee.rate) / 100
  return Math.round(raw * 100) / 100
}

export function describeFee(fee: PaymentMethodFeeRule | undefined): string {
  if (!isFeeActive(fee)) return ''
  return fee.type === 'FIXED' ? `+${fee.rate}` : `${fee.rate}%`
}

/** Display label for a stored SalePayment (label snapshot, else the key). */
export function salePaymentLabel(p: { method: string; methodLabel?: string | null }): string {
  return p.methodLabel || p.method.replace(/_/g, ' ')
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
    const row: TenantPaymentMethod = { id, key: k, label }
    if (m.enabled === false && k !== 'CASH') row.enabled = false
    const fee = k === 'CASH' ? undefined : sanitizeFee(m.fee)
    if (fee) row.fee = fee
    const clearance = sanitizeClearance(m.clearance, k)
    if (clearance) row.clearance = clearance
    out.push(row)
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

/** Methods shown at checkout: disabled methods are hidden (Cash is always kept). */
export function useCheckoutPaymentMethods(): TenantPaymentMethod[] {
  const all = usePaymentMethods()
  return useMemo(() => {
    const enabled = all.filter(m => m.enabled !== false || m.key === 'CASH')
    return enabled.length ? enabled : all
  }, [all])
}
