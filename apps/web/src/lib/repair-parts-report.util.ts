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
  serviceCharge: number
  lines: RepairPartLine[]
  partsSellTotal: number
  partsBuyTotal: number
  partsProfit: number
  serviceProfit: number
  totalProfit: number
  /** Service estimate minus parts sell value (remaining for labour) */
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
): RepairPartsReport {
  const serviceCharge = Number(repair.estimatedCost ?? 0) || 0
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
  const partsProfit = partsSellTotal - partsBuyTotal
  const serviceProfit = serviceCharge
  const totalProfit = serviceProfit + partsProfit
  const estimateAfterParts = serviceCharge - partsSellTotal

  return {
    serviceCharge,
    lines,
    partsSellTotal,
    partsBuyTotal,
    partsProfit,
    serviceProfit,
    totalProfit,
    estimateAfterParts,
  }
}

export function aggregateRepairPartsReports(reports: RepairPartsReport[]) {
  return reports.reduce(
    (acc, r) => ({
      jobCount: acc.jobCount + 1,
      serviceCharge: acc.serviceCharge + r.serviceCharge,
      partsSellTotal: acc.partsSellTotal + r.partsSellTotal,
      partsBuyTotal: acc.partsBuyTotal + r.partsBuyTotal,
      partsProfit: acc.partsProfit + r.partsProfit,
      serviceProfit: acc.serviceProfit + r.serviceProfit,
      totalProfit: acc.totalProfit + r.totalProfit,
      partLineCount: acc.partLineCount + r.lines.length,
    }),
    {
      jobCount: 0,
      serviceCharge: 0,
      partsSellTotal: 0,
      partsBuyTotal: 0,
      partsProfit: 0,
      serviceProfit: 0,
      totalProfit: 0,
      partLineCount: 0,
    },
  )
}
