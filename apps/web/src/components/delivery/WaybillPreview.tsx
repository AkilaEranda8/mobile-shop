'use client'

import { X, Printer, QrCode, MapPin, Phone, Package, Truck } from 'lucide-react'
import { DeliveryOrder } from '@/lib/delivery-api'

interface Props { order: DeliveryOrder & { waybillNumber?: string }; onClose: () => void }

export default function WaybillPreview({ order, onClose }: Props) {
  const waybillNumber = (order as any).waybillNumber ?? 'WB-PENDING'

  const handlePrint = () => window.print()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 print:hidden">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Waybill Preview</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm">
              <Printer size={14} /> Print / Save PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Waybill Content – A5 style */}
        <div id="waybill" className="p-6 bg-white text-slate-900 text-sm print:p-4" style={{ minHeight: 400 }}>
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Truck size={22} className="text-violet-600" />
                <span className="text-xl font-bold text-slate-900">HEXALYTE</span>
              </div>
              <p className="text-xs text-slate-500">Delivery Waybill</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-slate-900 font-mono">{waybillNumber}</p>
              <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString('en-LK')}</p>
            </div>
          </div>

          {/* Tracking Number – prominent */}
          {order.trackingNumber && (
            <div className="border-2 border-slate-900 rounded p-3 mb-3 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Tracking Number</p>
              <p className="text-2xl font-bold font-mono tracking-widest text-slate-900">{order.trackingNumber}</p>
              {order.courier && <p className="text-xs text-slate-500 mt-1">{order.courier.name} ({order.courier.code})</p>}
            </div>
          )}

          {/* From / To */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="border border-slate-300 rounded p-2">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">From</p>
              <p className="font-semibold text-slate-900">Hexalyte Shop</p>
              <p className="text-xs text-slate-600">Sri Lanka</p>
            </div>
            <div className="border border-slate-900 rounded p-2">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">To (Recipient)</p>
              <p className="font-bold text-slate-900">{order.customerName}</p>
              <p className="text-xs text-slate-700 flex items-center gap-1">
                <Phone size={9} /> {order.customerPhone}
              </p>
              <p className="text-xs text-slate-600 flex items-start gap-1 mt-0.5">
                <MapPin size={9} className="mt-0.5 shrink-0" />
                <span>{order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ''}, {order.city}{order.district ? `, ${order.district}` : ''}</span>
              </p>
              {order.postalCode && <p className="text-xs text-slate-500">Postal: {order.postalCode}</p>}
            </div>
          </div>

          {/* Items */}
          <div className="border border-slate-300 rounded overflow-hidden mb-3">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1.5 text-left">Description</th>
                  <th className="px-2 py-1.5 text-center">Qty</th>
                  <th className="px-2 py-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="px-2 py-1.5">{item.description}</td>
                    <td className="px-2 py-1.5 text-center">{item.quantity}</td>
                    <td className="px-2 py-1.5 text-right">LKR {item.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals + COD */}
          <div className="flex justify-between items-start mb-3">
            <div>
              {order.isCOD && (
                <div className="border-2 border-red-600 rounded px-3 py-1.5 text-center">
                  <p className="text-xs font-bold text-red-600 uppercase">COLLECT ON DELIVERY</p>
                  <p className="text-lg font-bold text-red-600">LKR {(order.codAmount ?? order.totalAmount).toLocaleString()}</p>
                </div>
              )}
            </div>
            <div className="text-right text-xs space-y-0.5">
              <div className="flex justify-between gap-6 text-slate-600"><span>Subtotal</span><span>LKR {order.subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between gap-6 text-slate-600"><span>Delivery</span><span>LKR {order.deliveryCharge.toLocaleString()}</span></div>
              <div className="flex justify-between gap-6 font-bold text-slate-900 border-t border-slate-400 pt-0.5 mt-0.5">
                <span>TOTAL</span><span>LKR {order.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* QR placeholder + Signature */}
          <div className="flex justify-between items-end border-t border-slate-300 pt-3">
            <div className="border border-slate-300 rounded p-2 flex items-center justify-center" style={{ width: 60, height: 60 }}>
              <QrCode size={40} className="text-slate-400" />
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Order: {order.orderNumber}</p>
              {order.notes && <p className="max-w-48 text-right">Note: {order.notes}</p>}
              <div className="mt-4 border-t border-slate-400 pt-1 w-36 ml-auto">Recipient Signature</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
