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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Hash size={18} className="text-violet-400" />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Tracking Number Pool</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"><X size={16} /></button>
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
            <div className="rounded-lg p-3 bg-green-500/10 border border-green-500/30 text-sm text-green-300">
              ✅ {result.added} added{result.duplicates > 0 ? ` · ${result.duplicates} duplicates skipped` : ''}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm font-medium">
              Close
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Add to Pool
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
