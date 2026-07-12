'use client'

import { X, Printer, Hash, MessageSquare, MapPin, Phone, Truck, Calendar } from 'lucide-react'
import { DeliveryOrder } from '@/lib/delivery-api'
import { formatDate, formatCurrency, getDeliveryStatusColor } from '@/lib/utils'

const statusLabels: Record<string, string> = {
  PENDING: 'Pending', PACKED: 'Packed', AWAITING_TRACKING: 'Awaiting Tracking',
  DISPATCHED: 'Dispatched', IN_TRANSIT: 'In Transit', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
}

interface Props {
  order: DeliveryOrder
  onClose: () => void
  onAssignTracking: (o: DeliveryOrder) => void
  onGenerateWaybill: (o: DeliveryOrder) => void
  onResendWhatsApp: (id: string) => void
}

export default function OrderDetailModal({ order, onClose, onAssignTracking, onGenerateWaybill, onResendWhatsApp }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Truck size={16} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[11px] font-mono font-semibold text-violet-400 leading-none">{order.orderNumber}</p>
              <h3 className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{order.customerName}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${getDeliveryStatusColor(order.status)}`}>
              {statusLabels[order.status] ?? order.status}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => onGenerateWaybill(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
              <Printer size={11} /> Waybill
            </button>
            {!order.trackingNumber && (
              <button onClick={() => onAssignTracking(order)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-semibold text-white transition-all"
                style={{ background: 'var(--brand-gradient)', boxShadow: '0 2px 8px var(--sidebar-active-border)' }}>
                <Hash size={11} /> Assign Tracking
              </button>
            )}
            {order.trackingNumber && (
              <button onClick={() => onResendWhatsApp(order.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                <MessageSquare size={11} /> Resend WhatsApp
              </button>
            )}
          </div>

          {/* Customer + Address */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Phone size={13} className="text-cyan-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Customer</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{order.customerName}</p>
              <a href={`tel:${order.customerPhone}`} className="text-xs flex items-center gap-1 text-cyan-500 hover:underline mt-0.5">
                <Phone size={10} />{order.customerPhone}
              </a>
              {order.customerEmail && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{order.customerEmail}</p>}
            </div>
            <div className="rounded-xl p-3.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin size={13} className="text-violet-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Address</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ''}<br />
                {order.city}{order.district ? `, ${order.district}` : ''} {order.postalCode ?? ''}
              </p>
            </div>
          </div>

          {/* Courier & Tracking */}
          {(order.courier || order.trackingNumber) && (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Truck size={13} className="text-violet-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Courier & Tracking</span>
              </div>
              {order.courier && <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{order.courier.name} ({order.courier.code})</p>}
              {order.trackingNumber && <p className="font-mono text-violet-400 text-base font-bold mt-0.5">{order.trackingNumber}</p>}
              {order.dispatchedAt && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Calendar size={10} />Dispatched: {formatDate(order.dispatchedAt, 'long')}
                </p>
              )}
            </div>
          )}

          {/* Items */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Order Items</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="px-4 py-2 text-left text-[10px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Description</th>
                  <th className="px-4 py-2 text-center text-[10px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Qty</th>
                  <th className="px-4 py-2 text-right text-[10px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>{item.description}</td>
                    <td className="px-4 py-2.5 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="rounded-xl p-4 space-y-1.5 text-sm" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}><span>Delivery Charge</span><span>{formatCurrency(order.deliveryCharge)}</span></div>
            <div className="flex justify-between font-bold pt-1.5" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
              <span>Total</span><span>{formatCurrency(order.totalAmount)}</span>
            </div>
            {order.isCOD && (
              <div className="flex justify-between font-medium" style={{ color: '#fb923c' }}>
                <span>COD Amount</span><span>{formatCurrency(order.codAmount ?? order.totalAmount)}</span>
              </div>
            )}
          </div>

          {order.notes && (
            <div className="rounded-xl p-3.5 text-sm" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Note: </span>
              <span style={{ color: 'var(--text-muted)' }}>{order.notes}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] pt-1" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5"><Calendar size={11} />Created {formatDate(order.createdAt)}</span>
            {order.deliveredAt && <span className="flex items-center gap-1.5"><Calendar size={11} />Delivered {formatDate(order.deliveredAt)}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
