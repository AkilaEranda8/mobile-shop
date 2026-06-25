'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Plus, X, Loader2, ArrowLeftRight, Trash2, Eye,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exchangesApi } from '@/lib/api'
import { ExchangeWizard } from '@/components/exchanges/ExchangeWizard'
import toast from 'react-hot-toast'

const CONDITIONS = [
  { value: 'EXCELLENT', label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { value: 'GOOD',      label: 'Good',      color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/20'   },
  { value: 'FAIR',      label: 'Fair',      color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20'  },
  { value: 'POOR',      label: 'Poor',      color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20'     },
]

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
    } catch (err: any) {
      toast.error(err?.message ?? 'Delete failed')
    }
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
              {(exchange.oldColor || exchange.oldStorage) && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Colour / Storage</span>
                  <span className="text-slate-300">{[exchange.oldStorage, exchange.oldColor].filter(Boolean).join(' · ')}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Condition</span>
                <span className={`font-semibold ${cond.color}`}>{cond.label}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Buy Price</span>
                <span className="font-bold text-amber-400">{formatCurrency(exchange.exchangeValue)}</span>
              </div>
              {exchange.invoiceNumber && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Invoice</span>
                  <span className="font-mono text-violet-400">{exchange.invoiceNumber}</span>
                </div>
              )}
              {exchange.balanceAmount != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Balance</span>
                  <span className={`font-bold ${exchange.balanceDirection === 'SHOP_REFUNDS' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatCurrency(exchange.balanceAmount)} ({exchange.balanceDirection === 'SHOP_REFUNDS' ? 'refund' : 'paid'})
                  </span>
                </div>
              )}
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
      id: 'balance',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
      cell: ({ row }) => row.original.balanceAmount != null ? (
        <div>
          <span className={`text-sm font-bold ${row.original.balanceDirection === 'SHOP_REFUNDS' ? 'text-red-400' : 'text-emerald-400'}`}>
            {formatCurrency(row.original.balanceAmount)}
          </span>
          <p className="text-[10px] text-slate-500">
            {row.original.balanceDirection === 'SHOP_REFUNDS' ? 'Shop refunds' : 'Customer pays'}
          </p>
        </div>
      ) : <span className="text-xs text-slate-600">—</span>,
    },
    {
      accessorKey: 'invoiceNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
      cell: ({ row }) => row.original.invoiceNumber
        ? <span className="text-xs font-mono text-violet-400">{row.original.invoiceNumber}</span>
        : <span className="text-xs text-slate-600">—</span>,
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
      {showNew   && <ExchangeWizard onClose={() => setShowNew(false)} onSaved={fetchExchanges} />}
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
          { label: 'With Invoice',      value: String(records.filter(r => r.invoiceNumber).length), color: 'green'  },
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
            'Customer brings old phone — you enter buy price (valuation).',
            'Select a new phone from shop stock with IMEI.',
            'System adds trade-in to stock, sells new phone, and generates invoice.',
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
