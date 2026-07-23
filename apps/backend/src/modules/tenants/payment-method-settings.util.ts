/**
 * Tenant-configurable payment methods shown in POS / Repairs checkout.
 * `key` must be a Prisma PaymentMethod enum value (excl. CREDIT).
 * Multiple rows may share the same key with different display labels.
 */
export const PAYMENT_METHOD_KEYS = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET'] as const
export type PaymentMethodKey = (typeof PAYMENT_METHOD_KEYS)[number]

export interface TenantPaymentMethod {
  id: string
  key: PaymentMethodKey
  label: string
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

export function normalizePaymentMethodSettings(raw: unknown): PaymentMethodSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (!Array.isArray(src.methods)) return DEFAULT_PAYMENT_METHOD_SETTINGS

  const usedIds = new Set<string>()
  const methods: TenantPaymentMethod[] = []
  for (const item of src.methods) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const key = row.key
    if (typeof key !== 'string' || !PAYMENT_METHOD_KEYS.includes(key as PaymentMethodKey)) continue
    const k = key as PaymentMethodKey
    const rawLabel = row.label
    const label = typeof rawLabel === 'string' && rawLabel.trim()
      ? rawLabel.trim().slice(0, 40)
      : DEFAULT_LABELS[k]
    let id = typeof row.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 64) : ''
    if (!id || usedIds.has(id)) {
      id = !usedIds.has(k) && label === DEFAULT_LABELS[k] ? k : makeId(k, label, usedIds)
    }
    usedIds.add(id)
    methods.push({ id, key: k, label })
  }

  // Cash must always be available — POS cash flow and daily closing depend on it
  if (!methods.some(m => m.key === 'CASH')) {
    methods.unshift({ id: 'CASH', key: 'CASH', label: DEFAULT_LABELS.CASH })
  }

  return { methods: methods.length ? methods : DEFAULT_PAYMENT_METHOD_SETTINGS.methods }
}
