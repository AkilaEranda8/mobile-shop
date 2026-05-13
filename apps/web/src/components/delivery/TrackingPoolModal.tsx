'use client'

import { useState } from 'react'
import { X, Upload, Plus, Loader2, Hash } from 'lucide-react'
import toast from 'react-hot-toast'
import { deliveryApi, Courier } from '@/lib/delivery-api'

interface Props { couriers: Courier[]; onClose: () => void; onRefresh: () => void }

export default function TrackingPoolModal({ couriers, onClose, onRefresh }: Props) {
  const [saving, setSaving]         = useState(false)
  const [courierId, setCourierId]   = useState(couriers.find(c => c.isDefault)?.id ?? '')
  const [bulkText, setBulkText]     = useState('')
  const [result, setResult]         = useState<{ added: number; duplicates: number } | null>(null)

  const parseNumbers = (text: string) =>
    text.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courierId) { toast.error('Select a courier'); return }
    const numbers = parseNumbers(bulkText)
    if (numbers.length === 0) { toast.error('Enter at least one tracking number'); return }
    if (numbers.length > 500) { toast.error('Max 500 numbers at a time'); return }
    setSaving(true)
    try {
      const res: any = await deliveryApi.bulkAddTracking({ courierId, numbers })
      const d = res?.data ?? res
      setResult(d)
      toast.success(`${d.added} numbers added${d.duplicates > 0 ? `, ${d.duplicates} duplicates skipped` : ''}`)
      setBulkText('')
      onRefresh()
    } catch (e: any) { toast.error(e?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <div className="flex items-center gap-2">
            <Hash size={16} className="text-violet-400" />
            <h3 className="text-base font-semibold text-white">Tracking Number Pool</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Courier *</label>
            <select className="input-field text-sm w-full" value={courierId} onChange={e => setCourierId(e.target.value)}>
              <option value="">Select courier...</option>
              {couriers.filter(c => c.isActive).map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Tracking Numbers <span className="text-slate-500">(one per line, or comma/space separated)</span>
            </label>
            <textarea rows={8} className="input-field text-sm w-full font-mono resize-none"
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={`KOOMB0012345\nKOOMB0012346\nKOOMB0012347\n...`} />
            <p className="text-xs text-slate-500 mt-1">{parseNumbers(bulkText).length} numbers detected (max 500)</p>
          </div>

          {result && (
            <div className="rounded-xl p-3.5 text-sm" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
              ✅ {result.added} added{result.duplicates > 0 ? ` · ${result.duplicates} duplicates skipped` : ''}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Close</button>
            <button type="submit" disabled={saving}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Add to Pool
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
