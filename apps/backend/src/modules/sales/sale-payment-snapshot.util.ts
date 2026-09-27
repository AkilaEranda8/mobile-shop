import type { PaymentMethod } from '@prisma/client'
import { AppError } from '../../middleware/error.middleware'
import { getTenantConfig } from '../configuration-engine/configuration-engine.service'
import {
  computeCustomerFee,
  feeRuleAt,
  type PaymentMethodFeeRule,
  type PaymentMethodSettings,
  type TenantPaymentMethod,
} from '../tenants/payment-method-settings.util'

const MONEY_METHODS = new Set(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'CHEQUE'])
const ALL_METHODS = new Set([...MONEY_METHODS, 'CREDIT', 'STORE_CREDIT'])

export type SalePaymentCreateRow = {
  method: PaymentMethod
  amount: number
  reference?: string | null
  paidAt?: Date
  methodConfigId?: string
  methodLabel?: string
  customerFeeAmount?: number
  feeType?: string
  feeRate?: number
  feeVersion?: number
  clearanceStatus?: 'NOT_REQUIRED' | 'PENDING'
  clearanceGlAccountId?: string
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function ruleForVersion(method: TenantPaymentMethod, version: number): PaymentMethodFeeRule | undefined {
  if (method.fee?.version === version) return method.fee
  const h = method.feeHistory?.find(e => e.version === version)
  return h ? { enabled: h.enabled, type: h.type, rate: h.rate, effectiveFrom: h.effectiveFrom, version: h.version } : undefined
}

function findConfigMethod(settings: PaymentMethodSettings, key: string, configId: unknown): TenantPaymentMethod | undefined {
  if (typeof configId === 'string' && configId) {
    const byId = settings.methods.find(m => m.id === configId && m.key === key)
    if (byId) return byId
  }
  // Legacy clients send only the key — use the config only when it is unambiguous.
  const sameKey = settings.methods.filter(m => m.key === key)
  return sameKey.length === 1 ? sameKey[0] : undefined
}

/**
 * Sanitize client payment rows and attach server-owned fee / clearance snapshots.
 * Clients never set clearanceStatus directly; fee amounts are recomputed from tenant config.
 */
export async function buildSalePaymentRows(
  tenantId: string,
  rawPayments: unknown,
  saleAt: Date,
): Promise<{ rows: SalePaymentCreateRow[]; customerFeeTotal: number }> {
  const list = Array.isArray(rawPayments) ? rawPayments : []
  let settings: PaymentMethodSettings | null = null
  const rows: SalePaymentCreateRow[] = []
  let customerFeeTotal = 0

  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const p = raw as Record<string, unknown>
    const method = String(p.method ?? '').toUpperCase()
    if (!ALL_METHODS.has(method)) throw new AppError(`Invalid payment method: ${String(p.method ?? '')}`, 400)
    const amount = Number(p.amount ?? 0)
    if (!Number.isFinite(amount)) throw new AppError('Invalid payment amount', 400)

    const row: SalePaymentCreateRow = { method: method as PaymentMethod, amount }
    if (p.reference != null) row.reference = String(p.reference)
    if (p.paidAt) {
      const d = new Date(String(p.paidAt))
      if (!Number.isNaN(d.getTime())) row.paidAt = d
    }

    if (MONEY_METHODS.has(method) && amount > 0) {
      settings ??= (await getTenantConfig(tenantId, 'paymentMethod')) as PaymentMethodSettings
      const cfg = findConfigMethod(settings, method, p.methodConfigId)
      if (cfg) {
        row.methodConfigId = cfg.id
        row.methodLabel = cfg.label

        const clientFee = p.customerFeeAmount == null ? null : Number(p.customerFeeAmount)
        if (clientFee != null && Number.isFinite(clientFee) && clientFee > 0) {
          const clientVersion = Number(p.feeVersion)
          const rule = Number.isInteger(clientVersion) && clientVersion > 0
            ? ruleForVersion(cfg, clientVersion)
            : feeRuleAt(cfg, saleAt)
          const expected = computeCustomerFee(rule, amount)
          if (!rule || expected <= 0 || Math.abs(expected - clientFee) > 0.01) {
            throw new AppError(`Payment fee for ${cfg.label} has changed. Refresh POS and try again.`, 409)
          }
          row.customerFeeAmount = expected
          row.feeType = rule.type
          row.feeRate = rule.rate
          row.feeVersion = rule.version
          customerFeeTotal = round2(customerFeeTotal + expected)
        }

        if (cfg.clearance?.required && method !== 'CASH') {
          row.clearanceStatus = 'PENDING'
          if (cfg.clearance.glAccountId) row.clearanceGlAccountId = cfg.clearance.glAccountId
        }
      }
    }
    rows.push(row)
  }

  return { rows, customerFeeTotal }
}
