import { api } from './api'

function qs(params?: Record<string, string | undefined | null>) {
  if (!params) return ''
  const cleaned: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') cleaned[k] = String(v)
  }
  const s = new URLSearchParams(cleaned).toString()
  return s ? `?${s}` : ''
}

export type WholesaleSellUnit = 'PIECE' | 'BOX' | 'CARTON'

export type WholesalePaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'WALLET'
  | 'CHEQUE'
  | 'CREDIT'

export type WholesaleDealer = {
  id: string
  dealerCode: string
  legalName: string
  tradingName?: string | null
  phone: string
  email?: string | null
  status: string
  creditLimit: number
  paymentTermsDays: number
  cashOnly: boolean
  totalDue: number
  creditBalance: number
  isActive: boolean
  notes?: string | null
  tierId?: string | null
  tier?: { id: string; name: string; code?: string | null } | null
  branch?: { id: string; name: string } | null
  assignedSalesRep?: { id: string; name: string; email?: string | null } | null
  createdAt?: string
}

export type WholesalePriceResolve = {
  unitPrice: number
  source: 'DEALER_OVERRIDE' | 'TIER_QTY_BREAK' | 'TIER_LIST' | 'PRODUCT_WHOLESALE'
  floorPrice: number | null
  moq: number | null
  priceListItemId: string | null
  sellUnit: WholesaleSellUnit
}

export type WholesaleAtp = {
  productId: string
  branchId: string
  sku: string | null
  onHand: number
  reserved: number
  atp: number
}

export type WholesaleSettings = {
  overdueToleranceDays: number
  imeiSoftReserveTtlMs: number
  allowPartialCarton: boolean
  defaultHoldPolicy: 'PARTIAL_BACKORDER' | 'HOLD_COMPLETE'
  ageingBuckets: number[]
  discountAuthorityPercent: number
}

export type WholesalePosCheckoutLine = {
  productId: string
  quantity: number
  sellUnit?: WholesaleSellUnit
  sku?: string | null
  imei?: string | null
  unitPrice?: number | null
  discount?: number | null
}

export type WholesalePosCheckoutPayment = {
  method: WholesalePaymentMethod
  amount: number
  reference?: string | null
}

export type WholesalePosCheckoutBody = {
  dealerId: string
  fulfillmentBranchId?: string
  salesRepId?: string | null
  notes?: string | null
  lines: WholesalePosCheckoutLine[]
  payments: WholesalePosCheckoutPayment[]
}

export const wholesaleApi = {
  health: () => api.get('/wholesale/health'),

  // Dealers
  dealers: (params?: Record<string, string>) =>
    api.get<{ data: WholesaleDealer[]; meta: { total: number; page: number; limit: number } }>(
      `/wholesale/dealers${qs(params)}`,
    ),
  dealer: (id: string) => api.get<{ data: WholesaleDealer }>(`/wholesale/dealers/${id}`),
  createDealer: (body: unknown) => api.post<{ data: WholesaleDealer }>('/wholesale/dealers', body),
  updateDealer: (id: string, body: unknown) =>
    api.patch<{ data: WholesaleDealer }>(`/wholesale/dealers/${id}`, body),
  approveDealer: (id: string, notes?: string) =>
    api.post<{ data: WholesaleDealer }>(`/wholesale/dealers/${id}/approve`, { notes }),
  holdDealer: (id: string, notes?: string) =>
    api.post<{ data: WholesaleDealer }>(`/wholesale/dealers/${id}/hold`, { notes }),
  suspendDealer: (id: string, notes?: string) =>
    api.post<{ data: WholesaleDealer }>(`/wholesale/dealers/${id}/suspend`, { notes }),

  // Pricing
  resolvePrice: (params: {
    dealerId: string
    productId: string
    quantity: number | string
    sellUnit?: WholesaleSellUnit
  }) =>
    api.get<{ data: WholesalePriceResolve }>(
      `/wholesale/pricing/resolve${qs({
        dealerId: params.dealerId,
        productId: params.productId,
        quantity: String(params.quantity),
        sellUnit: params.sellUnit,
      })}`,
    ),
  tiers: () => api.get<{ data: unknown[] }>('/wholesale/pricing/tiers'),
  createTier: (body: unknown) => api.post('/wholesale/pricing/tiers', body ?? {}),
  updateTier: (id: string, body: unknown) => api.patch(`/wholesale/pricing/tiers/${id}`, body),
  deleteTier: (id: string) => api.delete(`/wholesale/pricing/tiers/${id}`),
  priceLists: () => api.get<{ data: unknown[] }>('/wholesale/pricing/price-lists'),
  priceList: (id: string) => api.get(`/wholesale/pricing/price-lists/${id}`),
  createPriceList: (body: unknown) => api.post('/wholesale/pricing/price-lists', body ?? {}),
  updatePriceList: (id: string, body: unknown) =>
    api.patch(`/wholesale/pricing/price-lists/${id}`, body),
  deletePriceList: (id: string) => api.delete(`/wholesale/pricing/price-lists/${id}`),
  createPriceListItem: (priceListId: string, body: unknown) =>
    api.post(`/wholesale/pricing/price-lists/${priceListId}/items`, body ?? {}),
  updatePriceListItem: (itemId: string, body: unknown) =>
    api.patch(`/wholesale/pricing/items/${itemId}`, body),
  deletePriceListItem: (itemId: string) => api.delete(`/wholesale/pricing/items/${itemId}`),
  dealerOverrides: (dealerId: string) =>
    api.get(`/wholesale/pricing/overrides/${dealerId}`),
  createDealerOverride: (body: unknown) => api.post('/wholesale/pricing/overrides', body ?? {}),
  updateDealerOverride: (id: string, body: unknown) =>
    api.patch(`/wholesale/pricing/overrides/${id}`, body),
  deleteDealerOverride: (id: string) => api.delete(`/wholesale/pricing/overrides/${id}`),

  // POS
  checkout: (body: WholesalePosCheckoutBody) =>
    api.post<{ data: unknown }>('/wholesale/pos/checkout', body),
  atp: (params: { productId: string; branchId?: string; sku?: string }) =>
    api.get<{ data: WholesaleAtp }>(`/wholesale/pos/atp${qs(params)}`),
  softReserveImei: (body: { imei: string; ttlMs?: number }) =>
    api.post<{ data: { imei: string; reservedUntil?: string; ok?: boolean } }>(
      '/wholesale/pos/imei/soft-reserve',
      body,
    ),

  // Settings
  settings: () => api.get<{ data: WholesaleSettings }>('/wholesale/settings'),
  updateSettings: (body: Partial<WholesaleSettings>) =>
    api.patch<{ data: WholesaleSettings }>('/wholesale/settings', body),

  // Quotations
  quotations: (params?: Record<string, string>) =>
    api.get(`/wholesale/quotations${qs(params)}`),
  quotation: (id: string) => api.get(`/wholesale/quotations/${id}`),
  createQuotation: (body: unknown) => api.post('/wholesale/quotations', body ?? {}),
  updateQuotation: (id: string, body: unknown) => api.patch(`/wholesale/quotations/${id}`, body),
  issueQuotation: (id: string) => api.post(`/wholesale/quotations/${id}/issue`, {}),
  acceptQuotation: (id: string) => api.post(`/wholesale/quotations/${id}/accept`, {}),
  rejectQuotation: (id: string, body?: unknown) =>
    api.post(`/wholesale/quotations/${id}/reject`, body ?? {}),
  reviseQuotation: (id: string) => api.post(`/wholesale/quotations/${id}/revise`, {}),

  // Orders
  orders: (params?: Record<string, string>) => api.get(`/wholesale/orders${qs(params)}`),
  order: (id: string) => api.get(`/wholesale/orders/${id}`),
  createOrder: (body: unknown) => api.post('/wholesale/orders', body ?? {}),
  updateOrder: (id: string, body: unknown) => api.patch(`/wholesale/orders/${id}`, body),
  submitOrder: (id: string) => api.post(`/wholesale/orders/${id}/submit`, {}),
  confirmOrder: (id: string) => api.post(`/wholesale/orders/${id}/confirm`, {}),
  holdOrder: (id: string, body?: unknown) => api.post(`/wholesale/orders/${id}/hold`, body ?? {}),
  releaseHold: (id: string, body?: unknown) =>
    api.post(`/wholesale/orders/${id}/release-hold`, body ?? {}),
  cancelOrder: (id: string, body?: unknown) => api.post(`/wholesale/orders/${id}/cancel`, body ?? {}),

  // Warehouse
  pickQueue: (params?: Record<string, string>) =>
    api.get(`/wholesale/warehouse/pick-queue${qs(params)}`),
  pickLists: (params?: Record<string, string>) =>
    api.get(`/wholesale/warehouse/pick-lists${qs(params)}`),
  createPickList: (body: unknown) => api.post('/wholesale/warehouse/pick-lists', body ?? {}),
  pickList: (id: string) => api.get(`/wholesale/warehouse/pick-lists/${id}`),
  recordPick: (id: string, body: unknown) =>
    api.post(`/wholesale/warehouse/pick-lists/${id}/pick`, body ?? {}),
  completePick: (id: string) => api.post(`/wholesale/warehouse/pick-lists/${id}/complete`, {}),
  packPick: (id: string) => api.post(`/wholesale/warehouse/pick-lists/${id}/pack`, {}),
  dispatches: (params?: Record<string, string>) =>
    api.get(`/wholesale/warehouse/dispatches${qs(params)}`),
  dispatch: (id: string) => api.get(`/wholesale/warehouse/dispatches/${id}`),
  createDispatch: (body: unknown) => api.post('/wholesale/warehouse/dispatches', body ?? {}),
  bindDispatchImei: (id: string, body: unknown) =>
    api.post(`/wholesale/warehouse/dispatches/${id}/bind-imei`, body ?? {}),
  confirmDispatch: (id: string) => api.post(`/wholesale/warehouse/dispatches/${id}/confirm`, {}),

  // Delivery
  trips: (params?: Record<string, string>) =>
    api.get(`/wholesale/delivery/trips${qs(params)}`),
  createTrip: (body: unknown) => api.post('/wholesale/delivery/trips', body ?? {}),
  trip: (id: string) => api.get(`/wholesale/delivery/trips/${id}`),
  addTripStop: (id: string, body: unknown) =>
    api.post(`/wholesale/delivery/trips/${id}/stops`, body ?? {}),
  startTrip: (id: string) => api.post(`/wholesale/delivery/trips/${id}/start`, {}),
  completeTrip: (id: string) => api.post(`/wholesale/delivery/trips/${id}/complete`, {}),
  podStop: (tripId: string, stopId: string, body: unknown) =>
    api.post(`/wholesale/delivery/trips/${tripId}/stops/${stopId}/pod`, body ?? {}),

  // Returns
  returns: (params?: Record<string, string>) => api.get(`/wholesale/returns${qs(params)}`),
  getReturn: (id: string) => api.get(`/wholesale/returns/${id}`),
  createReturn: (body: unknown) => api.post('/wholesale/returns', body ?? {}),
  approveReturn: (id: string) => api.post(`/wholesale/returns/${id}/approve`, {}),
  qcReturn: (id: string, body?: unknown) => api.post(`/wholesale/returns/${id}/qc`, body ?? {}),
  dispositionReturn: (id: string, body: unknown) =>
    api.post(`/wholesale/returns/${id}/disposition`, body ?? {}),
  creditNoteReturn: (id: string) => api.post(`/wholesale/returns/${id}/credit-note`, {}),

  // Collections
  ageing: (params?: Record<string, string>) =>
    api.get(`/wholesale/collections/ageing${qs(params)}`),
  statement: (dealerId: string, params?: Record<string, string>) =>
    api.get(`/wholesale/collections/statement/${dealerId}${qs(params)}`),
  payments: (params?: Record<string, string>) =>
    api.get(`/wholesale/collections/payments${qs(params)}`),
  createPayment: (body: unknown) => api.post('/wholesale/collections/payments', body ?? {}),
  collectionTasks: (params?: Record<string, string>) =>
    api.get(`/wholesale/collections/tasks${qs(params)}`),
  createCollectionTask: (body: unknown) => api.post('/wholesale/collections/tasks', body ?? {}),
  updateCollectionTask: (id: string, body: unknown) =>
    api.patch(`/wholesale/collections/tasks/${id}`, body),

  // Reports
  salesByChannel: (params?: Record<string, string>) =>
    api.get(`/wholesale/reports/sales-by-channel${qs(params)}`),
  salesByDealer: (params?: Record<string, string>) =>
    api.get(`/wholesale/reports/sales-by-dealer${qs(params)}`),
  salesByProduct: (params?: Record<string, string>) =>
    api.get(`/wholesale/reports/sales-by-product${qs(params)}`),
  movers: (params?: Record<string, string>) =>
    api.get(`/wholesale/reports/movers${qs(params)}`),
  outstandingReport: (params?: Record<string, string>) =>
    api.get(`/wholesale/reports/outstanding${qs(params)}`),

  // Van
  vehicles: (params?: Record<string, string>) =>
    api.get(`/wholesale/van/vehicles${qs(params)}`),
  createVehicle: (body: unknown) => api.post('/wholesale/van/vehicles', body ?? {}),
  updateVehicle: (id: string, body: unknown) => api.patch(`/wholesale/van/vehicles/${id}`, body),
  reps: (params?: Record<string, string>) => api.get(`/wholesale/van/reps${qs(params)}`),
  createRep: (body: unknown) => api.post('/wholesale/van/reps', body ?? {}),
  updateRep: (id: string, body: unknown) => api.patch(`/wholesale/van/reps/${id}`, body),
  vanLoad: (body: unknown) => api.post('/wholesale/van/load', body ?? {}),
  vanSale: (body: unknown) => api.post('/wholesale/van/sale', body ?? {}),
  settlements: (params?: Record<string, string>) =>
    api.get(`/wholesale/van/settlements${qs(params)}`),
  createSettlement: (body: unknown) => api.post('/wholesale/van/settlements', body ?? {}),
  submitSettlement: (id: string) => api.post(`/wholesale/van/settlements/${id}/submit`, {}),
  approveSettlement: (id: string) => api.post(`/wholesale/van/settlements/${id}/approve`, {}),
  visits: (params?: Record<string, string>) => api.get(`/wholesale/van/visits${qs(params)}`),
  upsertVisit: (body: unknown) => api.post('/wholesale/van/visits', body ?? {}),
  arriveStop: (tripId: string, stopId: string) =>
    api.post(`/wholesale/delivery/trips/${tripId}/stops/${stopId}/arrive`, {}),
  closeReturn: (id: string) => api.post(`/wholesale/returns/${id}/close`, {}),
}
