/**
 * Tenant-configurable payment methods shown in POS / Repairs checkout.
 * Keys must stay within the Prisma PaymentMethod enum; labels are free text.
 */
export const PAYMENT_METHOD_KEYS = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET'] as const
export type PaymentMethodKey = (typeof PAYMENT_METHOD_KEYS)[number]

export interface TenantPaymentMethod {
  key: PaymentMethodKey
  label: string
}

export interface PaymentMethodSettings {
  methods: TenantPaymentMethod[]
}

export const DEFAULT_PAYMENT_METHOD_SETTINGS: PaymentMethodSettings = {
  methods: [
    { key: 'CASH', label: 'Cash' },
    { key: 'CARD', label: 'Card' },
    { key: 'BANK_TRANSFER', label: 'Bank Transfer' },
  ],
}

const DEFAULT_LABELS: Record<PaymentMethodKey, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  WALLET: 'Wallet',
}

export function normalizePaymentMethodSettings(raw: unknown): PaymentMethodSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (!Array.isArray(src.methods)) return DEFAULT_PAYMENT_METHOD_SETTINGS

  const seen = new Set<PaymentMethodKey>()
  const methods: TenantPaymentMethod[] = []
  for (const item of src.methods) {
    if (!item || typeof item !== 'object') continue
    const key = (item as Record<string, unknown>).key
    if (typeof key !== 'string' || !PAYMENT_METHOD_KEYS.includes(key as PaymentMethodKey)) continue
    const k = key as PaymentMethodKey
    if (seen.has(k)) continue
    seen.add(k)
    const rawLabel = (item as Record<string, unknown>).label
    const label = typeof rawLabel === 'string' && rawLabel.trim()
      ? rawLabel.trim().slice(0, 40)
      : DEFAULT_LABELS[k]
    methods.push({ key: k, label })
  }

  // Cash must always be available — POS cash flow and daily closing depend on it
  if (!seen.has('CASH')) {
    methods.unshift({ key: 'CASH', label: DEFAULT_LABELS.CASH })
  }

  return { methods }
}
