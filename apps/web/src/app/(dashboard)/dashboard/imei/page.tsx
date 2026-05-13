'use client'

import { useState, useEffect, useMemo } from 'react'
import { Smartphone, Plus, CheckCircle, X, Loader2, Hash, ShoppingBag, Wrench } from 'lucide-react'
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
  const [showAdd, setShowAdd] = useState(false)
  const [scanMode, setScanMode] = useState(false)

  const { data, loading, refetch } = useImeiRecords()
  const records: any[] = (data?.data ?? []) as any[]
  const total = (data as any)?.meta?.total ?? records.length

  const counts = {
    total,
    inStock:  records.filter((d: any) => d.status === 'IN_STOCK').length,
    sold:     records.filter((d: any) => d.status === 'SOLD').length,
    inRepair: records.filter((d: any) => d.status === 'IN_REPAIR').length,
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
            <p className="text-sm font-medium text-slate-200">{row.original.product?.name ?? '—'}</p>
            <p className="text-xs font-mono text-slate-500">{row.original.imei}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'brand',
      accessorFn: (row) => row.product?.brand?.name ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Brand" />,
      cell: ({ row }) => <span className="text-xs text-slate-300">{row.original.product?.brand?.name ?? '—'}</span>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const st = statusConfig[row.original.status] ?? statusConfig['IN_STOCK']
        return (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${st.color} ${st.bg} ${st.border}`}>
            {st.label}
          </span>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Added" />,
      cell: ({ row }) => <span className="text-xs text-slate-500">{new Date(row.original.createdAt).toLocaleDateString('en-IN')}</span>,
    },
  ], [])

  const stats = [
    { label: 'Total Devices', value: total,          icon: Smartphone,   color: 'violet' },
    { label: 'In Stock',      value: counts.inStock,  icon: CheckCircle,  color: 'green'  },
    { label: 'Sold',          value: counts.sold,     icon: ShoppingBag,  color: 'blue'   },
    { label: 'In Repair',     value: counts.inRepair, icon: Wrench,       color: 'yellow' },
  ]

  return (
    <div className="space-y-6">
      {showAdd && <AddIMEIModal onClose={() => setShowAdd(false)} onSaved={refetch} />}

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
            onKeyDown={e => { if (e.key === 'Enter') { setScanMode(false) } }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
              <Icon size={15} className={`text-${color}-400`} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-[11px] text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <ClientSideTable
        data={records}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((records.length || 1) / 20)}
        searchableColumns={[
          { id: 'device', title: 'IMEI / Device' },
        ]}
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
