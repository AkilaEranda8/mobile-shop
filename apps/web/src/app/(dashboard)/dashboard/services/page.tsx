'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, Save, X, Wrench, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { servicesApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Switch } from '@/components/ui/Switch'
import { OpenPosButton } from '@/components/pos/OpenPosButton'

interface Service {
  id: string
  name: string
  description: string | null
  cost: number
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
  const [services, setServices]   = useState<Service[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [editing, setEditing]     = useState<Service | null>(null)
  const [showModal, setShowModal] = useState(false)

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

  const activeCount   = services.filter(s => s.isActive).length
  const inactiveCount = services.length - activeCount

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      const body = { name: editing.name, description: editing.description, cost: editing.cost ?? 0, price: editing.price, category: editing.category, isActive: editing.isActive }
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
    setEditing({ id: 'new-' + Date.now(), name: '', description: '', cost: 0, price: 0, category: categories[0] || 'General', isActive: true, createdAt: '', updatedAt: '' })
    setShowModal(true)
  }

  const columns = useMemo<ColumnDef<Service>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Service" />,
      cell: ({ row: { original: s } }) => {
        const { color, bg, border } = getColor(s.category)
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg, border: `1px solid ${border}` }}>
              <Wrench size={13} style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
              {s.description && <p className="text-xs mt-0.5 truncate max-w-[220px]" style={{ color: 'var(--text-muted)' }}>{s.description}</p>}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'category',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      cell: ({ row: { original: s } }) => {
        const { color, bg, border } = getColor(s.category)
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ color, background: bg, border: `1px solid ${border}` }}>
            {s.category}
          </span>
        )
      },
    },
    {
      accessorKey: 'cost',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cost" />,
      cell: ({ row: { original: s } }) => <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{formatCurrency(s.cost ?? 0)}</span>,
    },
    {
      accessorKey: 'price',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sell Price" />,
      cell: ({ row: { original: s } }) => <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(s.price)}</span>,
    },
    {
      id: 'status',
      accessorFn: (s) => s.isActive ? 'Active' : 'Inactive',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row: { original: s } }) => (
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${s.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-emerald-400' : 'bg-slate-400'}`} />
          {s.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row: { original: s } }) => (
        <TableActionsRow
          editAction={{ action: () => { setEditing(s); setShowModal(true) } }}
          deleteAction={{ action: () => handleDelete(s.id) }}
        />
      ),
    },
  ], [categories, handleDelete])

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="page-subtitle">Manage billable services available in POS</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <OpenPosButton label="Open POS" variant="secondary" />
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={14} />Add Service
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Services', value: String(services.length), icon: <Wrench size={15} />,       color: '#6d28d9', bg: 'rgba(109,40,217,0.08)', border: 'rgba(109,40,217,0.20)' },
          { label: 'Active',         value: String(activeCount),      icon: <CheckCircle2 size={15} />, color: '#15803d', bg: 'rgba(21,128,61,0.08)',  border: 'rgba(21,128,61,0.20)'  },
          { label: 'Inactive',       value: String(inactiveCount),    icon: <XCircle size={15} />,      color: '#b91c1c', bg: 'rgba(185,28,28,0.08)', border: 'rgba(185,28,28,0.20)'  },
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

      {/* ── Table ── */}
      <ClientSideTable
        data={services}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((services.length || 1) / 20)}
        searchableColumns={[
          { id: 'name',     title: 'Name'     },
          { id: 'category', title: 'Category' },
        ]}
        filterableColumns={[
          {
            id: 'status' as any,
            title: 'Status',
            options: [
              { label: 'Active',   value: 'Active'   },
              { label: 'Inactive', value: 'Inactive' },
            ],
          },
          {
            id: 'category',
            title: 'Category',
            options: categories.map(c => ({ label: c, value: c })),
          },
        ]}
      />

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
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Cost (LKR)</label>
                  <input type="number" step="0.01" min="0" className="input-field w-full"
                    placeholder="0.00"
                    value={editing.cost ?? ''} onChange={e => setEditing({ ...editing, cost: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Sell Price *</label>
                  <input required type="number" step="0.01" min="0" className="input-field w-full"
                    placeholder="0.00"
                    value={editing.price || ''} onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Category</label>
                  <input type="text" className="input-field w-full"
                    placeholder="General"
                    value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <Switch
                  checked={editing.isActive}
                  onChange={v => setEditing({ ...editing, isActive: v })}
                  variant="emerald"
                />
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
