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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <div className="flex items-center gap-2">
            <Hash size={16} className="text-violet-400" />
            <h3 className="text-base font-semibold text-white">Assign Tracking</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="rounded-xl p-3.5 text-sm" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{order.orderNumber}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{order.customerName} · {order.city}</p>
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
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Hash size={14} />}
              Assign & Dispatch
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
