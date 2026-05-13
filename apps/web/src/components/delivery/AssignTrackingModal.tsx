'use client'

import { useState } from 'react'
import { X, Hash, Loader2, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { deliveryApi, DeliveryOrder, Courier } from '@/lib/delivery-api'

interface Props {
  order: DeliveryOrder
  couriers: Courier[]
  onClose: () => void
  onAssigned: () => void
}

export default function AssignTrackingModal({ order, couriers, onClose, onAssigned }: Props) {
  const [saving, setSaving]         = useState(false)
  const [courierId, setCourierId]   = useState(couriers.find(c => c.isDefault)?.id ?? '')
  const [trackingNumber, setTracking] = useState('')
  const [sendWA, setSendWA]         = useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courierId)      { toast.error('Select a courier'); return }
    if (!trackingNumber) { toast.error('Enter tracking number'); return }
    setSaving(true)
    try {
      await deliveryApi.assignTracking(order.id, { courierId, trackingNumber, sendWhatsApp: sendWA })
      toast.success('Tracking assigned! Waybill generated.')
      onAssigned()
    } catch (e: any) { toast.error(e?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Hash size={18} className="text-violet-400" />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Assign Tracking</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="rounded-lg p-3 bg-slate-800/50 text-sm">
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{order.orderNumber}</p>
            <p className="text-slate-400">{order.customerName} · {order.city}</p>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Courier Company *</label>
            <select className="input-field text-sm w-full" value={courierId} onChange={e => setCourierId(e.target.value)}>
              <option value="">Select courier...</option>
              {couriers.filter(c => c.isActive).map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Tracking Number *</label>
            <input className="input-field text-sm w-full font-mono" value={trackingNumber}
              onChange={e => setTracking(e.target.value.trim())}
              placeholder="e.g. KOOMB0012345" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={sendWA} onChange={e => setSendWA(e.target.checked)}
              className="rounded border-slate-600" />
            <MessageSquare size={14} className="text-green-400" />
            <span className="text-sm text-slate-300">Send WhatsApp notification to customer</span>
          </label>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Hash size={14} />}
              Assign & Dispatch
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
