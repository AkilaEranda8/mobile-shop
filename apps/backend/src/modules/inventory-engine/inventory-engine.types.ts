import type { Prisma } from '@prisma/client'

export type SaleStockLine = {
  productId?: string | null
  quantity: number
  sku?: string | null
  variationLabel?: string | null
  imei?: string | null
}

export type ApplySaleStockInput = {
  tx: Prisma.TransactionClient
  tenantId: string
  branchId: string
  saleId: string
  invoiceNumber: string
  cashierName: string
  customerId?: string | null
  items: SaleStockLine[]
}

export type PoReceiveItem = {
  id: string
  productId: string | null
  productName: string
  quantity: number
  receivedQuantity: number
  unitCost: number
  sku?: string | null
  storage?: string | null
  colorName?: string | null
}

export type ApplyPurchaseOrderReceiveInput = {
  tx: Prisma.TransactionClient
  tenantId: string
  poId: string
  poNumber: string
  branchId: string
  performedBy: string
  items: PoReceiveItem[]
  resolveProduct: (item: PoReceiveItem) => Promise<{ productId: string; branchId: string } | null>
}

export type SaleReturnStockLine = {
  productId?: string | null
  quantity: number
  sku?: string | null
  imei?: string | null
}

export type ApplySaleReturnStockInput = {
  tx: Prisma.TransactionClient
  tenantId: string
  branchId: string
  returnNumber: string
  invoiceNumber: string
  reason: string
  performedBy: string
  items: SaleReturnStockLine[]
}

export type RepairSparePartStockLine = {
  productId?: string | null
  quantity: number
}

export type ApplyRepairSparePartsStockInput = {
  tx: Prisma.TransactionClient
  tenantId: string
  branchId: string
  ticketNumber: string
  performedBy: string
  items: RepairSparePartStockLine[]
}

export type ApplyStockTransferInput = {
  tx: Prisma.TransactionClient
  tenantId: string
  product: {
    id: string
    sku: string
    stock: number
    trackImei: boolean
    branchId: string
    name: string
    barcode: string | null
    categoryId: string
    brandId: string
    description: string | null
    buyingPrice: number
    sellingPrice: number
    mrp: number
    warrantyMonths: number
    warrantyNote: string | null
    imageUrl: string | null
    minStock: number
    storageVariations: unknown
    colorVariations: unknown
    subCategory: string | null
    deviceModel: string | null
    condition: string
  }
  productId: string
  fromBranchId: string
  toBranchId: string
  quantity: number
  variationKey?: string
  imeis?: string[]
  isFullProduct: boolean
  isFullImeiTransfer: boolean
  reference: string
  movementNote?: string
  performedBy: string
}

export type ApplyExchangeTradeInStockInput = {
  tx: Prisma.TransactionClient
  tenantId: string
  branchId: string
  exchangeNumber: string
  performedBy: string
  tradeInProduct: {
    id: string
    storageVariations: unknown
  }
  oldImei: string
  oldBrand: string
  oldModel: string
  oldStorage?: string | null
  oldColor?: string | null
  buyPrice: number
  tradeInVariation?: string
  existingImei: boolean
}

export type ApplyExchangeSoldStockInput = {
  tx: Prisma.TransactionClient
  tenantId: string
  branchId: string
  exchangeNumber: string
  invoiceNumber: string
  performedBy: string
  soldProductId: string
  soldImei: string
  soldVariation?: string | null
  customerId?: string | null
  saleId: string
}

/** Absolute catalog/manual stock set → StockMovement type ADJUSTMENT. */
export type ApplyStockAdjustmentInput = {
  tx: Prisma.TransactionClient
  tenantId: string
  productId: string
  branchId: string
  performedBy: string
  reference?: string
  note?: string
  /** Target parent stock. Derived from variants when `targetStorageVariations` has stock. */
  targetStock?: number
  targetStorageVariations?: unknown
  /**
   * Override previous effective stock for delta (e.g. product create → treat as 0).
   * Default: load current product effective stock.
   */
  previousEffectiveStock?: number
  /** Product already at target — only write StockMovement when delta ≠ 0. */
  movementOnly?: boolean
}
