'use client'

import { useState } from 'react'
import { Smartphone, Search, Plus, AlertTriangle, CheckCircle, X, Loader2, Shield, Hash, Calendar, User, Package } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const mockIMEI = [
  { id: '1', imei: '351756051523798', model: 'iPhone 14 Pro', brand: 'Apple', color: 'Deep Purple', storage: '256GB', status: 'SOLD', customer: 'Arjun K', soldDate: '2024-05-01', warranty: '2025-05-01', condition: 'NEW' },
  { id: '2', imei: '860352050023489', model: 'Galaxy S24 Ultra', brand: 'Samsung', color: 'Titanium Black', storage: '512GB', status: 'IN_STOCK', customer: null, soldDate: null, warranty: null, condition: 'NEW' },
  { id: '3', imei: '990000862471854', model: 'OnePlus 12', brand: 'OnePlus', color: 'Flowy Emerald', storage: '256GB', status: 'IN_REPAIR', customer: 'Meena S', soldDate: null, warranty: null, condition: 'USED' },
  { id: '4', imei: '352073102518396', model: 'iPhone 13', brand: 'Apple', color: 'Midnight', storage: '128GB', status: 'SOLD', customer: 'Priya R', soldDate: '2024-04-15', warranty: '2025-04-15', condition: 'REFURBISHED' },
  { id: '5', imei: '354678091234567', model: 'Pixel 8 Pro', brand: 'Google', color: 'Hazel', storage: '256GB', status: 'IN_STOCK', customer: null, soldDate: null, warranty: null, condition: 'NEW' },
]

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  IN_STOCK: { label: 'In Stock', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  SOLD: { label: 'Sold', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  IN_REPAIR: { label: 'In Repair', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  RETURNED: { label: 'Returned', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
}

const conditionConfig: Record<string, string> = {
  NEW: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  USED: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  REFURBISHED: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
}

function AddIMEIModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ imei: '', model: '', brand: '', color: '', storage: '', condition: 'NEW', purchasePrice: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [imeiError, setImeiError] = useState('')
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }))
    if (k === 'imei') setImeiError('')
  }

  const validateIMEI = (v: string) => /^\d{15}$/.test(v)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateIMEI(form.imei)) { setImeiError('IMEI must be exactly 15 digits'); return }
    const dup = mockIMEI.find(i => i.imei === form.imei)
    if (dup) { setImeiError('⚠️ Duplicate IMEI detected! This device is already in the system.'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <div>
            <h3 className="text-base font-semibold text-white">Register Device IMEI</h3>
            <p className="text-xs text-slate-500 mt-0.5">Add a new device to IMEI tracker</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">IMEI Number * <span className="text-slate-600">(15 digits)</span></label>
            <input
              required maxLength={15}
              className={`input-field font-mono tracking-widest ${imeiError ? 'border-red-500/50' : ''}`}
              placeholder="351756051523798"
              value={form.imei} onChange={f('imei')}
            />
            {imeiError && <p className="text-xs text-red-400 mt-1">{imeiError}</p>}
            {form.imei.length === 15 && !imeiError && <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><CheckCircle size={11} />Valid IMEI format</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Brand *</label>
              <input required className="input-field" placeholder="Apple" value={form.brand} onChange={f('brand')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Model *</label>
              <input required className="input-field" placeholder="iPhone 14 Pro" value={form.model} onChange={f('model')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Color</label>
              <input className="input-field" placeholder="Deep Purple" value={form.color} onChange={f('color')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Storage</label>
              <input className="input-field" placeholder="256GB" value={form.storage} onChange={f('storage')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Condition</label>
              <select className="input-field" value={form.condition} onChange={f('condition')}>
                <option value="NEW">New</option>
                <option value="USED">Used</option>
                <option value="REFURBISHED">Refurbished</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Purchase Price (₹)</label>
              <input type="number" min="0" className="input-field" placeholder="65000" value={form.purchasePrice} onChange={f('purchasePrice')} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Notes <span className="text-slate-600">(iCloud lock, SIM lock, condition notes)</span></label>
            <textarea className="input-field min-h-[64px] resize-none" placeholder="iCloud: unlocked, SIM: unlocked, minor scratches..." value={form.notes} onChange={f('notes')} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Register IMEI
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function IMEIPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [scanMode, setScanMode] = useState(false)

  const filtered = mockIMEI.filter(d => {
    const q = search.toLowerCase()
    const matchSearch = d.imei.includes(q) || d.model.toLowerCase().includes(q) || d.brand.toLowerCase().includes(q) || (d.customer ?? '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'ALL' || d.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = [
    { label: 'Total Devices', value: mockIMEI.length, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    { label: 'In Stock', value: mockIMEI.filter(d => d.status === 'IN_STOCK').length, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
    { label: 'Sold', value: mockIMEI.filter(d => d.status === 'SOLD').length, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { label: 'In Repair', value: mockIMEI.filter(d => d.status === 'IN_REPAIR').length, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  ]

  return (
    <div className="space-y-6">
      {showAdd && <AddIMEIModal onClose={() => setShowAdd(false)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">IMEI Tracker</h1>
          <p className="page-subtitle">Track every device by IMEI · Duplicate detection · Full history</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button
            onClick={() => setScanMode(!scanMode)}
            className={`btn-secondary text-sm flex items-center gap-2 ${scanMode ? 'border-violet-500/40 text-violet-400' : ''}`}
          >
            <Hash size={14} />{scanMode ? 'Scanner On' : 'Scan IMEI'}
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />Register Device
          </button>
        </div>
      </div>

      {/* Scanner Banner */}
      {scanMode && (
        <div className="card p-4 border-violet-500/20 bg-violet-500/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
            <Hash size={18} className="text-violet-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-violet-300">IMEI Scanner Active</p>
            <p className="text-xs text-slate-500">Use a barcode scanner or type IMEI number to quickly look up a device</p>
          </div>
          <input autoFocus className="input-field max-w-xs font-mono" placeholder="Scan or type IMEI..." onKeyDown={e => { if (e.key === 'Enter') { setSearch((e.target as HTMLInputElement).value); setScanMode(false) } }} />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`card p-4 border ${s.border} ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input-field pl-9" placeholder="Search IMEI, model, brand, customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['ALL', 'IN_STOCK', 'SOLD', 'IN_REPAIR', 'RETURNED'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs rounded-lg border whitespace-nowrap transition-colors ${statusFilter === s ? 'border-violet-500 bg-violet-500/15 text-violet-300' : 'border-white/10 text-slate-400 hover:border-white/20'}`}>
              {s === 'ALL' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="table-header">IMEI / Device</th>
                <th className="table-header">Specs</th>
                <th className="table-header text-center">Condition</th>
                <th className="table-header text-center">Status</th>
                <th className="table-header">Customer</th>
                <th className="table-header">Warranty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/3">
              {filtered.map(d => {
                const st = statusConfig[d.status]
                return (
                  <tr key={d.id} className="hover:bg-white/2 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                          <Smartphone size={14} className="text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">{d.brand} {d.model}</p>
                          <p className="text-xs font-mono text-slate-500">{d.imei}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="text-xs text-slate-300">{d.color}</p>
                      <p className="text-xs text-slate-500">{d.storage}</p>
                    </td>
                    <td className="table-cell text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${conditionConfig[d.condition]}`}>{d.condition}</span>
                    </td>
                    <td className="table-cell text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${st.color} ${st.bg} ${st.border}`}>{st.label}</span>
                    </td>
                    <td className="table-cell">
                      {d.customer ? (
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-slate-500" />
                          <span className="text-xs text-slate-300">{d.customer}</span>
                        </div>
                      ) : <span className="text-xs text-slate-600">—</span>}
                    </td>
                    <td className="table-cell">
                      {d.warranty ? (
                        <div className="flex items-center gap-1.5">
                          <Shield size={12} className="text-slate-500" />
                          <span className="text-xs text-slate-400">{d.warranty}</span>
                        </div>
                      ) : <span className="text-xs text-slate-600">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <Smartphone size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No devices found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
