import type { RepairTicket } from '@/types'
import { buildRepairPartsReport, aggregateRepairPartsReports, type RepairPartsReport } from '@/lib/repair-parts-report.util'
import { repairPaymentSummary } from '@/lib/repair.util'

export type RepairStatementRow = {
  repair: RepairTicket
  report: RepairPartsReport
  payment: ReturnType<typeof repairPaymentSummary>
  partsCount: number
}

export type RepairStatementTotals = ReturnType<typeof aggregateRepairPartsReports> & {
  cashReceived: number
  creditDue: number
  labourShare: number
  partsMargin: number
  avgProfitPerJob: number
  marginPct: number
}

export type RepairStatusBreakdown = { status: string; count: number }[]

export type RepairDailyDelivered = {
  date: string
  label: string
  jobs: number
  collected: number
  profit: number
  partsCost: number
}

function parseDayStart(s: string) {
  return new Date(`${s}T00:00:00`)
}

function parseDayEnd(s: string) {
  return new Date(`${s}T23:59:59.999`)
}

export function filterRepairsByCreated(
  repairs: RepairTicket[],
  fromDate?: string,
  toDate?: string,
): RepairTicket[] {
  const from = fromDate ? parseDayStart(fromDate) : null
  const to = toDate ? parseDayEnd(toDate) : null
  return repairs.filter((r) => {
    const d = new Date(r.createdAt)
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  })
}

export function filterRepairsByCompleted(
  repairs: RepairTicket[],
  fromDate?: string,
  toDate?: string,
): RepairTicket[] {
  const from = fromDate ? parseDayStart(fromDate) : null
  const to = toDate ? parseDayEnd(toDate) : null
  return repairs.filter((r) => {
    if (r.status !== 'DELIVERED') return false
    const d = new Date(r.completedAt ?? r.createdAt)
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  })
}

export function computeStatusBreakdown(repairs: RepairTicket[]): RepairStatusBreakdown {
  const map = new Map<string, number>()
  for (const r of repairs) {
    map.set(r.status, (map.get(r.status) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
}

export function buildRepairStatementRow(
  repair: RepairTicket,
  getBuyPrice?: (productId: string) => number | undefined,
): RepairStatementRow {
  const report = buildRepairPartsReport(repair, getBuyPrice)
  const payment = repairPaymentSummary(repair)
  return {
    repair,
    report,
    payment,
    partsCount: repair.spareParts?.length ?? 0,
  }
}

export function buildRepairStatementRows(
  repairs: RepairTicket[],
  getBuyPrice?: (productId: string) => number | undefined,
): RepairStatementRow[] {
  return repairs.map((r) => buildRepairStatementRow(r, getBuyPrice))
}

export function aggregateRepairStatement(rows: RepairStatementRow[]): RepairStatementTotals {
  const delivered = rows.filter((r) => r.repair.status === 'DELIVERED')
  const base = aggregateRepairPartsReports(delivered.map((r) => r.report))
  const cashReceived = delivered.reduce((s, r) => s + r.payment.paid, 0)
  const creditDue = delivered.reduce((s, r) => s + r.payment.due, 0)
  const labourShare = delivered.reduce((s, r) => s + r.report.labourShare, 0)
  const partsMargin = base.partsProfit
  const avgProfitPerJob = base.jobCount > 0 ? base.totalProfit / base.jobCount : 0
  const marginPct = base.customerRevenue > 0
    ? Math.round((base.totalProfit / base.customerRevenue) * 1000) / 10
    : 0
  return {
    ...base,
    labourShare,
    partsMargin,
    cashReceived,
    creditDue,
    avgProfitPerJob,
    marginPct,
  }
}

export function groupDeliveredByDay(rows: RepairStatementRow[]): RepairDailyDelivered[] {
  const map = new Map<string, RepairDailyDelivered>()
  for (const row of rows) {
    if (row.repair.status !== 'DELIVERED') continue
    const raw = row.repair.completedAt ?? row.repair.createdAt
    const date = raw.slice(0, 10)
    const cur = map.get(date) ?? {
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString('en-LK', { day: 'numeric', month: 'short' }),
      jobs: 0,
      collected: 0,
      profit: 0,
      partsCost: 0,
    }
    cur.jobs += 1
    cur.collected += row.report.customerRevenue
    cur.profit += row.report.netProfit
    cur.partsCost += row.report.partsBuyTotal
    map.set(date, cur)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export const FULL_STATEMENT_HEADERS = [
  'Ticket', 'Received', 'Completed', 'Status', 'Customer', 'Phone', 'Device', 'Technician',
  'Quote', 'Discount', 'Bill Total', 'Collected', 'Cash Paid', 'Credit Due',
  'Parts', 'Parts Buy', 'Parts Sell', 'Parts Margin', 'Labour Share', 'Net Profit', 'Fault',
] as const

export function fullStatementCsvRow(row: RepairStatementRow): (string | number)[] {
  const { repair: r, report, payment } = row
  const isDelivered = r.status === 'DELIVERED'
  return [
    r.ticketNumber,
    r.createdAt?.slice(0, 10) ?? '',
    r.completedAt?.slice(0, 10) ?? '',
    r.status,
    r.customerName,
    r.customerPhone,
    `${r.deviceBrand} ${r.deviceModel}`.trim(),
    r.technicianName ?? '',
    report.serviceCharge,
    isDelivered ? report.discount : 0,
    isDelivered ? payment.billTotal : report.serviceCharge,
    isDelivered ? report.customerRevenue : 0,
    isDelivered ? payment.paid : 0,
    isDelivered ? payment.due : 0,
    row.partsCount,
    isDelivered ? report.partsBuyTotal : 0,
    isDelivered ? report.partsSellTotal : 0,
    isDelivered ? report.partsMargin : 0,
    isDelivered ? report.labourShare : 0,
    isDelivered ? report.netProfit : 0,
    (r.reportedIssue ?? '').replace(/\s+/g, ' ').trim(),
  ]
}

export const PARTS_DETAIL_HEADERS = [
  'Ticket', 'Completed', 'Customer', 'Device', 'Part', 'Qty', 'Unit Buy', 'Unit Sell', 'Buy Total', 'Sell Total', 'Line Margin',
] as const

export function partsDetailCsvRows(rows: RepairStatementRow[]): (string | number)[][] {
  const out: (string | number)[][] = []
  for (const row of rows) {
    if (row.repair.status !== 'DELIVERED') continue
    const { repair: r, report } = row
    for (const line of report.lines) {
      out.push([
        r.ticketNumber,
        r.completedAt?.slice(0, 10) ?? '',
        r.customerName,
        `${r.deviceBrand} ${r.deviceModel}`.trim(),
        line.productName,
        line.quantity,
        line.unitBuy,
        line.unitSell,
        line.buyTotal,
        line.sellTotal,
        line.lineProfit,
      ])
    }
  }
  return out
}

export function csvEscape(value: string | number): string {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function buildCsvContent(headers: readonly string[], rows: (string | number)[][]): string {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
  ]
  return lines.join('\n')
}
