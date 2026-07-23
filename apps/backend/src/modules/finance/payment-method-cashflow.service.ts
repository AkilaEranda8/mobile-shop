import { prisma } from '../../config/database'
import { businessDayRange } from '../../utils/date-range'
import { saleWhereExcludeNonRevenue } from '../../constants/business-rules.constants'

const METHODS = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'CHEQUE'] as const
export type CashflowMethod = (typeof METHODS)[number]

const METHOD_LABELS: Record<CashflowMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  WALLET: 'Wallet',
  CHEQUE: 'Cheque',
}

type Bucket = {
  method: CashflowMethod
  label: string
  in: number
  out: number
  net: number
  inBreakdown: {
    sales: number
    repairs: number
    customerCredit: number
    other: number
  }
  outBreakdown: {
    supplierPayments: number
    expenses: number
    refunds: number
    reloadProvider: number
    bankDeposits: number
    creditDiscounts: number
    other: number
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function emptyBucket(method: CashflowMethod): Bucket {
  return {
    method,
    label: METHOD_LABELS[method],
    in: 0,
    out: 0,
    net: 0,
    inBreakdown: { sales: 0, repairs: 0, customerCredit: 0, other: 0 },
    outBreakdown: {
      supplierPayments: 0,
      expenses: 0,
      refunds: 0,
      reloadProvider: 0,
      bankDeposits: 0,
      creditDiscounts: 0,
      other: 0,
    },
  }
}

function asMethod(raw: string | null | undefined): CashflowMethod | null {
  if (!raw) return null
  const m = raw.toUpperCase()
  return (METHODS as readonly string[]).includes(m) ? (m as CashflowMethod) : null
}

async function tenantBranchIds(tenantId: string): Promise<string[]> {
  const rows = await prisma.branch.findMany({ where: { tenantId }, select: { id: true } })
  return rows.map(r => r.id)
}

/**
 * Cash-basis money in / out by PaymentMethod for a date range.
 * Aligns with daily-closing rules (avoid double-counting Sales + SalePayment).
 */
export async function buildPaymentMethodCashflow(
  tenantId: string,
  fromKey: string,
  toKey: string,
  branchId?: string,
) {
  const { start } = businessDayRange(fromKey)
  const { end } = businessDayRange(toKey)
  const branches = branchId ? [branchId] : await tenantBranchIds(tenantId)
  const branchFilter = branches.length === 1 ? branches[0] : { in: branches }

  const saleWhere = {
    tenantId,
    branchId: branchFilter,
    status: { not: 'RETURNED' as const },
    createdAt: { gte: start, lte: end },
    ...saleWhereExcludeNonRevenue(),
  }

  const txWhere = {
    tenantId,
    branchId: branchFilter,
    OR: [
      { occurredAt: { gte: start, lte: end } },
      { AND: [{ occurredAt: null }, { createdAt: { gte: start, lte: end } }] },
    ],
  }

  const [sales, transactions, saleReturns] = await Promise.all([
    prisma.sale.findMany({
      where: saleWhere,
      select: {
        source: true,
        payments: { select: { method: true, amount: true, reference: true } },
      },
    }),
    prisma.transaction.findMany({
      where: txWhere,
      select: { type: true, category: true, paymentMethod: true, amount: true },
    }),
    prisma.saleReturn.findMany({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
        sale: { branchId: branchFilter },
      },
      select: { refundMethod: true, refundAmount: true },
    }),
  ])

  const map = Object.fromEntries(METHODS.map(m => [m, emptyBucket(m)])) as Record<CashflowMethod, Bucket>

  for (const sale of sales) {
    if ((sale as { source?: string | null }).source === 'REPAIR') continue
    for (const p of sale.payments) {
      const method = asMethod(p.method)
      if (!method) continue
      // Outstanding collections are recorded as Finance "Customer Credit Payment"
      // transactions — skip matching SalePayment rows to avoid same-day double count.
      const ref = (p.reference ?? '').trim()
      if (/^Outstanding (settlement|discount)\b/i.test(ref)) continue
      const amt = Number(p.amount) || 0
      map[method].inBreakdown.sales = round2(map[method].inBreakdown.sales + amt)
    }
  }

  for (const tx of transactions) {
    const method = asMethod(tx.paymentMethod)
    if (!method) continue
    const amt = Number(tx.amount) || 0
    const cat = (tx.category ?? 'Other').trim()

    if (tx.type === 'INCOME') {
      if (cat === 'Sales' || cat === 'Opening Cash') continue
      if (cat === 'Repairs') {
        map[method].inBreakdown.repairs = round2(map[method].inBreakdown.repairs + amt)
      } else if (cat === 'Customer Credit Payment') {
        map[method].inBreakdown.customerCredit = round2(map[method].inBreakdown.customerCredit + amt)
      } else {
        map[method].inBreakdown.other = round2(map[method].inBreakdown.other + amt)
      }
    } else if (tx.type === 'EXPENSE') {
      if (cat === 'Refund') continue
      if (cat === 'Supplier Payment') {
        map[method].outBreakdown.supplierPayments = round2(map[method].outBreakdown.supplierPayments + amt)
      } else if (cat === 'Reload Provider') {
        map[method].outBreakdown.reloadProvider = round2(map[method].outBreakdown.reloadProvider + amt)
      } else if (/^(bank\s+deposit|deposit\s+to\s+bank)$/i.test(cat)) {
        map[method].outBreakdown.bankDeposits = round2(map[method].outBreakdown.bankDeposits + amt)
      } else if (cat === 'Customer Credit Discount') {
        map[method].outBreakdown.creditDiscounts = round2(map[method].outBreakdown.creditDiscounts + amt)
      } else if (
        ['Rent', 'Salary', 'Electricity', 'Transport', 'Marketing', 'Other Expenses', 'Utilities', 'Misc', 'Inventory'].includes(cat)
        || /expense/i.test(cat)
      ) {
        map[method].outBreakdown.expenses = round2(map[method].outBreakdown.expenses + amt)
      } else {
        map[method].outBreakdown.other = round2(map[method].outBreakdown.other + amt)
      }
    }
  }

  for (const ret of saleReturns) {
    const method = asMethod(ret.refundMethod)
    if (!method) continue
    const amt = Number(ret.refundAmount) || 0
    map[method].outBreakdown.refunds = round2(map[method].outBreakdown.refunds + amt)
  }

  const methods = METHODS.map(m => {
    const b = map[m]
    const inn = round2(
      b.inBreakdown.sales + b.inBreakdown.repairs + b.inBreakdown.customerCredit + b.inBreakdown.other,
    )
    const out = round2(
      b.outBreakdown.supplierPayments
      + b.outBreakdown.expenses
      + b.outBreakdown.refunds
      + b.outBreakdown.reloadProvider
      + b.outBreakdown.bankDeposits
      + b.outBreakdown.creditDiscounts
      + b.outBreakdown.other,
    )
    return { ...b, in: inn, out, net: round2(inn - out) }
  })

  const totals = methods.reduce(
    (acc, m) => ({
      in: round2(acc.in + m.in),
      out: round2(acc.out + m.out),
      net: round2(acc.net + m.net),
    }),
    { in: 0, out: 0, net: 0 },
  )

  return {
    from: fromKey,
    to: toKey,
    branchId: branchId ?? null,
    methods,
    totals,
  }
}
