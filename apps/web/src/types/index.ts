// ============================================================
// HEXALYTE — Core TypeScript Types
// ============================================================

// ---- Enums ----

export type UserRole = 'PLATFORM_ADMIN' | 'OWNER' | 'MANAGER' | 'CASHIER' | 'TECHNICIAN'

export type RepairStatus =
  | 'RECEIVED'
  | 'DIAGNOSED'
  | 'IN_REPAIR'
  | 'QC'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED'

export type WarrantyClaimStatus = 'OPEN' | 'ASSESSED' | 'IN_REPAIR' | 'RESOLVED' | 'REJECTED'

export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CLOSED'

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'WALLET' | 'CREDIT'

export type SubscriptionPlan = 'STARTER' | 'PRO' | 'ENTERPRISE'

export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELLED'

export type StockMovementType = 'PURCHASE' | 'SALE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT' | 'REPAIR_USE' | 'RETURN' | 'EXCHANGE_IN'

// ---- Auth ----

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
  branchIds: string[]
  tenantId: string
  createdAt: string
}

// ---- Tenant / Shop ----

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: SubscriptionPlan
  status: TenantStatus
  trialEndsAt?: string
  subscriptionEndsAt?: string
  ownerEmail: string
  ownerName: string
  branches: Branch[]
  createdAt: string
  mrr: number
}

export interface Branch {
  id: string
  tenantId: string
  name: string
  address: string
  city: string
  state: string
  phone: string
  email?: string
  isHeadquarters: boolean
  isActive: boolean
}

// ---- Inventory ----

export interface ProductVariation {
  id?: string
  storage: string
  colorName: string
  colorHex: string
  sku?: string
  sellingPrice: number
  /** Wholesale sell price; 0/omitted → fall back to sellingPrice (retail) */
  wholesalePrice?: number
  /** Credit sell price; 0/omitted → fall back to sellingPrice (retail) */
  creditPrice?: number
  costPrice: number
  stock?: number
}

export interface Category {
  id: string
  name: string
  slug: string
  productCount: number
  icon?: string
}

export interface Brand {
  id: string
  name: string
  logoUrl?: string
  productCount: number
}

export interface Product {
  id: string
  name: string
  sku: string
  barcode?: string
  categoryId: string
  categoryName: string
  brandId: string
  brandName: string
  description?: string
  buyingPrice: number
  sellingPrice: number
  /** Wholesale sell price; 0/omitted → fall back to sellingPrice (retail) */
  wholesalePrice?: number
  /** Credit sell price; 0/omitted → fall back to sellingPrice (retail) */
  creditPrice?: number
  mrp: number
  trackImei: boolean
  warrantyMonths: number
  warrantyNote?: string
  condition?: 'BRAND_NEW' | 'USED'
  subCategory?: string
  deviceModel?: string
  colorVariations?: { name: string; hex: string }[]
  imeiInStock?: number
  imeiGap?: number
  imageUrl?: string
  stock: number
  minStock: number
  branchId: string
  isActive: boolean
  createdAt: string
  storageVariations?: ProductVariation[]
}

export interface ImeiRecord {
  id: string
  imei: string
  productId: string
  productName: string
  status: 'IN_STOCK' | 'SOLD' | 'IN_REPAIR' | 'UNDER_WARRANTY_CLAIM' | 'SCRAPPED'
  branchId: string
  customerId?: string
  saleId?: string
  createdAt: string
}

export interface StockMovement {
  id: string
  productId: string
  productName: string
  type: StockMovementType
  quantity: number
  branchId: string
  reference?: string
  note?: string
  performedBy: string
  createdAt: string
}

// ---- Customer ----

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  city?: string
  loyaltyPoints: number
  totalPurchases: number
  totalDue: number
  totalRepairs: number
  notes?: string
  createdAt: string
}

// ---- POS / Sale ----

export interface SaleItem {
  productId: string
  productName: string
  sku: string
  imei?: string
  quantity: number
  unitPrice: number
  discount: number
  total: number
  warrantyMonths: number
}

export interface Sale {
  id: string
  invoiceNumber: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  items: SaleItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  payments: SalePayment[]
  paidAmount: number
  dueAmount: number
  status: 'PAID' | 'PARTIAL' | 'DUE'
  branchId: string
  cashierId: string
  cashierName: string
  createdAt: string
  notes?: string
}

export interface SalePayment {
  method: PaymentMethod
  amount: number
  reference?: string
}

// ---- Repair ----

export interface RepairTicket {
  id: string
  ticketNumber: string
  customerId: string
  customerName: string
  customerPhone: string
  deviceBrand: string
  deviceModel: string
  imei?: string
  accessories?: string
  /** Physical condition of the phone when received (scratches, dents, etc.) */
  deviceCondition?: string
  reportedIssue: string
  estimatedCost: number
  actualCost?: number
  paidAmount?: number
  dueAmount?: number
  status: RepairStatus
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  technicianId?: string
  technicianName?: string
  branchId: string
  photos: string[]
  notes: RepairNote[]
  spareParts: RepairSparePart[]
  statusHistory: RepairStatusHistory[]
  source?: string
  estimatedCompletion?: string
  completedAt?: string
  warrantyMonths?: number | null
  createdAt: string
}

export interface RepairNote {
  id: string
  text: string
  authorName: string
  isPublic: boolean
  createdAt: string
}

export interface RepairSparePart {
  id?: string
  productId: string
  productName: string
  quantity: number
  unitCost: number
  unitBuyCost?: number
  warrantyMonths?: number
  warrantyNote?: string | null
  total: number
}

export interface RepairStatusHistory {
  status: RepairStatus
  changedBy: string
  note?: string
  timestamp: string
}

// ---- Warranty ----

export interface Warranty {
  id: string
  warrantyCode: string
  saleId: string
  invoiceNumber: string
  customerId: string
  customerName: string
  customerPhone: string
  productId: string
  productName: string
  brandName: string
  imei?: string
  quantity?: number
  startDate: string
  endDate: string
  monthsDuration: number
  status: 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'VOID'
  claims: WarrantyClaim[]
  qrUrl: string
  createdAt: string
}

export interface WarrantyClaim {
  id: string
  warrantyId: string
  issue: string
  status: WarrantyClaimStatus
  repairTicketId?: string
  assessedBy?: string
  resolution?: string
  createdAt: string
}

// ---- Supplier ----

export interface Supplier {
  id: string
  name: string
  contactName: string
  phone: string
  email?: string
  address?: string
  city?: string
  gstin?: string
  totalOrders: number
  totalPurchaseValue: number
  outstandingDues: number
  isActive: boolean
  createdAt: string
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  supplierId: string
  supplierName: string
  items: POItem[]
  status: PurchaseOrderStatus
  subtotal: number
  tax: number
  total: number
  paidAmount: number
  dueAmount: number
  expectedDelivery?: string
  receivedAt?: string
  imeisRegisteredAt?: string
  imeiRegisteredCount?: number
  branchId: string
  notes?: string
  createdAt: string
}

export interface POItem {
  id?: string
  productId: string
  productName: string
  quantity: number
  receivedQuantity: number
  unitCost: number
  total: number
  storage?: string
  colorName?: string
  sku?: string
}

// ---- Finance ----

export interface Transaction {
  id: string
  type: 'INCOME' | 'EXPENSE'
  category: string
  amount: number
  description: string
  paymentMethod: PaymentMethod
  reference?: string
  branchId: string
  performedBy: string
  createdAt: string
  occurredAt?: string
  supplierId?: string
  purchaseOrderId?: string
}

export interface DailySummary {
  date: string
  totalSales: number
  totalRevenue: number
  totalExpenses: number
  supplierPayments?: number
  profit: number
  repairsCompleted: number
  newCustomers: number
  branchId: string
}

// ---- Analytics ----

export interface RevenueDataPoint {
  date: string
  revenue: number
  expenses: number
  profit: number
}

export interface TopProduct {
  productId: string
  productName: string
  brandName: string
  quantitySold: number
  revenue: number
}

export interface TechnicianKPI {
  technicianId: string
  technicianName: string
  repairsCompleted: number
  avgRepairTime: number
  revenue: number
  rating: number
}

// ---- UI Helpers ----

export interface SelectOption {
  value: string
  label: string
}

export interface TableColumn<T = any> {
  key: string
  label: string
  sortable?: boolean
  render?: (value: any, row: T) => unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  errors?: string[]
}
