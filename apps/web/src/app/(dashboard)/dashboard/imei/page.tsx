'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Smartphone, Plus, CheckCircle, X, Loader2, Hash, ShoppingBag, Wrench,
  Search, History, User, Tag, Calendar, ChevronRight, RefreshCw, AlertTriangle,
  Package, Receipt, Phone,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { useImeiRecords } from '@/lib/hooks'
import { imeiApi, productsApi } from '@/lib/api'
import toast from 'react-hot-toast'

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  IN_STOCK:             { label: 'In Stock',    color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  SOLD:                 { label: 'Sold',         color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  IN_REPAIR:            { label: 'In Repair',    color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  UNDER_WARRANTY_CLAIM: { label: 'Warranty',     color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  SCRAPPED:             { label: 'Scrapped',     color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
}

const repairStatusColors: Record<string, string> = {
  RECEIVED:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
  DIAGNOSING:  'text-purple-400 bg-purple-500/10 border-purple-500/20',
  IN_PROGRESS: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  WAITING_PARTS: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  READY:       'text-teal-400 bg-teal-500/10 border-teal-500/20',
  DELIVERED:   'text-green-400 bg-green-500/10 border-green-500/20',
  CANCELLED:   'text-red-400 bg-red-500/10 border-red-500/20',
}

function formatCurrency(v: any) { return `Rs. ${Number(v ?? 0).toLocaleString('en-LK')}` }
function formatDate(d: string)  { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }

/* ── IMEI Detail Modal ──────────────────────────────────────────────────── */
function IMEIDetailModal({ imei, onClose, onStatusChange }: { imei: string; onClose: () => void; onStatusChange: () => void }) {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    setLoading(true)
    imeiApi.lookup(imei)
      .then((r: any) => setData(r.data))
      .catch(() => toast.error('Failed to load IMEI details'))
      .finally(() => setLoading(false))
  }, [imei])

  const handleStatusChange = async (status: string) => {
    if (!data?.record?.id) return
    setUpdating(true)
    try {
      await imeiApi.updateStatus(data.record.id, status)
      toast.success('Status updated')
      onStatusChange()
      const r: any = await imeiApi.lookup(imei)
      setData(r.data)
    } catch { toast.error('Failed to update status') }
    finally { setUpdating(false) }
  }

  const record   = data?.record
  const repairs: any[]  = data?.repairs ?? []
  const sale     = data?.saleDetails
  const customer = data?.customerDetails

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Smartphone size={17} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Device Details</h3>
              <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{imei}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-16"><Loader2 size={24} className="animate-spin text-violet-400" /></div>
        ) : (
          <div className="overflow-y-auto p-5 space-y-5">

            {/* Device Info */}
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
              <p className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Package size={11} />Device Info
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>Product</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{record?.product?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>Brand</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{record?.product?.brand?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>SKU</p>
                  <p className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{record?.product?.sku ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>Category</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{record?.product?.category?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>Selling Price</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{record?.product?.sellingPrice ? formatCurrency(record.product.sellingPrice) : '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>Warranty</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{record?.product?.warrantyMonths ? `${record.product.warrantyMonths} months` : '—'}</p>
                </div>
              </div>
              {/* Status + Change */}
              {record && (
                <div className="flex items-center gap-3 pt-1 border-t border-[var(--border-subtle)]">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Status:</p>
                  {(() => { const st = statusConfig[record.status] ?? statusConfig['IN_STOCK']; return (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${st.color} ${st.bg} ${st.border}`}>{st.label}</span>
                  )})()}
                  <div className="ml-auto flex gap-1.5">
                    {Object.entries(statusConfig).filter(([k]) => k !== record.status).map(([k, v]) => (
                      <button key={k} disabled={updating} onClick={() => handleStatusChange(k)}
                        className={`text-[10px] px-2 py-0.5 rounded border font-medium transition-opacity disabled:opacity-50 ${v.color} ${v.bg} ${v.border} hover:opacity-80`}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Customer / Sale */}
            {(customer || sale) && (
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
                <p className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  <User size={11} />Owner / Sale
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {customer && <>
                    <div>
                      <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>Customer</p>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{customer.name}</p>
                    </div>
                    <div>
                      <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>Phone</p>
                      <p className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{customer.phone ?? '—'}</p>
                    </div>
                  </>}
                  {sale && <>
                    <div>
                      <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>Invoice</p>
                      <p className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{sale.invoiceNumber ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>Sale Date</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(sale.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>Sale Amount</p>
                      <p className="text-xs font-semibold text-green-400">{formatCurrency(sale.total)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>Cashier</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sale.cashierName ?? '—'}</p>
                    </div>
                  </>}
                </div>
              </div>
            )}

            {/* Repair History */}
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  <History size={11} />Repair History
                </p>
                <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                  {repairs.length} repair{repairs.length !== 1 ? 's' : ''}
                </span>
              </div>
              {repairs.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No repair records for this device</p>
              ) : (
                <div className="space-y-2">
                  {repairs.map((r: any) => {
                    const sc = repairStatusColors[r.status] ?? repairStatusColors['RECEIVED']
                    return (
                      <div key={r.id} className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${sc}`}>{r.status.replace('_', ' ')}</span>
                          <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>#{r.ticketNumber}</span>
                          <span className="ml-auto text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatDate(r.createdAt)}</span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.reportedIssue}</p>
                        <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {r.technicianName && <span className="flex items-center gap-1"><User size={10} />{r.technicianName}</span>}
                          {r.customerName   && <span className="flex items-center gap-1"><Phone size={10} />{r.customerName}</span>}
                          {(r.actualCost ?? r.estimatedCost) > 0 && (
                            <span className="ml-auto font-medium text-green-400">{formatCurrency(r.actualCost ?? r.estimatedCost)}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

function AddIMEIModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ imei: '', productId: '', branchId: '' })
  const [loading, setLoading] = useState(false)
  const [imeiError, setImeiError] = useState('')
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    productsApi.list().then((r: any) => setProducts(r.data ?? [])).catch(() => {})
  }, [])

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }))
    if (k === 'imei') setImeiError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{15}$/.test(form.imei)) { setImeiError('IMEI must be exactly 15 digits'); return }
    if (!form.productId) { toast.error('Select a product'); return }
    setLoading(true)
    try {
      const selectedProduct = products.find((p: any) => p.id === form.productId)
      const branchId = form.branchId || selectedProduct?.branchId
      await imeiApi.create({ imei: form.imei, productId: form.productId, branchId })
      toast.success('IMEI registered successfully')
      onSaved()
      onClose()
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('already')) {
        setImeiError('Duplicate IMEI — this device is already in the system.')
      } else {
        toast.error(err?.message ?? 'Failed to register IMEI')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h3 className="text-base font-semibold text-white">Register Device IMEI</h3>
            <p className="text-xs text-slate-500 mt-0.5">Link IMEI to an existing product</p>
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
            {form.imei.length === 15 && !imeiError && (
              <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><CheckCircle size={11} />Valid IMEI format</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Product *</label>
            <select required className="input-field" value={form.productId} onChange={f('productId')}>
              <option value="">Select product...</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>
              ))}
            </select>
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
  const [showAdd,      setShowAdd]      = useState(false)
  const [scanMode,     setScanMode]     = useState(false)
  const [selectedImei, setSelectedImei] = useState<string | null>(null)
  const [quickSearch,  setQuickSearch]  = useState('')
  const [quickResult,  setQuickResult]  = useState<null | 'loading' | 'found' | 'notfound'>(null)

  const { data, loading, refetch } = useImeiRecords()
  const records: any[] = (data?.data ?? []) as any[]
  const total = (data as any)?.meta?.total ?? records.length

  const counts = {
    total,
    inStock:  records.filter((d: any) => d.status === 'IN_STOCK').length,
    sold:     records.filter((d: any) => d.status === 'SOLD').length,
    inRepair: records.filter((d: any) => d.status === 'IN_REPAIR').length,
  }

  const handleQuickLookup = async () => {
    const imei = quickSearch.trim()
    if (!imei) return
    setQuickResult('loading')
    try {
      await imeiApi.lookup(imei)
      setQuickResult('found')
      setSelectedImei(imei)
    } catch {
      setQuickResult('notfound')
    }
  }

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: 'device',
      accessorFn: (row) => `${row.product?.name ?? ''} ${row.imei}`,
      header: ({ column }) => <DataTableColumnHeader column={column} title="IMEI / Device" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Smartphone size={14} className="text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.original.product?.name ?? '—'}</p>
            <p className="text-xs font-mono text-slate-500">{row.original.imei}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'brand',
      accessorFn: (row) => row.product?.brand?.name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Brand" />,
      cell: ({ row }) => <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{row.original.product?.brand?.name ?? '—'}</span>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const st = statusConfig[row.original.status] ?? statusConfig['IN_STOCK']
        return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${st.color} ${st.bg} ${st.border}`}>{st.label}</span>
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Registered" />,
      cell: ({ row }) => <span className="text-xs text-slate-500">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'action',
      header: () => null,
      cell: ({ row }) => (
        <button
          onClick={() => setSelectedImei(row.original.imei)}
          className="text-[11px] px-2.5 py-1 rounded-lg border border-violet-500/30 text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 transition-colors flex items-center gap-1"
        >
          <History size={10} />Details
        </button>
      ),
    },
  ], [setSelectedImei])

  const stats = [
    { label: 'Total Devices', value: total,          icon: Smartphone,   color: 'violet' },
    { label: 'In Stock',      value: counts.inStock,  icon: CheckCircle,  color: 'green'  },
    { label: 'Sold',          value: counts.sold,     icon: ShoppingBag,  color: 'blue'   },
    { label: 'In Repair',     value: counts.inRepair, icon: Wrench,       color: 'yellow' },
  ]

  return (
    <div className="space-y-6">
      {showAdd       && <AddIMEIModal onClose={() => setShowAdd(false)} onSaved={refetch} />}
      {selectedImei  && <IMEIDetailModal imei={selectedImei} onClose={() => setSelectedImei(null)} onStatusChange={refetch} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">IMEI Tracker</h1>
          <p className="page-subtitle">Track every device by IMEI · Full repair & sale history</p>
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

      {/* Quick IMEI Lookup */}
      <div className="card p-4">
        <p className="text-xs font-semibold mb-2.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <Search size={11} />Quick IMEI Lookup
        </p>
        <div className="flex gap-2">
          <input
            className="input-field font-mono flex-1"
            placeholder="Enter IMEI number to lookup full device history..."
            value={quickSearch}
            onChange={e => { setQuickSearch(e.target.value); setQuickResult(null) }}
            onKeyDown={e => e.key === 'Enter' && handleQuickLookup()}
            maxLength={20}
          />
          <button
            onClick={handleQuickLookup}
            disabled={!quickSearch.trim() || quickResult === 'loading'}
            className="btn-primary text-sm px-4 flex items-center gap-2 disabled:opacity-50"
          >
            {quickResult === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Lookup
          </button>
        </div>
        {quickResult === 'notfound' && (
          <p className="text-xs text-amber-400 mt-2 flex items-center gap-1.5"><AlertTriangle size={11} />IMEI not found in this tenant's records</p>
        )}
      </div>

      {/* Scan mode */}
      {scanMode && (
        <div className="card p-4 border-violet-500/20 bg-violet-500/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
            <Hash size={18} className="text-violet-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-violet-300">IMEI Scanner Active</p>
            <p className="text-xs text-slate-500">Scan barcode or type IMEI then press Enter</p>
          </div>
          <input
            autoFocus className="input-field max-w-xs font-mono"
            placeholder="Scan or type IMEI..."
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim()
                if (val) { setSelectedImei(val); setScanMode(false) }
              }
            }}
          />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
              <Icon size={15} className={`text-${color}-400`} />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
              <p className="text-[11px] text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table — click row to open detail */}
      <ClientSideTable
        data={records}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((records.length || 1) / 20)}
        searchableColumns={[{ id: 'device', title: 'IMEI / Device' }]}
        filterableColumns={[{
          id: 'status',
          title: 'Status',
          options: [
            { label: 'In Stock',  value: 'IN_STOCK'             },
            { label: 'Sold',      value: 'SOLD'                 },
            { label: 'In Repair', value: 'IN_REPAIR'            },
            { label: 'Warranty',  value: 'UNDER_WARRANTY_CLAIM' },
            { label: 'Scrapped',  value: 'SCRAPPED'             },
          ],
        }]}
      />
    </div>
  )
}
