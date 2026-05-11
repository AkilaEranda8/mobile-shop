import type {
  Product, Customer, RepairTicket, Sale, Warranty,
  Supplier, PurchaseOrder, Tenant, Branch, DailySummary,
  RevenueDataPoint, TopProduct, TechnicianKPI, Transaction
} from '@/types'

// ---- Branches ----
export const mockBranches: Branch[] = [
  { id: 'b1', tenantId: 't1', name: 'Main Branch - Anna Nagar', address: '42, 3rd Avenue', city: 'Chennai', state: 'TN', phone: '+91 98765 43210', email: 'annanagar@mobilehub.com', isHeadquarters: true, isActive: true },
  { id: 'b2', tenantId: 't1', name: 'T Nagar Showroom', address: '15, Pondy Bazaar', city: 'Chennai', state: 'TN', phone: '+91 98765 43211', email: 'tnagar@mobilehub.com', isHeadquarters: false, isActive: true },
  { id: 'b3', tenantId: 't1', name: 'Velachery Branch', address: '100, Velachery Main Rd', city: 'Chennai', state: 'TN', phone: '+91 98765 43212', isHeadquarters: false, isActive: true },
]

// ---- Products ----
export const mockProducts: Product[] = [
  { id: 'p1', name: 'iPhone 15 Pro Max 256GB', sku: 'IPH15PM-256', barcode: '8901234567890', categoryId: 'cat1', categoryName: 'Smartphones', brandId: 'br1', brandName: 'Apple', buyingPrice: 125000, sellingPrice: 139900, mrp: 159900, trackImei: true, warrantyMonths: 12, imageUrl: '', stock: 8, minStock: 3, branchId: 'b1', isActive: true, createdAt: '2024-01-15T10:00:00Z' },
  { id: 'p2', name: 'Samsung Galaxy S24 Ultra 512GB', sku: 'SGS24U-512', barcode: '8901234567891', categoryId: 'cat1', categoryName: 'Smartphones', brandId: 'br2', brandName: 'Samsung', buyingPrice: 95000, sellingPrice: 109999, mrp: 124999, trackImei: true, warrantyMonths: 12, imageUrl: '', stock: 12, minStock: 3, branchId: 'b1', isActive: true, createdAt: '2024-01-15T10:00:00Z' },
  { id: 'p3', name: 'OnePlus 12 256GB', sku: 'OP12-256', barcode: '8901234567892', categoryId: 'cat1', categoryName: 'Smartphones', brandId: 'br3', brandName: 'OnePlus', buyingPrice: 58000, sellingPrice: 64999, mrp: 69999, trackImei: true, warrantyMonths: 12, imageUrl: '', stock: 2, minStock: 5, branchId: 'b1', isActive: true, createdAt: '2024-01-16T10:00:00Z' },
  { id: 'p4', name: 'Realme GT 5 Pro', sku: 'RGT5P-256', barcode: '8901234567893', categoryId: 'cat1', categoryName: 'Smartphones', brandId: 'br4', brandName: 'Realme', buyingPrice: 34000, sellingPrice: 39999, mrp: 44999, trackImei: true, warrantyMonths: 12, imageUrl: '', stock: 15, minStock: 5, branchId: 'b1', isActive: true, createdAt: '2024-01-16T10:00:00Z' },
  { id: 'p5', name: 'iPhone Screen Replacement (OLED)', sku: 'SVC-IPH-OLED', categoryId: 'cat3', categoryName: 'Spare Parts', brandId: 'br1', brandName: 'Apple', buyingPrice: 4500, sellingPrice: 6500, mrp: 8000, trackImei: false, warrantyMonths: 3, stock: 24, minStock: 10, branchId: 'b1', isActive: true, createdAt: '2024-01-17T10:00:00Z' },
  { id: 'p6', name: 'Samsung Battery (S22)', sku: 'SVC-SAM-BAT-S22', categoryId: 'cat3', categoryName: 'Spare Parts', brandId: 'br2', brandName: 'Samsung', buyingPrice: 1200, sellingPrice: 2000, mrp: 2500, trackImei: false, warrantyMonths: 6, stock: 1, minStock: 5, branchId: 'b1', isActive: true, createdAt: '2024-01-17T10:00:00Z' },
  { id: 'p7', name: 'Anker 65W GaN Charger', sku: 'ACC-ANK-65W', barcode: '8901234567894', categoryId: 'cat2', categoryName: 'Accessories', brandId: 'br5', brandName: 'Anker', buyingPrice: 1800, sellingPrice: 2499, mrp: 2999, trackImei: false, warrantyMonths: 12, stock: 30, minStock: 10, branchId: 'b1', isActive: true, createdAt: '2024-01-18T10:00:00Z' },
  { id: 'p8', name: 'Spigen Case iPhone 15', sku: 'ACC-SPI-IPH15', barcode: '8901234567895', categoryId: 'cat2', categoryName: 'Accessories', brandId: 'br6', brandName: 'Spigen', buyingPrice: 600, sellingPrice: 999, mrp: 1499, trackImei: false, warrantyMonths: 6, stock: 45, minStock: 15, branchId: 'b1', isActive: true, createdAt: '2024-01-18T10:00:00Z' },
]

// ---- Customers ----
export const mockCustomers: Customer[] = [
  { id: 'c1', name: 'Arun Kumar', phone: '+91 98765 11111', email: 'arun@gmail.com', address: '12, Gandhi St', city: 'Chennai', loyaltyPoints: 850, totalPurchases: 3, totalDue: 0, totalRepairs: 2, notes: 'Premium customer', createdAt: '2024-01-10T10:00:00Z' },
  { id: 'c2', name: 'Priya Sharma', phone: '+91 98765 22222', email: 'priya@gmail.com', address: '45, Nehru Nagar', city: 'Chennai', loyaltyPoints: 420, totalPurchases: 2, totalDue: 5000, totalRepairs: 0, createdAt: '2024-01-12T10:00:00Z' },
  { id: 'c3', name: 'Mohammed Faizal', phone: '+91 98765 33333', email: 'faizal@gmail.com', city: 'Chennai', loyaltyPoints: 1200, totalPurchases: 5, totalDue: 0, totalRepairs: 3, createdAt: '2023-12-05T10:00:00Z' },
  { id: 'c4', name: 'Deepa Nair', phone: '+91 98765 44444', email: 'deepa@gmail.com', city: 'Chennai', loyaltyPoints: 200, totalPurchases: 1, totalDue: 12000, totalRepairs: 1, createdAt: '2024-02-01T10:00:00Z' },
  { id: 'c5', name: 'Rajesh Pillai', phone: '+91 98765 55555', city: 'Chennai', loyaltyPoints: 680, totalPurchases: 4, totalDue: 0, totalRepairs: 5, createdAt: '2023-11-20T10:00:00Z' },
  { id: 'c6', name: 'Anitha Krishnan', phone: '+91 98765 66666', email: 'anitha@gmail.com', city: 'Chennai', loyaltyPoints: 340, totalPurchases: 2, totalDue: 2500, totalRepairs: 1, createdAt: '2024-01-25T10:00:00Z' },
]

// ---- Repair Tickets ----
export const mockRepairTickets: RepairTicket[] = [
  {
    id: 'r1', ticketNumber: 'REP-24051', customerId: 'c1', customerName: 'Arun Kumar', customerPhone: '+91 98765 11111',
    deviceBrand: 'Apple', deviceModel: 'iPhone 13 Pro', imei: '353456789012345', reportedIssue: 'Screen cracked, touch not working on lower half',
    estimatedCost: 6500, status: 'IN_REPAIR', priority: 'HIGH', technicianId: 'tech1', technicianName: 'Karthik S',
    branchId: 'b1', photos: [], notes: [], spareParts: [{ productId: 'p5', productName: 'iPhone Screen (OLED)', quantity: 1, unitCost: 4500, total: 4500 }],
    statusHistory: [
      { status: 'RECEIVED', changedBy: 'Cashier', note: 'Device received', timestamp: '2024-05-11T09:00:00Z' },
      { status: 'DIAGNOSED', changedBy: 'Karthik S', note: 'OLED screen damaged', timestamp: '2024-05-11T10:30:00Z' },
      { status: 'IN_REPAIR', changedBy: 'Karthik S', note: 'Screen replacement started', timestamp: '2024-05-11T11:00:00Z' },
    ],
    estimatedCompletion: '2024-05-11T18:00:00Z', createdAt: '2024-05-11T09:00:00Z'
  },
  {
    id: 'r2', ticketNumber: 'REP-24052', customerId: 'c2', customerName: 'Priya Sharma', customerPhone: '+91 98765 22222',
    deviceBrand: 'Samsung', deviceModel: 'Galaxy S23', imei: '353456789012346', reportedIssue: 'Battery draining fast, overheating',
    estimatedCost: 2000, status: 'DIAGNOSED', priority: 'NORMAL', technicianId: 'tech2', technicianName: 'Ramesh V',
    branchId: 'b1', photos: [], notes: [], spareParts: [],
    statusHistory: [
      { status: 'RECEIVED', changedBy: 'Cashier', timestamp: '2024-05-11T11:00:00Z' },
      { status: 'DIAGNOSED', changedBy: 'Ramesh V', note: 'Battery needs replacement', timestamp: '2024-05-11T12:00:00Z' },
    ],
    estimatedCompletion: '2024-05-12T12:00:00Z', createdAt: '2024-05-11T11:00:00Z'
  },
  {
    id: 'r3', ticketNumber: 'REP-24048', customerId: 'c3', customerName: 'Mohammed Faizal', customerPhone: '+91 98765 33333',
    deviceBrand: 'OnePlus', deviceModel: 'Nord 3', imei: '353456789012347', reportedIssue: 'Speaker not working after water damage',
    estimatedCost: 3500, status: 'QC', priority: 'NORMAL', technicianId: 'tech1', technicianName: 'Karthik S',
    branchId: 'b1', photos: [], notes: [], spareParts: [],
    statusHistory: [
      { status: 'RECEIVED', changedBy: 'Cashier', timestamp: '2024-05-09T09:00:00Z' },
      { status: 'DIAGNOSED', changedBy: 'Karthik S', timestamp: '2024-05-09T11:00:00Z' },
      { status: 'IN_REPAIR', changedBy: 'Karthik S', timestamp: '2024-05-10T09:00:00Z' },
      { status: 'QC', changedBy: 'Karthik S', note: 'Speaker replaced, testing in progress', timestamp: '2024-05-11T09:00:00Z' },
    ],
    estimatedCompletion: '2024-05-11T15:00:00Z', createdAt: '2024-05-09T09:00:00Z'
  },
  {
    id: 'r4', ticketNumber: 'REP-24053', customerId: 'c5', customerName: 'Rajesh Pillai', customerPhone: '+91 98765 55555',
    deviceBrand: 'Xiaomi', deviceModel: 'Redmi Note 12 Pro', imei: '353456789012348', reportedIssue: 'Charging port damaged',
    estimatedCost: 1200, status: 'RECEIVED', priority: 'LOW', technicianId: undefined, technicianName: undefined,
    branchId: 'b1', photos: [], notes: [], spareParts: [],
    statusHistory: [{ status: 'RECEIVED', changedBy: 'Cashier', timestamp: '2024-05-11T13:30:00Z' }],
    createdAt: '2024-05-11T13:30:00Z'
  },
  {
    id: 'r5', ticketNumber: 'REP-24046', customerId: 'c4', customerName: 'Deepa Nair', customerPhone: '+91 98765 44444',
    deviceBrand: 'Apple', deviceModel: 'iPhone 14', imei: '353456789012349', reportedIssue: 'Face ID not working',
    estimatedCost: 4500, actualCost: 4500, status: 'READY', priority: 'HIGH', technicianId: 'tech2', technicianName: 'Ramesh V',
    branchId: 'b1', photos: [], notes: [], spareParts: [],
    statusHistory: [
      { status: 'RECEIVED', changedBy: 'Cashier', timestamp: '2024-05-07T09:00:00Z' },
      { status: 'DIAGNOSED', changedBy: 'Ramesh V', timestamp: '2024-05-08T09:00:00Z' },
      { status: 'IN_REPAIR', changedBy: 'Ramesh V', timestamp: '2024-05-09T09:00:00Z' },
      { status: 'QC', changedBy: 'Ramesh V', timestamp: '2024-05-10T09:00:00Z' },
      { status: 'READY', changedBy: 'Ramesh V', note: 'Ready for pickup, customer notified', timestamp: '2024-05-11T09:00:00Z' },
    ],
    completedAt: '2024-05-11T09:00:00Z', createdAt: '2024-05-07T09:00:00Z'
  },
]

// ---- Warranties ----
export const mockWarranties: Warranty[] = [
  { id: 'w1', warrantyCode: 'WRN-2024-00123', saleId: 's1', invoiceNumber: 'INV-2401-0012', customerId: 'c1', customerName: 'Arun Kumar', customerPhone: '+91 98765 11111', productId: 'p1', productName: 'iPhone 15 Pro Max 256GB', brandName: 'Apple', imei: '353456789012350', startDate: '2024-01-20', endDate: '2025-01-20', monthsDuration: 12, status: 'ACTIVE', claims: [], qrUrl: 'https://app.hexalyte.com/warranty/verify/w1', createdAt: '2024-01-20T15:00:00Z' },
  { id: 'w2', warrantyCode: 'WRN-2024-00124', saleId: 's2', invoiceNumber: 'INV-2401-0015', customerId: 'c3', customerName: 'Mohammed Faizal', customerPhone: '+91 98765 33333', productId: 'p2', productName: 'Samsung Galaxy S24 Ultra', brandName: 'Samsung', imei: '353456789012351', startDate: '2024-01-25', endDate: '2025-01-25', monthsDuration: 12, status: 'ACTIVE', claims: [], qrUrl: 'https://app.hexalyte.com/warranty/verify/w2', createdAt: '2024-01-25T14:00:00Z' },
  { id: 'w3', warrantyCode: 'WRN-2023-00089', saleId: 's3', invoiceNumber: 'INV-2311-0032', customerId: 'c5', customerName: 'Rajesh Pillai', customerPhone: '+91 98765 55555', productId: 'p3', productName: 'OnePlus 12 256GB', brandName: 'OnePlus', imei: '353456789012352', startDate: '2023-11-15', endDate: '2024-11-15', monthsDuration: 12, status: 'ACTIVE', claims: [], qrUrl: 'https://app.hexalyte.com/warranty/verify/w3', createdAt: '2023-11-15T11:00:00Z' },
  { id: 'w4', warrantyCode: 'WRN-2023-00045', saleId: 's4', invoiceNumber: 'INV-2305-0018', customerId: 'c2', customerName: 'Priya Sharma', customerPhone: '+91 98765 22222', productId: 'p4', productName: 'Realme GT 5 Pro', brandName: 'Realme', imei: '353456789012353', startDate: '2023-05-10', endDate: '2024-05-10', monthsDuration: 12, status: 'EXPIRED', claims: [], qrUrl: 'https://app.hexalyte.com/warranty/verify/w4', createdAt: '2023-05-10T10:00:00Z' },
]

// ---- Suppliers ----
export const mockSuppliers: Supplier[] = [
  { id: 'sup1', name: 'Ingram Micro Mobile', contactName: 'Suresh Babu', phone: '+91 44 2345 6789', email: 'suresh@ingrammicro.in', address: 'Perungudi Industrial Area', city: 'Chennai', gstin: '33AABCI1234F1Z5', totalOrders: 48, totalPurchaseValue: 8500000, outstandingDues: 250000, isActive: true, createdAt: '2023-01-01T00:00:00Z' },
  { id: 'sup2', name: 'Redington India Ltd', contactName: 'Vijay Kumar', phone: '+91 44 2398 5000', email: 'vijay@redington.co.in', city: 'Chennai', gstin: '33AAECR0001A1Z1', totalOrders: 62, totalPurchaseValue: 15200000, outstandingDues: 0, isActive: true, createdAt: '2023-01-01T00:00:00Z' },
  { id: 'sup3', name: 'Spare Parts Hub', contactName: 'Murugan', phone: '+91 98765 99999', city: 'Chennai', totalOrders: 120, totalPurchaseValue: 1200000, outstandingDues: 45000, isActive: true, createdAt: '2023-03-15T00:00:00Z' },
]

// ---- Purchase Orders ----
export const mockPurchaseOrders: PurchaseOrder[] = [
  { id: 'po1', poNumber: 'PO-2405-001', supplierId: 'sup1', supplierName: 'Ingram Micro Mobile', items: [{ productId: 'p1', productName: 'iPhone 15 Pro Max', quantity: 5, receivedQuantity: 5, unitCost: 125000, total: 625000 }, { productId: 'p2', productName: 'Samsung S24 Ultra', quantity: 8, receivedQuantity: 8, unitCost: 95000, total: 760000 }], status: 'RECEIVED', subtotal: 1385000, tax: 249300, total: 1634300, paidAmount: 1384300, dueAmount: 250000, expectedDelivery: '2024-05-05', receivedAt: '2024-05-04T14:00:00Z', branchId: 'b1', createdAt: '2024-05-01T10:00:00Z' },
  { id: 'po2', poNumber: 'PO-2405-002', supplierId: 'sup3', supplierName: 'Spare Parts Hub', items: [{ productId: 'p5', productName: 'iPhone Screen OLED', quantity: 10, receivedQuantity: 0, unitCost: 4500, total: 45000 }, { productId: 'p6', productName: 'Samsung Battery', quantity: 20, receivedQuantity: 0, unitCost: 1200, total: 24000 }], status: 'SENT', subtotal: 69000, tax: 12420, total: 81420, paidAmount: 0, dueAmount: 81420, expectedDelivery: '2024-05-15', branchId: 'b1', createdAt: '2024-05-10T09:00:00Z' },
]

// ---- Revenue data (last 30 days) ----
export const mockRevenueData: RevenueDataPoint[] = [
  { date: '2024-04-12', revenue: 185000, expenses: 42000, profit: 143000 },
  { date: '2024-04-13', revenue: 210000, expenses: 38000, profit: 172000 },
  { date: '2024-04-14', revenue: 95000, expenses: 25000, profit: 70000 },
  { date: '2024-04-15', revenue: 320000, expenses: 65000, profit: 255000 },
  { date: '2024-04-16', revenue: 175000, expenses: 41000, profit: 134000 },
  { date: '2024-04-17', revenue: 245000, expenses: 52000, profit: 193000 },
  { date: '2024-04-18', revenue: 190000, expenses: 44000, profit: 146000 },
  { date: '2024-04-19', revenue: 280000, expenses: 58000, profit: 222000 },
  { date: '2024-04-20', revenue: 160000, expenses: 35000, profit: 125000 },
  { date: '2024-04-21', revenue: 225000, expenses: 48000, profit: 177000 },
  { date: '2024-04-22', revenue: 195000, expenses: 42000, profit: 153000 },
  { date: '2024-04-23', revenue: 340000, expenses: 72000, profit: 268000 },
  { date: '2024-04-24', revenue: 290000, expenses: 61000, profit: 229000 },
  { date: '2024-04-25', revenue: 215000, expenses: 46000, profit: 169000 },
  { date: '2024-04-26', revenue: 180000, expenses: 38000, profit: 142000 },
  { date: '2024-04-27', revenue: 250000, expenses: 55000, profit: 195000 },
  { date: '2024-04-28', revenue: 310000, expenses: 68000, profit: 242000 },
  { date: '2024-04-29', revenue: 198000, expenses: 43000, profit: 155000 },
  { date: '2024-04-30', revenue: 275000, expenses: 59000, profit: 216000 },
  { date: '2024-05-01', revenue: 235000, expenses: 51000, profit: 184000 },
  { date: '2024-05-02', revenue: 310000, expenses: 66000, profit: 244000 },
  { date: '2024-05-03', revenue: 185000, expenses: 40000, profit: 145000 },
  { date: '2024-05-04', revenue: 295000, expenses: 63000, profit: 232000 },
  { date: '2024-05-05', revenue: 220000, expenses: 47000, profit: 173000 },
  { date: '2024-05-06', revenue: 265000, expenses: 56000, profit: 209000 },
  { date: '2024-05-07', revenue: 190000, expenses: 41000, profit: 149000 },
  { date: '2024-05-08', revenue: 345000, expenses: 74000, profit: 271000 },
  { date: '2024-05-09', revenue: 280000, expenses: 60000, profit: 220000 },
  { date: '2024-05-10', revenue: 315000, expenses: 67000, profit: 248000 },
  { date: '2024-05-11', revenue: 142000, expenses: 31000, profit: 111000 },
]

// ---- Top Products ----
export const mockTopProducts: TopProduct[] = [
  { productId: 'p1', productName: 'iPhone 15 Pro Max 256GB', brandName: 'Apple', quantitySold: 45, revenue: 6295500 },
  { productId: 'p2', productName: 'Samsung Galaxy S24 Ultra', brandName: 'Samsung', quantitySold: 62, revenue: 6819938 },
  { productId: 'p3', productName: 'OnePlus 12 256GB', brandName: 'OnePlus', quantitySold: 38, revenue: 2469962 },
  { productId: 'p7', productName: 'Anker 65W GaN Charger', brandName: 'Anker', quantitySold: 124, revenue: 309876 },
  { productId: 'p8', productName: 'Spigen Case iPhone 15', brandName: 'Spigen', quantitySold: 215, revenue: 214785 },
]

// ---- Technician KPIs ----
export const mockTechnicianKPIs: TechnicianKPI[] = [
  { technicianId: 'tech1', technicianName: 'Karthik S', repairsCompleted: 145, avgRepairTime: 3.2, revenue: 425000, rating: 4.8 },
  { technicianId: 'tech2', technicianName: 'Ramesh V', repairsCompleted: 128, avgRepairTime: 4.1, revenue: 385000, rating: 4.6 },
  { technicianId: 'tech3', technicianName: 'Praveen T', repairsCompleted: 98, avgRepairTime: 5.0, revenue: 292000, rating: 4.4 },
]

// ---- Tenants (Platform Admin) ----
export const mockTenants: Tenant[] = [
  { id: 't1', name: 'Mobile Hub Chennai', slug: 'mobile-hub-chennai', plan: 'PRO', status: 'ACTIVE', ownerEmail: 'owner@mobilehub.com', ownerName: 'Subramaniam R', branches: mockBranches, createdAt: '2024-01-01T00:00:00Z', mrr: 2499 },
  { id: 't2', name: 'Smart Phones Plus', slug: 'smart-phones-plus', plan: 'STARTER', status: 'ACTIVE', ownerEmail: 'owner@smartphonesplus.com', ownerName: 'Kavitha M', branches: [], createdAt: '2024-02-15T00:00:00Z', mrr: 999 },
  { id: 't3', name: 'Tech Repair Hub', slug: 'tech-repair-hub', plan: 'PRO', status: 'TRIAL', trialEndsAt: '2024-05-25T00:00:00Z', ownerEmail: 'owner@techrepairhub.com', ownerName: 'Arjun P', branches: [], createdAt: '2024-05-11T00:00:00Z', mrr: 0 },
  { id: 't4', name: 'Galaxy Mobile World', slug: 'galaxy-mobile-world', plan: 'ENTERPRISE', status: 'ACTIVE', ownerEmail: 'owner@galaxymobileworld.com', ownerName: 'Prakash N', branches: [], createdAt: '2023-11-01T00:00:00Z', mrr: 8500 },
  { id: 't5', name: 'iPhone Specialist', slug: 'iphone-specialist', plan: 'STARTER', status: 'SUSPENDED', ownerEmail: 'owner@iphonespecialist.com', ownerName: 'Divya K', branches: [], createdAt: '2024-03-10T00:00:00Z', mrr: 0 },
]

// ---- Recent Transactions ----
export const mockTransactions: Transaction[] = [
  { id: 'tr1', type: 'INCOME', category: 'Sale', amount: 139900, description: 'iPhone 15 Pro Max sale - INV-2405-0234', paymentMethod: 'UPI', branchId: 'b1', performedBy: 'Cashier 1', createdAt: '2024-05-11T10:30:00Z' },
  { id: 'tr2', type: 'INCOME', category: 'Repair', amount: 6500, description: 'Screen repair - REP-24051', paymentMethod: 'CASH', branchId: 'b1', performedBy: 'Cashier 1', createdAt: '2024-05-11T11:00:00Z' },
  { id: 'tr3', type: 'EXPENSE', category: 'Electricity', amount: 12000, description: 'Monthly electricity bill - May 2024', paymentMethod: 'BANK_TRANSFER', branchId: 'b1', performedBy: 'Manager', createdAt: '2024-05-11T09:00:00Z' },
  { id: 'tr4', type: 'INCOME', category: 'Sale', amount: 109999, description: 'Samsung S24 Ultra sale - INV-2405-0235', paymentMethod: 'CARD', branchId: 'b1', performedBy: 'Cashier 2', createdAt: '2024-05-11T12:00:00Z' },
  { id: 'tr5', type: 'EXPENSE', category: 'Inventory', amount: 81420, description: 'PO-2405-002 payment to Spare Parts Hub', paymentMethod: 'BANK_TRANSFER', branchId: 'b1', performedBy: 'Manager', createdAt: '2024-05-10T15:00:00Z' },
]

// ---- Dashboard Stats ----
export const mockDashboardStats = {
  todayRevenue: 142000,
  todayRevenueChange: 12.4,
  activeRepairs: 12,
  activeRepairsChange: -3,
  totalCustomers: 1842,
  newCustomersToday: 8,
  pendingDues: 68500,
  pendingDuesChange: 5.2,
  lowStockItems: 3,
  completedRepairsToday: 5,
  invoicesToday: 18,
  warrantyExpiringSoon: 7,
}
