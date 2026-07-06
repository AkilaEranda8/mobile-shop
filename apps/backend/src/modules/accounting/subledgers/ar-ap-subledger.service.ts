import { prisma } from '../../../config/database'
import { businessDateDb, businessDateFromInstant, normalizeBusinessDate } from '../../../utils/date-range'
import { AppError } from '../../../middleware/error.middleware'
import { round2 } from '../reports/gl-balances.util'

type SubledgerOpts = {
  tenantId: string
  branchId?: string
  asOfKey?: string
}

type AgingBuckets = {
  current: number
  days31_60: number
  days61_90: number
  over90: number
}

const EMPTY_AGING: AgingBuckets = { current: 0, days31_60: 0, days61_90: 0, over90: 0 }

async function assertInitialized(tenantId: string) {
  const s = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  if (!s?.initializedAt) throw new AppError('Accounting is not initialized', 400)
}

async function resolveControlAccountId(tenantId: string, key: 'ar' | 'ap') {
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } })
  const map = (settings?.defaultAccounts ?? {}) as Record<string, unknown>
  const id = map[key]
  if (typeof id === 'string' && id) return id
  const code = key === 'ar' ? '1200' : '2100'
  const acc = await prisma.glAccount.findFirst({ where: { tenantId, code, branchId: null } })
  if (!acc) throw new AppError(`${key.toUpperCase()} control account not found`, 400)
  return acc.id
}

function daysBetween(from: Date, to: Date) {
  const a = businessDateDb(businessDateFromInstant(from))
  const b = businessDateDb(businessDateFromInstant(to))
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

function bucketAmount(ageDays: number, amount: number): AgingBuckets {
  const b = { ...EMPTY_AGING }
  if (amount <= 0) return b
  if (ageDays <= 30) b.current = amount
  else if (ageDays <= 60) b.days31_60 = amount
  else if (ageDays <= 90) b.days61_90 = amount
  else b.over90 = amount
  return b
}

function mergeAging(a: AgingBuckets, b: AgingBuckets): AgingBuckets {
  return {
    current: round2(a.current + b.current),
    days31_60: round2(a.days31_60 + b.days31_60),
    days61_90: round2(a.days61_90 + b.days61_90),
    over90: round2(a.over90 + b.over90),
  }
}

/** AR: debits open receivables, credits apply payments */
function agingFromDebitsFirst(
  lines: Array<{ entryDate: Date; debit: number; credit: number }>,
  asOf: Date,
) {
  const sorted = [...lines].sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime())
  const open: Array<{ date: Date; remaining: number }> = []

  for (const line of sorted) {
    const dr = round2(Number(line.debit ?? 0))
    const cr = round2(Number(line.credit ?? 0))
    if (dr > 0) open.push({ date: line.entryDate, remaining: dr })
    if (cr > 0) {
      let left = cr
      for (const item of open) {
        if (left <= 0) break
        if (item.remaining <= 0) continue
        const apply = Math.min(item.remaining, left)
        item.remaining = round2(item.remaining - apply)
        left = round2(left - apply)
      }
    }
  }

  let aging = { ...EMPTY_AGING }
  for (const item of open) {
    if (item.remaining <= 0) continue
    aging = mergeAging(aging, bucketAmount(daysBetween(item.date, asOf), item.remaining))
  }
  return aging
}

/** AP: credits open payables, debits apply payments */
function agingFromCreditsFirst(
  lines: Array<{ entryDate: Date; debit: number; credit: number }>,
  asOf: Date,
) {
  const sorted = [...lines].sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime())
  const open: Array<{ date: Date; remaining: number }> = []

  for (const line of sorted) {
    const dr = round2(Number(line.debit ?? 0))
    const cr = round2(Number(line.credit ?? 0))
    if (cr > 0) open.push({ date: line.entryDate, remaining: cr })
    if (dr > 0) {
      let left = dr
      for (const item of open) {
        if (left <= 0) break
        if (item.remaining <= 0) continue
        const apply = Math.min(item.remaining, left)
        item.remaining = round2(item.remaining - apply)
        left = round2(left - apply)
      }
    }
  }

  let aging = { ...EMPTY_AGING }
  for (const item of open) {
    if (item.remaining <= 0) continue
    aging = mergeAging(aging, bucketAmount(daysBetween(item.date, asOf), item.remaining))
  }
  return aging
}

async function fetchControlLines(opts: SubledgerOpts & {
  accountId: string
  partyField: 'customerId' | 'supplierId'
  partyId?: string
}) {
  const asOfKey = normalizeBusinessDate(opts.asOfKey)
  const asOfDate = businessDateDb(asOfKey)

  return prisma.journalLine.findMany({
    where: {
      tenantId: opts.tenantId,
      accountId: opts.accountId,
      ...(opts.partyId ? { [opts.partyField]: opts.partyId } : { [opts.partyField]: { not: null } }),
      ...(opts.branchId ? { OR: [{ branchId: null }, { branchId: opts.branchId }] } : {}),
      entry: {
        status: 'POSTED',
        entryDate: { lte: asOfDate },
        ...(opts.branchId ? { OR: [{ branchId: null }, { branchId: opts.branchId }] } : {}),
      },
    },
    include: {
      entry: {
        select: {
          id: true,
          entryNo: true,
          entryDate: true,
          memo: true,
          sourceModule: true,
          sourceRefType: true,
          sourceRefId: true,
        },
      },
    },
    orderBy: [{ entry: { entryDate: 'asc' } }, { lineNo: 'asc' }],
  })
}

function arBalance(lines: Array<{ debit: number; credit: number }>) {
  return round2(lines.reduce((s, l) => s + round2(Number(l.debit ?? 0)) - round2(Number(l.credit ?? 0)), 0))
}

function apBalance(lines: Array<{ debit: number; credit: number }>) {
  return round2(lines.reduce((s, l) => s + round2(Number(l.credit ?? 0)) - round2(Number(l.debit ?? 0)), 0))
}

export async function getArSubledgerSummary(opts: SubledgerOpts) {
  await assertInitialized(opts.tenantId)
  const arAccountId = await resolveControlAccountId(opts.tenantId, 'ar')
  const asOfKey = normalizeBusinessDate(opts.asOfKey)
  const asOfDate = businessDateDb(asOfKey)

  const lines = await fetchControlLines({ ...opts, accountId: arAccountId, partyField: 'customerId' })
  const byCustomer = new Map<string, typeof lines>()

  for (const line of lines) {
    if (!line.customerId) continue
    const list = byCustomer.get(line.customerId) ?? []
    list.push(line)
    byCustomer.set(line.customerId, list)
  }

  const customerIds = [...byCustomer.keys()]
  const customers = customerIds.length
    ? await prisma.customer.findMany({
        where: { tenantId: opts.tenantId, id: { in: customerIds } },
        select: { id: true, name: true, phone: true, totalDue: true },
      })
    : []
  const customerMap = new Map(customers.map(c => [c.id, c]))

  const rows = customerIds.map(id => {
    const partyLines = byCustomer.get(id)!
    const balance = arBalance(partyLines)
    const aging = agingFromDebitsFirst(
      partyLines.map(l => ({
        entryDate: l.entry.entryDate,
        debit: l.debit,
        credit: l.credit,
      })),
      asOfDate,
    )
    const c = customerMap.get(id)
    return {
      customerId: id,
      name: c?.name ?? 'Unknown',
      phone: c?.phone ?? '',
      operationalDue: round2(Number(c?.totalDue ?? 0)),
      balance,
      aging,
    }
  }).filter(r => Math.abs(r.balance) >= 0.01)
    .sort((a, b) => b.balance - a.balance)

  const totals = {
    balance: round2(rows.reduce((s, r) => s + r.balance, 0)),
    aging: rows.reduce((a, r) => mergeAging(a, r.aging), { ...EMPTY_AGING }),
  }

  const glControlBalance = arBalance(lines)
  const unallocated = round2(glControlBalance - totals.balance)

  return {
    asOf: asOfKey,
    accountCode: '1200',
    rows,
    totals,
    glControlBalance,
    unallocated,
  }
}

export async function getArCustomerDetail(opts: SubledgerOpts & { customerId: string }) {
  await assertInitialized(opts.tenantId)
  const arAccountId = await resolveControlAccountId(opts.tenantId, 'ar')
  const asOfKey = normalizeBusinessDate(opts.asOfKey)
  const asOfDate = businessDateDb(asOfKey)

  const customer = await prisma.customer.findFirst({
    where: { id: opts.customerId, tenantId: opts.tenantId },
    select: { id: true, name: true, phone: true, totalDue: true },
  })
  if (!customer) throw new AppError('Customer not found', 404)

  const lines = await fetchControlLines({
    ...opts,
    accountId: arAccountId,
    partyField: 'customerId',
    partyId: opts.customerId,
  })

  const balance = arBalance(lines)
  const aging = agingFromDebitsFirst(
    lines.map(l => ({ entryDate: l.entry.entryDate, debit: l.debit, credit: l.credit })),
    asOfDate,
  )

  const openInvoices = await prisma.sale.findMany({
    where: { tenantId: opts.tenantId, customerId: opts.customerId, dueAmount: { gt: 0 } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, invoiceNumber: true, dueAmount: true, createdAt: true },
  })

  return {
    asOf: asOfKey,
    customer,
    balance,
    aging,
    openInvoices: openInvoices.map(s => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      dueAmount: round2(Number(s.dueAmount)),
      date: businessDateFromInstant(s.createdAt),
    })),
    lines: lines.map((l, idx) => {
      const prior = lines.slice(0, idx + 1)
      return {
        id: l.id,
        entryNo: l.entry.entryNo,
        entryDate: businessDateFromInstant(l.entry.entryDate),
        memo: l.entry.memo,
        sourceModule: l.entry.sourceModule,
        description: l.description,
        debit: round2(Number(l.debit)),
        credit: round2(Number(l.credit)),
        runningBalance: arBalance(prior),
      }
    }),
  }
}

export async function getApSubledgerSummary(opts: SubledgerOpts) {
  await assertInitialized(opts.tenantId)
  const apAccountId = await resolveControlAccountId(opts.tenantId, 'ap')
  const asOfKey = normalizeBusinessDate(opts.asOfKey)
  const asOfDate = businessDateDb(asOfKey)

  const lines = await fetchControlLines({ ...opts, accountId: apAccountId, partyField: 'supplierId' })
  const bySupplier = new Map<string, typeof lines>()

  for (const line of lines) {
    if (!line.supplierId) continue
    const list = bySupplier.get(line.supplierId) ?? []
    list.push(line)
    bySupplier.set(line.supplierId, list)
  }

  const supplierIds = [...bySupplier.keys()]
  const suppliers = supplierIds.length
    ? await prisma.supplier.findMany({
        where: { tenantId: opts.tenantId, id: { in: supplierIds } },
        select: { id: true, name: true, phone: true, outstandingDues: true },
      })
    : []
  const supplierMap = new Map(suppliers.map(s => [s.id, s]))

  const rows = supplierIds.map(id => {
    const partyLines = bySupplier.get(id)!
    const balance = apBalance(partyLines)
    const aging = agingFromCreditsFirst(
      partyLines.map(l => ({
        entryDate: l.entry.entryDate,
        debit: l.debit,
        credit: l.credit,
      })),
      asOfDate,
    )
    const s = supplierMap.get(id)
    return {
      supplierId: id,
      name: s?.name ?? 'Unknown',
      phone: s?.phone ?? '',
      operationalDue: round2(Number(s?.outstandingDues ?? 0)),
      balance,
      aging,
    }
  }).filter(r => Math.abs(r.balance) >= 0.01)
    .sort((a, b) => b.balance - a.balance)

  const totals = {
    balance: round2(rows.reduce((s, r) => s + r.balance, 0)),
    aging: rows.reduce((a, r) => mergeAging(a, r.aging), { ...EMPTY_AGING }),
  }

  const glControlBalance = apBalance(lines)
  const unallocated = round2(glControlBalance - totals.balance)

  return {
    asOf: asOfKey,
    accountCode: '2100',
    rows,
    totals,
    glControlBalance,
    unallocated,
  }
}

export async function getApSupplierDetail(opts: SubledgerOpts & { supplierId: string }) {
  await assertInitialized(opts.tenantId)
  const apAccountId = await resolveControlAccountId(opts.tenantId, 'ap')
  const asOfKey = normalizeBusinessDate(opts.asOfKey)
  const asOfDate = businessDateDb(asOfKey)

  const supplier = await prisma.supplier.findFirst({
    where: { id: opts.supplierId, tenantId: opts.tenantId },
    select: { id: true, name: true, phone: true, outstandingDues: true },
  })
  if (!supplier) throw new AppError('Supplier not found', 404)

  const lines = await fetchControlLines({
    ...opts,
    accountId: apAccountId,
    partyField: 'supplierId',
    partyId: opts.supplierId,
  })

  const balance = apBalance(lines)
  const aging = agingFromCreditsFirst(
    lines.map(l => ({ entryDate: l.entry.entryDate, debit: l.debit, credit: l.credit })),
    asOfDate,
  )

  const openPurchaseOrders = await prisma.purchaseOrder.findMany({
    where: { tenantId: opts.tenantId, supplierId: opts.supplierId, dueAmount: { gt: 0 } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, poNumber: true, dueAmount: true, createdAt: true },
  })

  return {
    asOf: asOfKey,
    supplier,
    balance,
    aging,
    openPurchaseOrders: openPurchaseOrders.map(p => ({
      id: p.id,
      poNumber: p.poNumber,
      dueAmount: round2(Number(p.dueAmount)),
      date: businessDateFromInstant(p.createdAt),
    })),
    lines: lines.map((l, idx) => {
      const prior = lines.slice(0, idx + 1)
      return {
        id: l.id,
        entryNo: l.entry.entryNo,
        entryDate: businessDateFromInstant(l.entry.entryDate),
        memo: l.entry.memo,
        sourceModule: l.entry.sourceModule,
        description: l.description,
        debit: round2(Number(l.debit)),
        credit: round2(Number(l.credit)),
        runningBalance: apBalance(prior),
      }
    }),
  }
}
