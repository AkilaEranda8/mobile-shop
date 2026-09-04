'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  customerServiceTicketsApi,
  type CustomerServiceTicket,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '@/lib/api'

const PRIORITIES: SupportTicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const STATUSES: SupportTicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED']

export default function CustomerServiceTicketsPage() {
  const [items, setItems] = useState<CustomerServiceTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CustomerServiceTicket | null>(null)
  const [creating, setCreating] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<SupportTicketPriority>('MEDIUM')
  const [reply, setReply] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await customerServiceTicketsApi.list()
      setItems(res.data ?? [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    if (!subject.trim() || !body.trim()) return toast.error('Subject and details required')
    try {
      const res = await customerServiceTicketsApi.create({ subject, body, priority })
      toast.success(res.data.ticketNumber)
      setCreating(false)
      setSubject('')
      setBody('')
      await load()
      setSelected(res.data)
    } catch (e: any) {
      toast.error(e?.message || 'Create failed')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Customer Service Tickets</h1>
          <p className="text-sm text-slate-500">In-shop SR tickets for your customers (staff-managed)</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
          onClick={() => setCreating(true)}
        >
          <Plus size={14} /> New
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No customer SRs yet</p>
          ) : (
            items.map((t) => (
              <button
                key={t.id}
                type="button"
                className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800"
                onClick={() => void customerServiceTicketsApi.get(t.id).then((r) => setSelected(r.data))}
              >
                <div className="text-xs font-mono text-slate-500">{t.ticketNumber}</div>
                <div className="truncate text-sm font-semibold">{t.subject}</div>
                <div className="text-[11px] text-slate-500">{t.status} · {t.priority}</div>
              </button>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          {creating ? (
            <div className="space-y-3">
              <input className="h-10 w-full rounded-lg border px-3 text-sm dark:border-slate-600 dark:bg-transparent" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <select className="h-10 w-full rounded-lg border px-2 text-sm dark:border-slate-600 dark:bg-transparent" value={priority} onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <textarea className="min-h-[120px] w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-transparent" placeholder="Details" value={body} onChange={(e) => setBody(e.target.value)} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setCreating(false)}>Cancel</button>
                <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void create()}>Create</button>
              </div>
            </div>
          ) : selected ? (
            <div className="flex min-h-[360px] flex-col">
              <div className="mb-3">
                <div className="text-xs font-mono text-slate-500">{selected.ticketNumber}</div>
                <div className="font-semibold">{selected.subject}</div>
                <select
                  className="mt-2 h-9 rounded-lg border px-2 text-xs dark:border-slate-600 dark:bg-transparent"
                  value={selected.status}
                  onChange={(e) =>
                    void customerServiceTicketsApi
                      .patch(selected.id, { status: e.target.value as SupportTicketStatus })
                      .then((r) => { setSelected(r.data); void load() })
                  }
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {(selected.messages ?? []).map((m) => (
                  <div key={m.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                    <div className="text-[10px] uppercase text-slate-500">{m.authorEmail}</div>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input className="h-10 flex-1 rounded-lg border px-3 text-sm dark:border-slate-600 dark:bg-transparent" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Add note / reply" />
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white"
                  onClick={() =>
                    void customerServiceTicketsApi.reply(selected.id, reply).then((r) => {
                      setSelected(r.data)
                      setReply('')
                    })
                  }
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-slate-500">Select a ticket</p>
          )}
        </div>
      </div>
    </div>
  )
}
