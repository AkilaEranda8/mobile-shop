'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, Save, X, Wrench, Tag, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { servicesApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  General:  { color: '#6d28d9', bg: 'rgba(109,40,217,0.10)', border: 'rgba(109,40,217,0.25)' },
  Printing: { color: '#1d4ed8', bg: 'rgba(29,78,216,0.10)',  border: 'rgba(29,78,216,0.25)' },
  Design:   { color: '#c2410c', bg: 'rgba(194,65,12,0.10)',  border: 'rgba(194,65,12,0.25)' },
  Binding:  { color: '#15803d', bg: 'rgba(21,128,61,0.10)',  border: 'rgba(21,128,61,0.25)' },
}
const getColor = (cat: string) => CATEGORY_COLORS[cat] ?? { color: '#64748b', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.25)' }

export default function ServicesPage() {
  const [services, setServices]       = useState<Service[]>([])
  const [categories, setCategories]   = useState<string[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [search, setSearch]           = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [editing, setEditing]         = useState<Service | null>(null)
  const [showModal, setShowModal]     = useState(false)

  const load = async () => {
    try {
      const [res, cats] = await Promise.all([
        servicesApi.list({}),
        servicesApi.categories(),
      ])
      setServices((res as any)?.data ?? res ?? [])
      setCategories((cats as any)?.data ?? cats ?? [])
    } catch { toast.error('Failed to load services') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) &&
    (!filterCategory || s.category === filterCategory)
  )

  const activeCount   = services.filter(s => s.isActive).length
  const inactiveCount = services.length - activeCount
  const categoryCount = new Set(services.map(s => s.category)).size

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      const body = { name: editing.name, description: editing.description, price: editing.price, category: editing.category, isActive: editing.isActive }
      if (editing.id.startsWith('new')) await servicesApi.create(body)
      else await servicesApi.update(editing.id, body)
      toast.success(editing.id.startsWith('new') ? 'Service created' : 'Service updated')
      setShowModal(false); setEditing(null); load()
    } catch { toast.error('Failed to save service') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this service?')) return
    try { await servicesApi.delete(id); toast.success('Service deleted'); load() }
    catch { toast.error('Failed to delete service') }
  }

  const openNew = () => {
    setEditing({ id: 'new-' + Date.now(), name: '', description: '', price: 0, category: categories[0] || 'General', isActive: true, createdAt: '', updatedAt: '' })
    setShowModal(true)
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="page-subtitle">Manage billable services available in POS</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 sm:ml-auto">
          <Plus size={14} />Add Service
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Services',   value: String(services.length),  icon: <Wrench size={15} />,       color: '#6d28d9', bg: 'rgba(109,40,217,0.08)', border: 'rgba(109,40,217,0.20)' },
          { label: 'Active',           value: String(activeCount),       icon: <CheckCircle2 size={15} />, color: '#15803d', bg: 'rgba(21,128,61,0.08)',  border: 'rgba(21,128,61,0.20)' },
          { label: 'Inactive',         value: String(inactiveCount),     icon: <XCircle size={15} />,      color: '#b91c1c', bg: 'rgba(185,28,28,0.08)', border: 'rgba(185,28,28,0.20)' },
          { label: 'Categories',       value: String(categoryCount),     icon: <Tag size={15} />,          color: '#c2410c', bg: 'rgba(194,65,12,0.08)',  border: 'rgba(194,65,12,0.20)' },
        ].map(({ label, value, icon, color, bg, border }) => (
          <div key={label} className="card p-4" style={{ borderColor: border, background: bg }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color, background: bg, border: `1px solid ${border}` }}>{icon}</div>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters + Table ── */}
      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text" placeholder="Search services…" value={search} onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 w-full text-sm"
            />
          </div>
          <select
            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="input-field text-sm"
            style={{ minWidth: 140 }}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                {['Service', 'Category', 'Price', 'Status', ''].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${h === '' ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const { color, bg, border } = getColor(s.category)
                return (
                  <tr key={s.id} style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}
                    className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg, border: `1px solid ${border}` }}>
                          <Wrench size={13} style={{ color }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                          {s.description && <p className="text-xs mt-0.5 truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>{s.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ color, background: bg, border: `1px solid ${border}` }}>
                        {s.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(s.price)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${s.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(s); setShowModal(true) }}
                          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                          style={{ color: 'var(--text-muted)' }} title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(s.id)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400"
                          style={{ color: 'var(--text-muted)' }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <Wrench size={28} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No services found</p>
                    {!search && <button onClick={openNew} className="mt-3 btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 mx-auto"><Plus size={12} />Add your first service</button>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(109,40,217,0.10)', border: '1px solid rgba(109,40,217,0.25)' }}>
                  <Wrench size={14} style={{ color: '#7c3aed' }} />
                </div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editing.id.startsWith('new') ? 'New Service' : 'Edit Service'}
                </h3>
              </div>
              <button onClick={() => { setShowModal(false); setEditing(null) }} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                <X size={15} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Service Name *</label>
                <input required type="text" className="input-field w-full"
                  placeholder="e.g. A4 Print, Lamination, Binding"
                  value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Description</label>
                <textarea className="input-field w-full resize-none" rows={2}
                  placeholder="Optional description…"
                  value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Price *</label>
                  <input required type="number" step="0.01" min="0" className="input-field w-full"
                    placeholder="0.00"
                    value={editing.price || ''} onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Category</label>
                  <input type="text" className="input-field w-full"
                    placeholder="General"
                    value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div onClick={() => setEditing({ ...editing, isActive: !editing.isActive })}
                  className={`w-9 h-5 rounded-full flex items-center transition-colors flex-shrink-0 ${editing.isActive ? 'bg-violet-600' : 'bg-slate-600'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mx-0.5 ${editing.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Active — visible in POS</span>
              </label>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowModal(false); setEditing(null) }}
                  className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 btn-primary flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Saving…' : 'Save Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
