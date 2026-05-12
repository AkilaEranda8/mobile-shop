'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Search, Receipt, Eye, X, Calendar, User, Package,
  CreditCard, Loader2, ChevronDown, Hash, ShoppingBag,
  Banknote, Smartphone, TrendingUp,
} from 'lucide-react'
import { salesApi } from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

const statusColors: Record<string, string> = {
  PAID:           'bg-green-500/10  border-green-500/20  text-green-400',
  PARTIAL:        'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  UNPAID:         'bg-red-500/10    border-red-500/20    text-red-400',
  REFUNDED:       'bg-slate-500/10  border-slate-500/20  text-slate-400',
}

const methodIcon: Record<string, React.ReactNode> = {
  CASH:   <Banknote   size={11} />,
  CARD:   <CreditCard size={11} />,
  UPI:    <Smartphone size={11} />,
}

/* ── Sale Details Modal ──────────────────────────────────────────────────── */
function SaleDetailsModal({ sale, onClose }: { sale: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <div className="flex items-center gap-2">
            <Receipt size={15} className="text-violet-400" />
            <div>
              <p className="text-xs font-mono text-violet-400">{sale.invoiceNumber}</p>
              <p className="text-sm font-bold text-white">{sale.customerName || 'Walk-in Customer'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${statusColors[sale.status] ?? ''}`}>
              {sale.status}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Date',     value: formatDate(sale.createdAt),         icon: Calendar },
              { label: 'Cashier',  value: sale.cashierName,                   icon: User     },
              { label: 'Invoice',  value: sale.invoiceNumber,                 icon: Hash     },
              { label: 'Customer', value: sale.customerName || 'Walk-in',     icon: User     },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white/3 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={10} className="text-slate-500" />
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                </div>
                <p className="text-xs font-semibold text-slate-200 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Items */}
          <div className="bg-white/3 rounded-xl border border-white/5 overflow-hidden">
            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Items ({sale.items?.length ?? 0})</p>
            </div>
            {sale.items?.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2.5 border-b border-white/3 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{item.productName}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{item.sku}{item.imei ? ` · ${item.imei}` : ''}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs font-bold text-white">{formatCurrency(item.total)}</p>
                  <p className="text-[10px] text-slate-500">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="bg-white/3 rounded-xl border border-white/5 p-3 space-y-1.5">
            {[
              { label: 'Subtotal',  value: formatCurrency(sale.subtotal) },
              { label: 'Discount',  value: `- ${formatCurrency(sale.discount)}`, hide: !sale.discount },
              { label: 'Tax',       value: `+ ${formatCurrency(sale.tax)}`,       hide: !sale.tax      },
            ].filter(r => !r.hide).map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs text-slate-400">
                <span>{label}</span><span>{value}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-white/5">
              <span>Total</span><span>{formatCurrency(sale.total)}</span>
            </div>
            {sale.dueAmount > 0 && (
              <div className="flex justify-between text-xs text-yellow-400">
                <span>Due</span><span>{formatCurrency(sale.dueAmount)}</span>
              </div>
            )}
          </div>

          {/* Payments */}
          {sale.payments?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Payments</p>
              {sale.payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-white/3 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-slate-300">
                    {methodIcon[p.method] ?? <CreditCard size={11} />}
                    <span className="text-xs">{p.method}</span>
                    {p.reference && <span className="text-[10px] text-slate-500 font-mono">{p.reference}</span>}
                  </div>
                  <span className="text-xs font-semibold text-white">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {sale.notes && (
            <div className="p-3 bg-white/3 rounded-xl border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-xs text-slate-300">{sale.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main Sales Page ─────────────────────────────────────────────────────── */
export default function SalesPage() {
  const [sales, setSales]           = useState<any[]>([])
  const [meta, setMeta]             = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('')
  const [page, setPage]             = useState(1)
  const [detailSale, setDetailSale] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' }
      if (search)       params.search = search
      if (statusFilter) params.status = statusFilter
      const res: any = await salesApi.list(params)
      setSales(res?.data?.data ?? [])
      setMeta(res?.data ?? null)
    } catch { toast.error('Failed to load sales') }
    finally { setLoading(false) }
  }, [page, search, statusFilter])

  useEffect(() => { load() }, [load])

  // Debounce search
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const totalPages = meta ? Math.ceil(meta.total / 20) : 1

  /* Stats */
  const totalRevenue  = sales.reduce((s, r) => s + (r.total ?? 0), 0)
  const paidCount     = sales.filter(r => r.status === 'PAID').length
  const partialCount  = sales.filter(r => r.status === 'PARTIAL').length

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <h1 className="page-title">Sales</h1>
        <p className="page-subtitle">View and manage all sales transactions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Sales',    value: String(meta?.total ?? '—'),        icon: ShoppingBag,  color: 'violet' },
          { label: 'Revenue',        value: formatCurrency(totalRevenue),       icon: TrendingUp,   color: 'green'  },
          { label: 'Paid',           value: String(paidCount),                  icon: Receipt,      color: 'green'  },
          { label: 'Partial / Due',  value: String(partialCount),               icon: CreditCard,   color: 'yellow' },
        ].map(({ label, value, icon: Icon, color }) => (
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input-field pl-8 text-sm" placeholder="Search invoice, customer…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="relative">
          <select className="input-field text-sm pr-8 appearance-none"
            value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="UNPAID">Unpaid</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 size={22} className="animate-spin text-violet-400" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Receipt size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No sales found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  {['Invoice', 'Date', 'Customer', 'Items', 'Total', 'Payment', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono text-violet-400">{sale.invoiceNumber}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs text-slate-300">{formatDate(sale.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-200 truncate max-w-32">{sale.customerName || 'Walk-in'}</p>
                      {sale.customerPhone && <p className="text-[10px] text-slate-500">{sale.customerPhone}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-400">
                        <Package size={11} />
                        <span className="text-xs">{sale.items?.length ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-bold text-white">{formatCurrency(sale.total)}</p>
                      {sale.dueAmount > 0 && (
                        <p className="text-[10px] text-yellow-400">Due: {formatCurrency(sale.dueAmount)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sale.payments?.[0] && (
                        <div className="flex items-center gap-1 text-slate-400">
                          {methodIcon[sale.payments[0].method] ?? <CreditCard size={11} />}
                          <span className="text-[10px]">{sale.payments[0].method}</span>
                          {sale.payments.length > 1 && <span className="text-[10px] text-slate-600">+{sale.payments.length - 1}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusColors[sale.status] ?? ''}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDetailSale(sale)}
                        className="p-1.5 text-slate-600 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors">
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{meta?.total} total records</p>
          <div className="flex gap-1.5">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-violet-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Previous
            </button>
            <span className="px-3 py-1.5 text-xs text-slate-300">
              {page} / {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-violet-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Next
            </button>
          </div>
        </div>
      )}

      {detailSale && <SaleDetailsModal sale={detailSale} onClose={() => setDetailSale(null)} />}
    </div>
  )
}
