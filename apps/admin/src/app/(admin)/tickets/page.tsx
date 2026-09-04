'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Send } from 'lucide-react'
import {
  supportTicketsAdminApi,
  type AdminSupportTicket,
} from '@/lib/api'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED']
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export default function AdminTicketsPage() {
  const [tab, setTab] = useState<'inbox' | 'reports'>('inbox')
  const [items, setItems] = useState<AdminSupportTicket[]>([])
  const [selected, setSelected] = useState<AdminSupportTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [breachedOnly, setBreachedOnly] = useState(false)
  const [q, setQ] = useState('')
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)
  const [reports, setReports] = useState<Record<string, unknown> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (breachedOnly) params.breached = '1'
      if (q.trim()) params.q = q.trim()
      const rows = await supportTicketsAdminApi.list(params)
      setItems(Array.isArray(rows) ? rows : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, breachedOnly, q])

  useEffect(() => {
    void load()
  }, [load])

  const open = async (id: string) => {
    const row = await supportTicketsAdminApi.get(id)
    setSelected(row)
  }

  const loadReports = async () => {
    setReports(await supportTicketsAdminApi.reports())
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-sm text-gray-500">Tenant SR inbox with SLA</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'inbox' ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} onClick={() => setTab('inbox')}>Inbox</button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'reports' ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}
            onClick={() => { setTab('reports'); void loadReports() }}
          >
            Reports
          </button>
          <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => void load()}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {tab === 'reports' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {!reports && <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin" /></div>}
          {reports && (
            <>
              <div className="rounded-xl border bg-white p-4"><div className="text-xs text-gray-500">Open</div><div className="text-2xl font-bold">{String(reports.openCount ?? 0)}</div></div>
              <div className="rounded-xl border bg-white p-4"><div className="text-xs text-gray-500">SLA breached</div><div className="text-2xl font-bold text-rose-600">{String(reports.breachedCount ?? 0)}</div></div>
              <div className="rounded-xl border bg-white p-4"><div className="text-xs text-gray-500">Avg first response (h)</div><div className="text-2xl font-bold">{String(reports.avgFirstResponseHours ?? 0)}</div></div>
              <div className="rounded-xl border bg-white p-4"><div className="text-xs text-gray-500">Avg resolution (h)</div><div className="text-2xl font-bold">{String(reports.avgResolutionHours ?? 0)}</div></div>
              <pre className="col-span-full overflow-auto rounded-xl border bg-white p-4 text-xs text-gray-600">{JSON.stringify(reports, null, 2)}</pre>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border bg-white">
            <div className="flex flex-wrap gap-2 border-b p-3">
              <input className="h-9 flex-1 rounded-lg border px-2 text-sm" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="h-9 rounded-lg border px-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All status</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={breachedOnly} onChange={(e) => setBreachedOnly(e.target.checked)} />
                Breached
              </label>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>}
              {!loading && items.map((t) => (
                <button key={t.id} type="button" className="block w-full border-b px-4 py-3 text-left hover:bg-gray-50" onClick={() => void open(t.id)}>
                  <div className="flex justify-between gap-2 text-xs text-gray-500">
                    <span className="font-mono">{t.ticketNumber}</span>
                    <span className={t.slaBreached ? 'font-bold text-rose-600' : ''}>{t.status}</span>
                  </div>
                  <div className="truncate text-sm font-semibold text-gray-900">{t.subject}</div>
                  <div className="text-[11px] text-gray-500">{t.tenant?.name} · {t.priority}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-white">
            {!selected ? (
              <div className="flex h-[420px] items-center justify-center text-sm text-gray-400">Select a ticket</div>
            ) : (
              <div className="flex min-h-[420px] flex-col">
                <div className="border-b p-4">
                  <div className="font-mono text-xs text-gray-500">{selected.ticketNumber}</div>
                  <div className="text-lg font-bold">{selected.subject}</div>
                  <div className="text-xs text-gray-500">{selected.tenant?.name} · {selected.createdBy?.email}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select
                      className="h-9 rounded-lg border px-2 text-xs"
                      value={selected.status}
                      onChange={(e) => void supportTicketsAdminApi.patch(selected.id, { status: e.target.value }).then(setSelected)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select
                      className="h-9 rounded-lg border px-2 text-xs"
                      value={selected.priority}
                      onChange={(e) => void supportTicketsAdminApi.patch(selected.id, { priority: e.target.value }).then(setSelected)}
                    >
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input
                      className="h-9 rounded-lg border px-2 text-xs"
                      placeholder="Assignee email"
                      defaultValue={selected.assigneeAdminEmail ?? ''}
                      onBlur={(e) =>
                        void supportTicketsAdminApi
                          .patch(selected.id, { assigneeAdminEmail: e.target.value || null })
                          .then(setSelected)
                      }
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {(selected.messages ?? []).map((m) => (
                    <div key={m.id} className={`rounded-xl p-3 text-sm ${m.isInternal ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                      <div className="mb-1 text-[10px] font-semibold uppercase text-gray-500">
                        {m.isInternal ? 'Internal · ' : ''}{m.authorType} · {m.authorEmail}
                      </div>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 border-t p-3">
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                    Internal note (hidden from tenant)
                  </label>
                  <div className="flex gap-2">
                    <input className="h-10 flex-1 rounded-lg border px-3 text-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" />
                    <button
                      type="button"
                      className="inline-flex h-10 items-center gap-1 rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white"
                      onClick={() =>
                        void supportTicketsAdminApi.reply(selected.id, reply, internal).then((r) => {
                          setSelected(r)
                          setReply('')
                          void load()
                        })
                      }
                    >
                      <Send size={14} /> Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
