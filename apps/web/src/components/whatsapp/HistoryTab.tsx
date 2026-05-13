'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search, CheckCircle2, XCircle, Clock, RefreshCw,
  Loader2, FileText, Send, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { whatsappApi, type InvoiceHistoryItem } from '@/lib/whatsapp-api'


const STATUS_CFG = {
  delivered: { Icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  label: 'Delivered' },
  failed:    { Icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    label: 'Failed'    },
  pending:   { Icon: Clock,        color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Pending'   },
}

type FilterStatus = 'all' | 'delivered' | 'failed' | 'pending'
const PAGE_SIZE = 7

export default function HistoryTab() {
  const [items,    setItems]    = useState<InvoiceHistoryItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [query,    setQuery]    = useState('')
  const [filter,   setFilter]   = useState<FilterStatus>('all')
  const [page,     setPage]     = useState(1)

  const load = async () => {
    setLoading(true)
    try {
      const res: any = await whatsappApi.getInvoiceHistory()
      const data = res?.data ?? res
      setItems(Array.isArray(data) ? data : [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = items.filter(it => {
    const matchQ = !query || it.customerName.toLowerCase().includes(query.toLowerCase()) || it.orderId.toLowerCase().includes(query.toLowerCase()) || it.phone.includes(query)
    const matchF = filter === 'all' || it.status === filter
    return matchQ && matchF
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const counts = {
    all:       items.length,
    delivered: items.filter(i => i.status === 'delivered').length,
    failed:    items.filter(i => i.status === 'failed').length,
    pending:   items.filter(i => i.status === 'pending').length,
  }

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'all',       label: `All (${counts.all})`            },
    { key: 'delivered', label: `Delivered (${counts.delivered})` },
    { key: 'failed',    label: `Failed (${counts.failed})`      },
    { key: 'pending',   label: `Pending (${counts.pending})`    },
  ]

  const handleFilterChange = (f: FilterStatus) => { setFilter(f); setPage(1) }
  const handleQuery        = (q: string)        => { setQuery(q);  setPage(1) }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-violet-400" />
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Invoice Send History</h2>
              <p className="text-xs text-slate-500 mt-0.5">All WhatsApp invoice messages sent</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input-field pl-8 py-1.5 text-sm w-48"
                placeholder="Search orders, customers..."
                value={query} onChange={e => handleQuery(e.target.value)} />
            </div>
            <button onClick={load} disabled={loading}
              className="p-2 rounded-lg border transition-all disabled:opacity-40"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
              {loading ? <Loader2 size={13} className="animate-spin text-slate-400" /> : <RefreshCw size={13} className="text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto">
          {filterTabs.map(({ key, label }) => (
            <button key={key} onClick={() => handleFilterChange(key)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-violet-400" />
        </div>
      ) : paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <FileText size={32} className="text-slate-600" />
          <p className="text-sm text-slate-500">No invoice history found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="table-header">Order ID</th>
                <th className="table-header">Customer</th>
                <th className="table-header hidden sm:table-cell">Phone</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header">Status</th>
                <th className="table-header hidden md:table-cell">Sent At</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paged.map((item, i) => {
                const sc = STATUS_CFG[item.status]
                return (
                  <motion.tr key={item.id}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-white/2 transition-colors">
                    <td className="table-cell">
                      <span className="font-mono text-xs text-violet-400">{item.orderId}</span>
                    </td>
                    <td className="table-cell">
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{item.customerName}</span>
                    </td>
                    <td className="table-cell hidden sm:table-cell">
                      <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{item.phone}</span>
                    </td>
                    <td className="table-cell text-right">
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                        LKR {item.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge-status ${sc.bg} border ${sc.border} ${sc.color} text-[10px]`}>
                        <sc.Icon size={9} /> {sc.label}
                      </span>
                    </td>
                    <td className="table-cell hidden md:table-cell text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(item.sentAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="table-cell">
                      {item.status === 'failed' && (
                        <button className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
                          <Send size={10} /> Retry
                        </button>
                      )}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/5">
          <span className="text-xs text-slate-500">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-slate-400 hover:text-white hover:bg-white/5">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${n === page ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-slate-400 hover:text-white hover:bg-white/5">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
