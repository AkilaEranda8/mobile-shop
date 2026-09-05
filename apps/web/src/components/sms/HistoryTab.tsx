'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search, CheckCircle2, XCircle, RefreshCw,
  Loader2, MessageSquare, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { smsApi, SMS_EVENT_LABELS, type SmsHistoryItem } from '@/lib/sms-api'

const STATUS_CFG = {
  sent:   { Icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  label: 'Sent'   },
  failed: { Icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    label: 'Failed' },
} as const

type FilterStatus = 'all' | 'sent' | 'failed'
const PAGE_SIZE = 10

function unwrapApiData<T>(res: unknown): T | null {
  if (res != null && typeof res === 'object' && 'data' in res) {
    return ((res as { data: T | null }).data ?? null) as T | null
  }
  return (res as T) ?? null
}

export default function HistoryTab() {
  const [items, setItems] = useState<SmsHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [page, setPage] = useState(1)

  const load = async () => {
    setLoading(true)
    try {
      const res = await smsApi.getHistory()
      const data = unwrapApiData<SmsHistoryItem[]>(res)
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = items.filter(it => {
    const q = query.toLowerCase()
    const matchQ = !q
      || (it.customerName ?? '').toLowerCase().includes(q)
      || (it.referenceId ?? '').toLowerCase().includes(q)
      || (it.phone ?? '').includes(query)
      || (it.preview ?? '').toLowerCase().includes(q)
    const matchF = filter === 'all' || it.status === filter
    return matchQ && matchF
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const counts = {
    all: items.length,
    sent: items.filter(i => i.status === 'sent').length,
    failed: items.filter(i => i.status === 'failed').length,
  }

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'sent', label: `Sent (${counts.sent})` },
    { key: 'failed', label: `Failed (${counts.failed})` },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
      <div className="p-5 border-b border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={15} className="text-brand-400" />
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>SMS send history</h2>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">All SMS messages logged for this shop</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input-field pl-8 py-1.5 text-sm w-52" placeholder="Search phone, ref, name…"
                value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} />
            </div>
            <button onClick={load} disabled={loading}
              className="p-2 rounded-lg border transition-all disabled:opacity-40"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
              {loading ? <Loader2 size={13} className="animate-spin text-slate-400" /> : <RefreshCw size={13} className="text-slate-400" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-4 overflow-x-auto">
          {filterTabs.map(({ key, label }) => (
            <button key={key} onClick={() => { setFilter(key); setPage(1) }}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === key ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-brand-400" />
        </div>
      ) : paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <MessageSquare size={32} className="text-slate-600" />
          <p className="text-sm text-slate-500">No SMS history found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="table-header">Reference</th>
                <th className="table-header">Customer</th>
                <th className="table-header hidden sm:table-cell">Phone</th>
                <th className="table-header hidden md:table-cell">Type</th>
                <th className="table-header hidden lg:table-cell">Preview</th>
                <th className="table-header">Status</th>
                <th className="table-header hidden md:table-cell">Sent at</th>
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
                      <span className="font-mono text-xs text-brand-400">{item.referenceId || '—'}</span>
                    </td>
                    <td className="table-cell">
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {item.customerName || '—'}
                      </span>
                    </td>
                    <td className="table-cell hidden sm:table-cell">
                      <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{item.phone}</span>
                    </td>
                    <td className="table-cell hidden md:table-cell text-xs" style={{ color: 'var(--text-muted)' }}>
                      {SMS_EVENT_LABELS[item.eventType] ?? item.eventType}
                    </td>
                    <td className="table-cell hidden lg:table-cell max-w-[200px]">
                      <span className="text-xs truncate block" style={{ color: 'var(--text-muted)' }} title={item.preview}>
                        {item.preview}
                      </span>
                      {item.errorMessage && (
                        <span className="text-[10px] text-red-400 truncate block" title={item.errorMessage}>
                          {item.errorMessage}
                        </span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={`badge-status ${sc.bg} border ${sc.border} ${sc.color} text-[10px]`}>
                        <sc.Icon size={9} /> {sc.label}
                      </span>
                    </td>
                    <td className="table-cell hidden md:table-cell text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(item.sentAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/5">
          <span className="text-xs text-gray-500 dark:text-slate-500">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/5">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${n === page ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/5">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
