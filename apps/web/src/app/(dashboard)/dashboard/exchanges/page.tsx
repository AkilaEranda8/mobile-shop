'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Plus, X, Loader2, ArrowLeftRight, Search, Calendar, User,
  Smartphone, Hash, ChevronDown, Check, Trash2, Eye,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exchangesApi, customersApi, deviceCatalogApi, branchesApi } from '@/lib/api'
import toast from 'react-hot-toast'

const CONDITIONS = [
  { value: 'EXCELLENT', label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { value: 'GOOD',      label: 'Good',      color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/20'   },
  { value: 'FAIR',      label: 'Fair',      color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20'  },
  { value: 'POOR',      label: 'Poor',      color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20'     },
]

/* ── New Exchange Modal ───────────────────────────────────────────────── */
function NewExchangeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    customerName: '', customerPhone: '',
    oldBrand: '', oldBrandId: '', oldModel: '', oldImei: '', oldCondition: 'GOOD', exchangeValue: '',
    newBrand: '', newModel: '', newImei: '', newDevicePrice: '',
    notes: '', branchId: '',
  })
  const [loading,     setLoading]     = useState(false)
  const [custResults, setCustResults] = useState<any[]>([])
  const [searching,   setSearching]   = useState(false)
  const [showCustDrop, setShowCustDrop] = useState(false)
  const [brands,  setBrands]  = useState<any[]>([])
  const [models,  setModels]  = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [condOpen, setCondOpen] = useState(false)

  useEffect(() => {
    deviceCatalogApi.listBrands().then((r: any) => setBrands(r.data ?? r ?? [])).catch(() => {})
    branchesApi.list().then((r: any) => {
      const list = (r.data ?? r ?? []).filter((b: any) => b.isActive)
      setBranches(list)
      if (list.length > 0) setForm(p => ({ ...p, branchId: list[0].id }))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (form.oldBrandId) {
      deviceCatalogApi.listModels(form.oldBrandId).then((r: any) => setModels(r.data ?? r ?? [])).catch(() => {})
    } else {
      setModels([])
    }
  }, [form.oldBrandId])

  const searchCustomers = (q: string) => {
    setForm(p => ({ ...p, customerName: q }))
    if (q.length < 2) { setCustResults([]); return }
    setSearching(true)
    customersApi.search(q).then((r: any) => {
      setCustResults(r.data ?? r ?? [])
      setShowCustDrop(true)
    }).catch(() => {}).finally(() => setSearching(false))
  }

  const selectCustomer = (c: any) => {
    setForm(p => ({ ...p, customerName: c.name, customerPhone: c.phone }))
    setShowCustDrop(false); setCustResults([])
  }

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerName || !form.customerPhone || !form.oldBrand || !form.oldModel) {
      toast.error('Fill required fields'); return
    }
    setLoading(true)
    try {
      await exchangesApi.create({
        ...form,
        exchangeValue:  form.exchangeValue  ? Number(form.exchangeValue)  : 0,
        newDevicePrice: form.newDevicePrice ? Number(form.newDevicePrice) : undefined,
      })
      toast.success('Exchange recorded!')
      onSaved(); onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to record exchange')
    } finally { setLoading(false) }
  }

  const condConf = CONDITIONS.find(c => c.value === form.oldCondition) ?? CONDITIONS[1]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
              <ArrowLeftRight size={16} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">New Device Exchange</h3>
              <p className="text-xs text-slate-500">Record a device trade-in / exchange</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-5">

          {/* Customer */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5"><User size={9} />Customer</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="block text-xs text-slate-400 mb-1.5">Name *</label>
                <div className="relative">
                  <input className="input-field pr-7" placeholder="Customer name" value={form.customerName}
                    onChange={e => searchCustomers(e.target.value)}
                    onFocus={() => custResults.length > 0 && setShowCustDrop(true)} />
                  {searching && <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-slate-500" />}
                </div>
                {showCustDrop && custResults.length > 0 && (
                  <div className="absolute z-30 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    {custResults.map((c: any) => (
                      <button key={c.id} type="button" onMouseDown={() => selectCustomer(c)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-violet-500/10 text-left"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300 flex-shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs text-white">{c.name}</p>
                          <p className="text-[10px] text-slate-500">{c.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Phone *</label>
                <input className="input-field" placeholder="Phone number" value={form.customerPhone} onChange={f('customerPhone')} />
              </div>
            </div>
          </div>

          {/* Old Device (Received) */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
              <Smartphone size={9} />Old Device Received
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Brand *</label>
                <select className="input-field" value={form.oldBrand}
                  onChange={e => {
                    const b = brands.find((x: any) => x.name === e.target.value)
                    setForm(p => ({ ...p, oldBrand: e.target.value, oldBrandId: b?.id ?? '', oldModel: '' }))
                  }}>
                  <option value="">Select brand</option>
                  {brands.map((b: any) => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Model *</label>
                <select className="input-field" value={form.oldModel} onChange={f('oldModel')} disabled={!form.oldBrand}>
                  <option value="">Select model</option>
                  {models.map((m: any) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">IMEI</label>
                <input className="input-field font-mono" placeholder="15-digit IMEI" value={form.oldImei} onChange={f('oldImei')} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Condition</label>
                <div className="relative">
                  <button type="button" onClick={() => setCondOpen(o => !o)}
                    className={`input-field w-full flex items-center justify-between ${condConf.color}`}>
                    <span className="text-sm font-semibold">{condConf.label}</span>
                    <ChevronDown size={13} className={`text-slate-500 transition-transform ${condOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {condOpen && (
                    <div className="absolute z-30 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                      {CONDITIONS.map(c => (
                        <button key={c.value} type="button"
                          onMouseDown={() => { setForm(p => ({ ...p, oldCondition: c.value })); setCondOpen(false) }}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-violet-500/10 text-left ${c.color}`}
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          {form.oldCondition === c.value && <Check size={11} />}
                          <span className="text-sm">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Exchange Value Given (LKR)</label>
                <input type="number" min="0" className="input-field" placeholder="0.00" value={form.exchangeValue} onChange={f('exchangeValue')} />
              </div>
            </div>
          </div>

          {/* New Device (Given) */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
              <Smartphone size={9} />New Device Given
              <span className="text-[9px] normal-case font-normal">(optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Brand</label>
                <input className="input-field" placeholder="e.g. Samsung" value={form.newBrand} onChange={f('newBrand')} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Model</label>
                <input className="input-field" placeholder="e.g. Galaxy A55" value={form.newModel} onChange={f('newModel')} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">IMEI</label>
                <input className="input-field font-mono" placeholder="15-digit IMEI" value={form.newImei} onChange={f('newImei')} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Selling Price (LKR)</label>
                <input type="number" min="0" className="input-field" placeholder="0.00" value={form.newDevicePrice} onChange={f('newDevicePrice')} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Notes</label>
            <textarea rows={2} className="input-field resize-none" placeholder="Any additional notes..." value={form.notes} onChange={f('notes')} />
          </div>
        </form>

        <div className="flex gap-3 p-5 border-t border-white/5 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button type="button" onClick={e => handleSubmit(e as any)} disabled={loading}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
            Record Exchange
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Exchange Detail Modal ───────────────────────────────────────────── */
function ExchangeDetailModal({ exchange, onClose, onDeleted }: { exchange: any; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const cond = CONDITIONS.find(c => c.value === exchange.oldCondition) ?? CONDITIONS[1]

  const handleDelete = async () => {
    if (!confirm('Delete this exchange record?')) return
    setDeleting(true)
    try {
      await exchangesApi.remove(exchange.id)
      toast.success('Deleted')
      onDeleted(); onClose()
    } catch { toast.error('Delete failed') }
    finally { setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <p className="text-xs font-mono text-amber-400">{exchange.exchangeNumber}</p>
            <h3 className="text-sm font-bold text-white">{exchange.customerName}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDelete} disabled={deleting}
              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: 'Customer',  value: exchange.customerName },
              { label: 'Phone',     value: exchange.customerPhone },
              { label: 'Date',      value: formatDate(exchange.createdAt) },
              { label: 'Exchange #', value: exchange.exchangeNumber },
            ].map(r => (
              <div key={r.label} className="bg-white/3 rounded-xl p-3 border border-white/5">
                <p className="text-[10px] text-slate-500 mb-0.5">{r.label}</p>
                <p className="font-semibold text-white">{r.value}</p>
              </div>
            ))}
          </div>

          {/* Old Device */}
          <div className="bg-white/3 rounded-xl p-4 border border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Device Received (Old)</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Device</span>
                <span className="text-white font-semibold">{exchange.oldBrand} {exchange.oldModel}</span>
              </div>
              {exchange.oldImei && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">IMEI</span>
                  <span className="font-mono text-slate-300">{exchange.oldImei}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Condition</span>
                <span className={`font-semibold ${cond.color}`}>{cond.label}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Exchange Value</span>
                <span className="font-bold text-amber-400">{formatCurrency(exchange.exchangeValue)}</span>
              </div>
            </div>
          </div>

          {/* New Device */}
          {(exchange.newBrand || exchange.newModel) && (
            <div className="bg-white/3 rounded-xl p-4 border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Device Given (New)</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Device</span>
                  <span className="text-white font-semibold">{exchange.newBrand} {exchange.newModel}</span>
                </div>
                {exchange.newImei && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">IMEI</span>
                    <span className="font-mono text-slate-300">{exchange.newImei}</span>
                  </div>
                )}
                {exchange.newDevicePrice != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Selling Price</span>
                    <span className="font-bold text-green-400">{formatCurrency(exchange.newDevicePrice)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {exchange.notes && (
            <div className="bg-white/3 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] text-slate-500 mb-1">Notes</p>
              <p className="text-xs text-slate-300">{exchange.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────────────── */
export default function ExchangesPage() {
  const [records, setRecords]         = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [showNew, setShowNew]         = useState(false)
  const [selected, setSelected]       = useState<any | null>(null)

  const fetchExchanges = () => {
    setLoading(true)
    exchangesApi.list({ limit: '200' })
      .then((r: any) => setRecords(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchExchanges() }, [])

  const stats = useMemo(() => ({
    total:        records.length,
    totalValue:   records.reduce((s, r) => s + (r.exchangeValue ?? 0), 0),
    withNewDevice: records.filter(r => r.newBrand).length,
  }), [records])

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'exchangeNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Exchange #" />,
      cell: ({ row }) => <span className="text-xs font-mono text-amber-400">{row.original.exchangeNumber}</span>,
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-semibold text-slate-100">{row.original.customerName}</p>
          <p className="text-xs text-slate-500">{row.original.customerPhone}</p>
        </div>
      ),
    },
    {
      id: 'oldDevice',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Old Device" />,
      cell: ({ row }) => {
        const cond = CONDITIONS.find(c => c.value === row.original.oldCondition) ?? CONDITIONS[1]
        return (
          <div>
            <p className="text-sm text-slate-200">{row.original.oldBrand} {row.original.oldModel}</p>
            <span className={`text-[10px] font-semibold ${cond.color}`}>{cond.label}</span>
            {row.original.oldImei && <p className="text-[10px] font-mono text-slate-500">{row.original.oldImei}</p>}
          </div>
        )
      },
    },
    {
      id: 'newDevice',
      header: ({ column }) => <DataTableColumnHeader column={column} title="New Device" />,
      cell: ({ row }) => row.original.newBrand ? (
        <div>
          <p className="text-sm text-slate-200">{row.original.newBrand} {row.original.newModel}</p>
          {row.original.newImei && <p className="text-[10px] font-mono text-slate-500">{row.original.newImei}</p>}
        </div>
      ) : <span className="text-xs text-slate-600">—</span>,
    },
    {
      accessorKey: 'exchangeValue',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Exchange Value" />,
      cell: ({ row }) => <span className="text-sm font-bold text-amber-400">{formatCurrency(row.original.exchangeValue)}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => <span className="text-xs text-slate-400">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <button onClick={() => setSelected(row.original)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
          <Eye size={14} />
        </button>
      ),
    },
  ], [])

  return (
    <div className="space-y-6">
      {showNew   && <NewExchangeModal onClose={() => setShowNew(false)} onSaved={fetchExchanges} />}
      {selected  && <ExchangeDetailModal exchange={selected} onClose={() => setSelected(null)} onDeleted={fetchExchanges} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Device Exchanges</h1>
          <p className="page-subtitle">Track trade-in and exchange transactions</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary text-sm flex items-center gap-2 sm:ml-auto">
          <Plus size={14} />New Exchange
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Exchanges', value: String(stats.total),               color: 'amber'  },
          { label: 'Total Value Given', value: formatCurrency(stats.totalValue), color: 'violet' },
          { label: 'With New Device',  value: String(stats.withNewDevice),       color: 'green'  },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-lg font-bold" style={{ color: `var(--color-${s.color}-400, #f59e0b)` }}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table or Empty State */}
      {!loading && records.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No exchange records yet"
          description="Device exchanges let you accept trade-ins and issue upgraded devices. Start by logging your first exchange transaction."
          accentColor="amber"
          actions={[
            { label: 'Record First Exchange', onClick: () => setShowNew(true), primary: true },
          ]}
          hints={[
            'An exchange records the old device received and its condition.',
            'Optionally assign a new device given to the customer.',
            'Exchange value is used for pricing differences.',
          ]}
        />
      ) : (
        <ClientSideTable
          data={records}
          columns={columns}
          isLoading={loading}
          pageCount={Math.ceil((records.length || 1) / 20)}
          searchableColumns={[
            { id: 'customerName',   title: 'Customer'   },
            { id: 'exchangeNumber', title: 'Exchange #'  },
          ]}
        />
      )}
    </div>
  )
}
