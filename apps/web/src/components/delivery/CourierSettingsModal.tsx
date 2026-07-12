'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Loader2, Truck, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { deliveryApi, Courier } from '@/lib/delivery-api'

interface Props { couriers: Courier[]; onClose: () => void; onRefresh: () => void }

export default function CourierSettingsModal({ couriers, onClose, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({ name: '', code: '', phone: '', website: '', isDefault: false })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.code) { toast.error('Name and code are required'); return }
    setSaving(true)
    try {
      await deliveryApi.createCourier(form)
      toast.success('Courier added')
      setForm({ name: '', code: '', phone: '', website: '', isDefault: false })
      setShowForm(false)
      onRefresh()
    } catch (e: any) { toast.error(e?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete courier "${name}"?`)) return
    try {
      await deliveryApi.deleteCourier(id)
      toast.success('Courier deleted')
      onRefresh()
    } catch (e: any) { toast.error(e?.message ?? 'Failed') }
  }

  const handleToggleDefault = async (c: Courier) => {
    try {
      await deliveryApi.updateCourier(c.id, { isDefault: !c.isDefault })
      onRefresh()
    } catch (e: any) { toast.error(e?.message ?? 'Failed') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[82vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-violet-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Courier Settings</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(p => !p)} className="btn-primary text-sm flex items-center gap-1.5">
              <Plus size={13} /> Add
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {showForm && (
            <form onSubmit={handleCreate} className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">New Courier</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1">Name *</label>
                  <input className="input-field text-sm w-full" value={form.name}
                    onChange={e => set('name', e.target.value)} placeholder="Koombiyo" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1">Code *</label>
                  <input className="input-field text-sm w-full uppercase" value={form.code}
                    onChange={e => set('code', e.target.value.toUpperCase())} placeholder="KOOMB" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1">Phone</label>
                  <input className="input-field text-sm w-full" value={form.phone}
                    onChange={e => set('phone', e.target.value)} placeholder="+94 11 ..." />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1">Website</label>
                  <input className="input-field text-sm w-full" value={form.website}
                    onChange={e => set('website', e.target.value)} placeholder="https://..." />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)} />
                <span className="text-sm text-slate-300">Set as default</span>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5 disabled:opacity-60">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : null} Save
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {couriers.length === 0 && (
              <p className="text-center text-slate-500 py-6 text-sm">No couriers yet</p>
            )}
            {couriers.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Truck size={16} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                  <p className="text-xs text-gray-600 dark:text-slate-400 font-mono">{c.code}</p>
                </div>
                {c.isDefault && (
                  <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">Default</span>
                )}
                <button onClick={() => handleToggleDefault(c)} title={c.isDefault ? 'Remove default' : 'Set as default'}
                  className={`p-1.5 rounded ${c.isDefault ? 'text-violet-400' : 'text-slate-600 hover:text-slate-300'}`}>
                  <Check size={14} />
                </button>
                <button onClick={() => handleDelete(c.id, c.name)}
                  className="p-1.5 rounded text-slate-600 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
