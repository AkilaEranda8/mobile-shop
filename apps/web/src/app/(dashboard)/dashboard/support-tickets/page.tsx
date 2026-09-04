'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, MessageCircle, Plus, Send, Ticket } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  supportTicketsApi,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketPriority,
} from '@/lib/api'

const CATEGORIES: SupportTicketCategory[] = ['BUG', 'BILLING', 'HOW_TO', 'ACCOUNT', 'FEATURE', 'OTHER']
const PRIORITIES: SupportTicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

function SupportTicketsInner() {
  const search = useSearchParams()
  const initialTab = search.get('tab') === 'chat' ? 'chat' : 'tickets'
  const [tab, setTab] = useState<'tickets' | 'chat'>(initialTab)
  const [items, setItems] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SupportTicket | null>(null)
  const [creating, setCreating] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<SupportTicketCategory>('OTHER')
  const [priority, setPriority] = useState<SupportTicketPriority>('MEDIUM')
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await supportTicketsApi.list()
      setItems(res.data ?? [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openTicket = async (id: string) => {
    try {
      const res = await supportTicketsApi.get(id)
      setSelected(res.data)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to open ticket')
    }
  }

  const create = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and details required')
      return
    }
    setSaving(true)
    try {
      const res = await supportTicketsApi.create({ subject, body, category, priority })
      toast.success(`Created ${res.data.ticketNumber}`)
      setCreating(false)
      setSubject('')
      setBody('')
      await load()
      setSelected(res.data)
    } catch (e: any) {
      toast.error(e?.message || 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const sendReply = async () => {
    if (!selected || !reply.trim()) return
    setSaving(true)
    try {
      const res = await supportTicketsApi.reply(selected.id, reply.trim())
      setSelected(res.data)
      setReply('')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Reply failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Support</h1>
          <p className="text-sm text-slate-500">SR tickets and live chat with Hexalyte</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'tickets' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}
            onClick={() => setTab('tickets')}
          >
            <span className="inline-flex items-center gap-1.5"><Ticket size={14} /> Tickets</span>
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'chat' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}
            onClick={() => setTab('chat')}
          >
            <span className="inline-flex items-center gap-1.5"><MessageCircle size={14} /> Live Chat</span>
          </button>
        </div>
      </div>

      {tab === 'chat' ? (
        <div className="rounded-2xl border border-slate-200 p-6 dark:border-slate-700">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Use the floating <b>Live Chat</b> button (bottom-right) to talk to Hexalyte support in real time.
          </p>
          <p className="text-xs text-slate-500">Agents see your chat in the admin Live Chat console.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <span className="text-sm font-semibold">Your tickets</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                onClick={() => setCreating(true)}
              >
                <Plus size={14} /> New
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {loading && (
                <div className="flex justify-center py-10 text-slate-400">
                  <Loader2 className="animate-spin" size={20} />
                </div>
              )}
              {!loading && items.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500">No tickets yet</p>
              )}
              {items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void openTicket(t.id)}
                  className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${selected?.id === t.id ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-500">{t.ticketNumber}</span>
                    <span className={`text-[10px] font-bold uppercase ${t.slaBreached ? 'text-rose-600' : 'text-slate-500'}`}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold">{t.subject}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {t.priority} · {t.category}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700">
            {creating ? (
              <div className="space-y-3 p-4">
                <h2 className="font-semibold">New support ticket</h2>
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-600 dark:bg-transparent"
                  placeholder="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select className="h-10 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-600 dark:bg-transparent" value={category} onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="h-10 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-600 dark:bg-transparent" value={priority} onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <textarea
                  className="min-h-[140px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-transparent"
                  placeholder="Describe the issue…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <div className="flex gap-2">
                  <button type="button" className="rounded-lg px-3 py-2 text-sm" onClick={() => setCreating(false)}>Cancel</button>
                  <button type="button" disabled={saving} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void create()}>
                    {saving ? 'Saving…' : 'Submit'}
                  </button>
                </div>
              </div>
            ) : selected ? (
              <div className="flex h-full min-h-[420px] flex-col">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  <div className="text-xs font-mono text-slate-500">{selected.ticketNumber}</div>
                  <div className="font-semibold">{selected.subject}</div>
                  <div className="text-[11px] text-slate-500">
                    {selected.status} · {selected.priority} · SLA {new Date(selected.slaDueAt).toLocaleString()}
                    {selected.slaBreached ? ' · BREACHED' : ''}
                  </div>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {(selected.messages ?? []).map((m) => (
                    <div key={m.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                      <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">
                        {m.authorType} · {m.authorEmail}
                      </div>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                    </div>
                  ))}
                </div>
                {selected.status !== 'CLOSED' && (
                  <div className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
                    <input
                      className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-600 dark:bg-transparent"
                      placeholder="Reply…"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void sendReply() }}
                    />
                    <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white" onClick={() => void sendReply()}>
                      <Send size={16} />
                    </button>
                    {selected.status === 'RESOLVED' && (
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-600"
                        onClick={() => void supportTicketsApi.close(selected.id).then((r) => { setSelected(r.data); void load() })}
                      >
                        Close
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-[420px] items-center justify-center text-sm text-slate-500">
                Select a ticket or create a new one
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SupportTicketsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading support…</div>}>
      <SupportTicketsInner />
    </Suspense>
  )
}
