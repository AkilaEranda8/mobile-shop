'use client'

import { X, Printer, Hash, MessageSquare, MapPin, Phone, Mail, Package } from 'lucide-react'
import { DeliveryOrder, STATUS_COLORS, STATUS_LABELS } from '@/lib/delivery-api'

interface Props {
  order: DeliveryOrder
  onClose: () => void
  onAssignTracking: (o: DeliveryOrder) => void
  onGenerateWaybill: (o: DeliveryOrder) => void
  onResendWhatsApp: (id: string) => void
}

export default function OrderDetailModal({ order, onClose, onAssignTracking, onGenerateWaybill, onResendWhatsApp }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl shadow-2xl max-h-[88vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div>
            <p className="font-mono font-bold text-violet-400 text-lg">{order.orderNumber}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => onGenerateWaybill(order)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm">
              <Printer size={13} /> Waybill
            </button>
            {!order.trackingNumber && (
              <button onClick={() => onAssignTracking(order)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm">
                <Hash size={13} /> Assign Tracking
              </button>
            )}
            {order.trackingNumber && (
              <button onClick={() => onResendWhatsApp(order.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm">
                <MessageSquare size={13} /> Resend WhatsApp
              </button>
            )}
          </div>

          {/* Customer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Customer</p>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{order.customerName}</p>
              <p className="text-sm text-slate-300 flex items-center gap-1"><Phone size={12} />{order.customerPhone}</p>
              {order.customerEmail && <p className="text-sm text-slate-400 flex items-center gap-1"><Mail size={12} />{order.customerEmail}</p>}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Delivery Address</p>
              <p className="text-sm text-slate-300 flex items-start gap-1">
                <MapPin size={12} className="mt-0.5 shrink-0" />
                <span>{order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ''}, {order.city}{order.district ? `, ${order.district}` : ''} {order.postalCode ?? ''}</span>
              </p>
            </div>
          </div>

          {/* Courier & Tracking */}
          {(order.courier || order.trackingNumber) && (
            <div className="rounded-xl p-3 bg-violet-500/10 border border-violet-500/20 space-y-1">
              <p className="text-xs text-violet-400 uppercase tracking-wider">Courier & Tracking</p>
              {order.courier && <p className="font-medium text-slate-200">{order.courier.name} ({order.courier.code})</p>}
              {order.trackingNumber && <p className="font-mono text-violet-300 text-lg font-bold">{order.trackingNumber}</p>}
              {order.dispatchedAt && <p className="text-xs text-slate-400">Dispatched: {new Date(order.dispatchedAt).toLocaleString()}</p>}
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Order Items</p>
            <div className="rounded-xl overflow-hidden border border-slate-700/50">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-slate-400">Description</th>
                    <th className="px-3 py-2 text-center text-xs text-slate-400">Qty</th>
                    <th className="px-3 py-2 text-right text-xs text-slate-400">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => (
                    <tr key={i} className="border-b border-slate-700/30">
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{item.description}</td>
                      <td className="px-3 py-2 text-center text-slate-300">{item.quantity}</td>
                      <td className="px-3 py-2 text-right text-slate-300">LKR {item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-xl p-3 bg-slate-800/50 space-y-1 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>LKR {order.subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between text-slate-400"><span>Delivery</span><span>LKR {order.deliveryCharge.toLocaleString()}</span></div>
            <div className="flex justify-between font-bold border-t border-slate-700 pt-1" style={{ color: 'var(--text-primary)' }}>
              <span>Total</span><span>LKR {order.totalAmount.toLocaleString()}</span>
            </div>
            {order.isCOD && (
              <div className="flex justify-between text-orange-300 font-medium pt-1">
                <span>COD Amount</span><span>LKR {(order.codAmount ?? order.totalAmount).toLocaleString()}</span>
              </div>
            )}
          </div>

          {order.notes && (
            <div className="text-sm text-slate-400 rounded-lg p-3 bg-slate-800/50">
              <span className="font-medium text-slate-300">Note:</span> {order.notes}
            </div>
          )}

          <p className="text-xs text-slate-500">Created: {new Date(order.createdAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
