import type { RepairTicket, RepairSparePart } from '@/types'

export type RepairPartLine = {
  id?: string
  productId: string
  productName: string
  quantity: number
  unitSell: number
  unitBuy: number
  sellTotal: number
  buyTotal: number
  lineProfit: number
}

export type RepairPartsReport = {
  /** Original estimate / quote */
  serviceCharge: number
  /** Discount applied on payment (quote − collected) */
  discount: number
  /** Amount customer pays after discount */
  customerRevenue: number
  lines: RepairPartLine[]
  partsSellTotal: number
  partsBuyTotal: number
  partsProfit: number
  /** Labour share in quote (quote − parts sell reference) */
  labourFromEstimate: number
  /** Labour after discount (customer revenue − parts sell) */
  labourShare: number
  /** Same as partsProfit */
  partsMargin: number
  /** Net profit = customer revenue − parts buy */
  totalProfit: number
  netProfit: number
  estimateAfterParts: number
}

type PartRow = RepairSparePart & { id?: string; unitBuyCost?: number }

function resolveUnitBuy(
  part: PartRow,
  getBuyPrice?: (productId: string) => number | undefined,
): number {
  if (part.unitBuyCost != null && part.unitBuyCost > 0) return Number(part.unitBuyCost)
  const fromProduct = getBuyPrice?.(part.productId)
  if (fromProduct != null && fromProduct > 0) return fromProduct
  return 0
}

export function buildRepairPartsReport(
  repair: Pick<RepairTicket, 'estimatedCost' | 'spareParts' | 'actualCost' | 'status'>,
  getBuyPrice?: (productId: string) => number | undefined,
  opts?: { pendingDiscount?: number },
): RepairPartsReport {
  const quote = Number(repair.estimatedCost ?? 0) || 0
  const isPaid = repair.status === 'DELIVERED'

  let discount = 0
  if (isPaid && repair.actualCost != null) {
    discount = Math.max(0, quote - Number(repair.actualCost))
  } else if (opts?.pendingDiscount != null && opts.pendingDiscount > 0) {
    discount = Math.min(quote, Math.max(0, Number(opts.pendingDiscount)))
  }

  const customerRevenue = Math.max(0, quote - discount)
  const lines: RepairPartLine[] = (repair.spareParts ?? []).map((raw) => {
    const part = raw as PartRow
    const qty = Number(part.quantity) || 1
    const unitSell = Number(part.unitCost) || (qty > 0 ? Number(part.total) / qty : 0)
    const unitBuy = resolveUnitBuy(part, getBuyPrice)
    const sellTotal = Number(part.total) || unitSell * qty
    const buyTotal = unitBuy * qty
    return {
      id: part.id,
      productId: part.productId,
      productName: part.productName,
      quantity: qty,
      unitSell,
      unitBuy,
      sellTotal,
      buyTotal,
      lineProfit: sellTotal - buyTotal,
    }
  })

  const partsSellTotal = lines.reduce((s, l) => s + l.sellTotal, 0)
  const partsBuyTotal = lines.reduce((s, l) => s + l.buyTotal, 0)
  const partsMargin = partsSellTotal - partsBuyTotal
  const labourFromEstimate = quote - partsSellTotal
  const labourShare = customerRevenue - partsSellTotal
  const netProfit = customerRevenue - partsBuyTotal

  return {
    serviceCharge: quote,
    discount,
    customerRevenue,
    lines,
    partsSellTotal,
    partsBuyTotal,
    partsProfit: partsMargin,
    labourFromEstimate,
    labourShare,
    partsMargin,
    totalProfit: netProfit,
    netProfit,
    estimateAfterParts: labourFromEstimate,
  }
}

export function aggregateRepairPartsReports(reports: RepairPartsReport[]) {
  return reports.reduce(
    (acc, r) => ({
      jobCount: acc.jobCount + 1,
      serviceCharge: acc.serviceCharge + r.serviceCharge,
      discount: acc.discount + r.discount,
      customerRevenue: acc.customerRevenue + r.customerRevenue,
      partsSellTotal: acc.partsSellTotal + r.partsSellTotal,
      partsBuyTotal: acc.partsBuyTotal + r.partsBuyTotal,
      partsProfit: acc.partsProfit + r.partsProfit,
      labourFromEstimate: acc.labourFromEstimate + r.labourFromEstimate,
      totalProfit: acc.totalProfit + r.totalProfit,
      partLineCount: acc.partLineCount + r.lines.length,
    }),
    {
      jobCount: 0,
      serviceCharge: 0,
      discount: 0,
      customerRevenue: 0,
      partsSellTotal: 0,
      partsBuyTotal: 0,
      partsProfit: 0,
      labourFromEstimate: 0,
      totalProfit: 0,
      partLineCount: 0,
    },
  )
}
