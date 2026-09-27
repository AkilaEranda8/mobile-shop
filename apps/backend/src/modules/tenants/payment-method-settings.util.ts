/**
 * Tenant-configurable payment methods shown in POS / Repairs checkout.
 * `key` must be a Prisma PaymentMethod enum value (excl. CREDIT).
 * Multiple rows may share the same key with different display labels.
 */
export const PAYMENT_METHOD_KEYS = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'CHEQUE'] as const
export type PaymentMethodKey = (typeof PAYMENT_METHOD_KEYS)[number]

export type PaymentFeeType = 'PERCENT' | 'FIXED'

export interface PaymentMethodFeeRule {
  enabled: boolean
  type: PaymentFeeType
  rate: number
  /** ISO date; rule applies to sales on/after this instant. */
  effectiveFrom?: string
  version: number
}

export interface PaymentMethodFeeHistoryEntry {
  version: number
  enabled: boolean
  type: PaymentFeeType
  rate: number
  effectiveFrom: string
  changedAt: string
  changedBy?: string
}

export interface PaymentMethodClearance {
  required: boolean
  glAccountId?: string
  /** Hint (percent) pre-filled as provider deduction when marking cleared. */
  expectedDeductionRate?: number
}

export interface TenantPaymentMethod {
  id: string
  key: PaymentMethodKey
  label: string
  /** Hidden from checkout when false. Defaults to true. */
  enabled?: boolean
  fee?: PaymentMethodFeeRule
  feeHistory?: PaymentMethodFeeHistoryEntry[]
  clearance?: PaymentMethodClearance
}

export interface PaymentMethodSettings {
  methods: TenantPaymentMethod[]
}

export const DEFAULT_PAYMENT_METHOD_SETTINGS: PaymentMethodSettings = {
  methods: [
    { id: 'CASH', key: 'CASH', label: 'Cash' },
    { id: 'CARD', key: 'CARD', label: 'Card' },
    { id: 'BANK_TRANSFER', key: 'BANK_TRANSFER', label: 'Bank Transfer' },
  ],
}

const DEFAULT_LABELS: Record<PaymentMethodKey, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  WALLET: 'Wallet',
  CHEQUE: 'Cheque',
}

function makeId(key: PaymentMethodKey, label: string, used: Set<string>): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'method'
  let id = `${key}_${slug}`
  if (!used.has(id) && id !== key) {
    // prefer plain key when first of its type and label matches default
    if (!used.has(key) && label === DEFAULT_LABELS[key]) return key
  }
  if (!used.has(id)) return id
  let n = 2
  while (used.has(`${id}_${n}`)) n += 1
  return `${id}_${n}`
}

/** Upgrade legacy "Cheque" rows that were stored as BANK_TRANSFER. */
function resolveKey(rawKey: string, label: string): PaymentMethodKey | null {
  if (!(PAYMENT_METHOD_KEYS as readonly string[]).includes(rawKey)) return null
  let k = rawKey as PaymentMethodKey
  if (k === 'BANK_TRANSFER' && /cheque|check/i.test(label)) k = 'CHEQUE'
  return k
}

function finiteNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

function isoOrUndefined(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

function clampFeeRate(type: PaymentFeeType, rate: number): number {
  const r = Math.max(0, rate)
  return Math.round((type === 'PERCENT' ? Math.min(100, r) : r) * 10000) / 10000
}

function normalizeFeeRule(raw: unknown): PaymentMethodFeeRule | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Record<string, unknown>
  const type: PaymentFeeType = src.type === 'FIXED' ? 'FIXED' : 'PERCENT'
  const rate = clampFeeRate(type, finiteNumber(src.rate) ?? 0)
  const version = Math.max(1, Math.floor(finiteNumber(src.version) ?? 1))
  const rule: PaymentMethodFeeRule = { enabled: src.enabled === true && rate > 0, type, rate, version }
  const eff = isoOrUndefined(src.effectiveFrom)
  if (eff) rule.effectiveFrom = eff
  return rule
}

function normalizeFeeHistory(raw: unknown): PaymentMethodFeeHistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: PaymentMethodFeeHistoryEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const src = item as Record<string, unknown>
    const type: PaymentFeeType = src.type === 'FIXED' ? 'FIXED' : 'PERCENT'
    const effectiveFrom = isoOrUndefined(src.effectiveFrom)
    const changedAt = isoOrUndefined(src.changedAt) ?? effectiveFrom
    if (!effectiveFrom || !changedAt) continue
    const entry: PaymentMethodFeeHistoryEntry = {
      version: Math.max(1, Math.floor(finiteNumber(src.version) ?? 1)),
      enabled: src.enabled === true,
      type,
      rate: clampFeeRate(type, finiteNumber(src.rate) ?? 0),
      effectiveFrom,
      changedAt,
    }
    if (typeof src.changedBy === 'string' && src.changedBy.trim()) entry.changedBy = src.changedBy.trim().slice(0, 120)
    out.push(entry)
  }
  return out.slice(-50)
}

function normalizeClearance(raw: unknown, key: PaymentMethodKey): PaymentMethodClearance | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Record<string, unknown>
  // Physical cash never waits for a provider settlement.
  const required = src.required === true && key !== 'CASH'
  const out: PaymentMethodClearance = { required }
  if (typeof src.glAccountId === 'string' && src.glAccountId.trim()) out.glAccountId = src.glAccountId.trim().slice(0, 64)
  const hint = finiteNumber(src.expectedDeductionRate)
  if (hint != null && hint > 0) out.expectedDeductionRate = Math.min(100, Math.round(hint * 10000) / 10000)
  return out
}

/** Amount charged to the customer on top of `amount` for this method. Rounded to 2dp. */
export function computeCustomerFee(fee: Pick<PaymentMethodFeeRule, 'enabled' | 'type' | 'rate'> | undefined | null, amount: number): number {
  if (!fee || !fee.enabled || !(amount > 0) || !(fee.rate > 0)) return 0
  const raw = fee.type === 'FIXED' ? fee.rate : (amount * fee.rate) / 100
  return Math.round(raw * 100) / 100
}

/**
 * Fee rule that was in force at `at` (for offline sales replayed later).
 * Falls back to the current rule when no history entry covers the date.
 */
export function feeRuleAt(method: TenantPaymentMethod, at: Date): PaymentMethodFeeRule | undefined {
  const t = at.getTime()
  const history = [...(method.feeHistory ?? [])].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  let match: PaymentMethodFeeHistoryEntry | undefined
  for (const h of history) {
    if (new Date(h.effectiveFrom).getTime() <= t) match = h
  }
  const current = method.fee
  if (current && (!current.effectiveFrom || new Date(current.effectiveFrom).getTime() <= t)) {
    if (!match || match.version <= current.version) return current
  }
  if (match) return { enabled: match.enabled, type: match.type, rate: match.rate, effectiveFrom: match.effectiveFrom, version: match.version }
  return undefined
}

function feeRuleEquals(a: PaymentMethodFeeRule | undefined, b: PaymentMethodFeeRule | undefined): boolean {
  const ae = a?.enabled ?? false
  const be = b?.enabled ?? false
  if (!ae && !be) return true
  return ae === be && a?.type === b?.type && a?.rate === b?.rate && (a?.effectiveFrom ?? '') === (b?.effectiveFrom ?? '')
}

/**
 * Server-owned fee versioning: client-sent `version` / `feeHistory` are ignored.
 * Every change to a method's fee rule bumps the version and appends a history entry.
 */
export function applyFeeVersioning(
  previous: PaymentMethodSettings,
  next: PaymentMethodSettings,
  changedBy?: string,
): PaymentMethodSettings {
  const prevById = new Map(previous.methods.map(m => [m.id, m]))
  const now = new Date().toISOString()
  const methods = next.methods.map(m => {
    const prev = prevById.get(m.id)
    const out: TenantPaymentMethod = { ...m }
    if (prev?.feeHistory?.length) out.feeHistory = prev.feeHistory
    else delete out.feeHistory
    if (!m.fee) {
      if (prev?.fee) out.fee = prev.fee.enabled ? { ...prev.fee, enabled: false, version: prev.fee.version + 1 } : prev.fee
      if (prev?.fee?.enabled) out.feeHistory = [...(out.feeHistory ?? []), { version: prev.fee.version + 1, enabled: false, type: prev.fee.type, rate: prev.fee.rate, effectiveFrom: now, changedAt: now, ...(changedBy ? { changedBy } : {}) }].slice(-50)
      return out
    }
    if (prev?.fee && feeRuleEquals(prev.fee, m.fee)) {
      out.fee = prev.fee
      return out
    }
    const version = (prev?.fee?.version ?? 0) + 1
    const effectiveFrom = m.fee.effectiveFrom && m.fee.effectiveFrom > now ? m.fee.effectiveFrom : now
    out.fee = { ...m.fee, version, effectiveFrom }
    out.feeHistory = [
      ...(out.feeHistory ?? []),
      { version, enabled: m.fee.enabled, type: m.fee.type, rate: m.fee.rate, effectiveFrom, changedAt: now, ...(changedBy ? { changedBy } : {}) },
    ].slice(-50)
    return out
  })
  return { methods }
}

export function normalizePaymentMethodSettings(raw: unknown): PaymentMethodSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (!Array.isArray(src.methods)) return DEFAULT_PAYMENT_METHOD_SETTINGS

  const usedIds = new Set<string>()
  const methods: TenantPaymentMethod[] = []
  for (const item of src.methods) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const rawLabel = row.label
    const label = typeof rawLabel === 'string' && rawLabel.trim()
      ? rawLabel.trim().slice(0, 40)
      : ''
    const keyRaw = typeof row.key === 'string' ? row.key : ''
    const k = resolveKey(keyRaw, label || DEFAULT_LABELS[(keyRaw as PaymentMethodKey)] || '')
    if (!k) continue
    const finalLabel = label || DEFAULT_LABELS[k]
    let id = typeof row.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 64) : ''
    // Remap legacy BANK_TRANSFER_cheque ids when upgrading to CHEQUE
    if (k === 'CHEQUE' && (id === 'BANK_TRANSFER' || /^BANK_TRANSFER_/.test(id))) {
      id = !usedIds.has('CHEQUE') && finalLabel === DEFAULT_LABELS.CHEQUE ? 'CHEQUE' : ''
    }
    if (!id || usedIds.has(id)) {
      id = !usedIds.has(k) && finalLabel === DEFAULT_LABELS[k] ? k : makeId(k, finalLabel, usedIds)
    }
    usedIds.add(id)
    const method: TenantPaymentMethod = { id, key: k, label: finalLabel }
    if (row.enabled === false && k !== 'CASH') method.enabled = false
    // Cash drawer counts (daily closing expected cash) assume cash in == sale value.
    const fee = k === 'CASH' ? undefined : normalizeFeeRule(row.fee)
    if (fee) method.fee = fee
    const history = normalizeFeeHistory(row.feeHistory)
    if (history.length) method.feeHistory = history
    const clearance = normalizeClearance(row.clearance, k)
    if (clearance) method.clearance = clearance
    methods.push(method)
  }

  // Cash must always be available — POS cash flow and daily closing depend on it
  if (!methods.some(m => m.key === 'CASH')) {
    methods.unshift({ id: 'CASH', key: 'CASH', label: DEFAULT_LABELS.CASH })
  }

  return { methods: methods.length ? methods : DEFAULT_PAYMENT_METHOD_SETTINGS.methods }
}
