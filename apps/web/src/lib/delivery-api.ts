import { api } from './api'

export type DeliveryStatus = 'PENDING' | 'PACKED' | 'AWAITING_TRACKING' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED'
export type TrackingNumberStatus = 'AVAILABLE' | 'ASSIGNED' | 'USED'
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING'

export interface DeliveryItem {
  id:          string
  description: string
  quantity:    number
  unitPrice:   number
  total:       number
}

export interface Courier {
  id:        string
  name:      string
  code:      string
  logoUrl?:  string
  website?:  string
  phone?:    string
  isActive:  boolean
  isDefault: boolean
  _count?:   { trackingPool: number; deliveryOrders: number }
}

export interface DeliveryOrder {
  id:             string
  orderNumber:    string
  customerName:   string
  customerPhone:  string
  customerEmail?: string
  addressLine1:   string
  addressLine2?:  string
  city:           string
  district?:      string
  postalCode?:    string
  subtotal:       number
  deliveryCharge: number
  totalAmount:    number
  codAmount?:     number
  isCOD:          boolean
  courierId?:     string
  trackingNumber?: string
  status:         DeliveryStatus
  notes?:         string
  dispatchedAt?:  string
  deliveredAt?:   string
  createdAt:      string
  updatedAt:      string
  courier?:       Courier
  items:          DeliveryItem[]
}

export interface TrackingNumber {
  id:              string
  courierId:       string
  number:          string
  status:          TrackingNumberStatus
  assignedAt?:     string
  deliveryOrderId?: string
  courier:         { name: string; code: string }
}

export interface DeliveryNotification {
  id:              string
  deliveryOrderId: string
  channel:         string
  phone:           string
  message:         string
  status:          NotificationStatus
  errorMessage?:   string
  sentAt?:         string
  retryCount:      number
  createdAt:       string
  deliveryOrder:   { orderNumber: string; customerName: string }
}

export interface DeliveryStats {
  total:            number
  pending:          number
  dispatched:       number
  delivered:        number
  awaitingTracking: number
}

function qs(params?: Record<string, any>): string {
  if (!params) return ''
  const p = Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
  return p.length ? '?' + p.join('&') : ''
}

export const deliveryApi = {
  // Orders
  getOrders:       (params?: Record<string, any>) => api.get(`/delivery${qs(params)}`),
  getOrder:        (id: string)   => api.get(`/delivery/${id}`),
  createOrder:     (data: any)    => api.post('/delivery', data),
  updateOrder:     (id: string, data: any) => api.put(`/delivery/${id}`, data),
  assignTracking:  (id: string, data: any) => api.post(`/delivery/${id}/assign-tracking`, data),
  generateWaybill: (id: string)   => api.post(`/delivery/${id}/waybill`, {}),
  resendWhatsApp:  (id: string)   => api.post(`/delivery/${id}/resend-whatsapp`, {}),
  getStats:        ()             => api.get('/delivery/stats'),

  // Couriers
  getCouriers:    ()              => api.get('/delivery/couriers/list'),
  createCourier:  (data: any)     => api.post('/delivery/couriers', data),
  updateCourier:  (id: string, data: any) => api.put(`/delivery/couriers/${id}`, data),
  deleteCourier:  (id: string)    => api.delete(`/delivery/couriers/${id}`),
  seedCouriers:   ()              => api.post('/delivery/couriers/seed', {}),

  // Tracking pool
  getTracking:     (params?: Record<string, any>) => api.get(`/delivery/tracking/pool${qs(params)}`),
  bulkAddTracking: (data: any)    => api.post('/delivery/tracking/bulk', data),
  deleteTracking:  (id: string)   => api.delete(`/delivery/tracking/${id}`),

  // Notifications
  getNotifications:  (orderId?: string) => api.get(`/delivery/notifications/list${qs(orderId ? { orderId } : undefined)}`),
  retryNotification: (id: string)       => api.post(`/delivery/notifications/${id}/retry`, {}),
}

export const STATUS_COLORS: Record<DeliveryStatus, string> = {
  PENDING:           'bg-slate-500/20 text-slate-300',
  PACKED:            'bg-blue-500/20 text-blue-300',
  AWAITING_TRACKING: 'bg-yellow-500/20 text-yellow-300',
  DISPATCHED:        'bg-violet-500/20 text-violet-300',
  IN_TRANSIT:        'bg-orange-500/20 text-orange-300',
  DELIVERED:         'bg-green-500/20 text-green-300',
  CANCELLED:         'bg-red-500/20 text-red-300',
}

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING:           'Pending',
  PACKED:            'Packed',
  AWAITING_TRACKING: 'Awaiting Tracking',
  DISPATCHED:        'Dispatched',
  IN_TRANSIT:        'In Transit',
  DELIVERED:         'Delivered',
  CANCELLED:         'Cancelled',
}
