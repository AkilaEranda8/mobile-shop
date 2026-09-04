'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Loader2, LifeBuoy, Plus, Send, Ticket, X, AlertCircle, MessageCircle, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  supportTicketsApi,
  type SupportAgent,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketPriority,
} from '@/lib/api'
import { SupportLiveChatPanel } from '@/components/support/SupportLiveChatWidget'

const SupportLottie = dynamic(
  () => import('lottie-react').then((mod) => mod.Lottie),
  { ssr: false },
)

const CATEGORIES: SupportTicketCategory[] = ['BUG', 'BILLING', 'HOW_TO', 'ACCOUNT', 'FEATURE', 'OTHER']
const PRIORITIES: SupportTicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

function statusTone(status: string) {
  if (status === 'OPEN') return 'bg-sky-500/15 text-sky-600 border-sky-500/25'
  if (status === 'IN_PROGRESS') return 'bg-violet-500/15 text-violet-600 border-violet-500/25'
  if (status === 'WAITING_CUSTOMER') return 'bg-amber-500/15 text-amber-700 border-amber-500/25'
  if (status === 'RESOLVED') return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25'
  return 'bg-slate-500/15 text-slate-600 border-slate-500/25'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function SupportPageInner() {
  const [items, setItems] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SupportTicket | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<SupportTicketCategory>('OTHER')
  const [priority, setPriority] = useState<SupportTicketPriority>('MEDIUM')
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)
  const [mobilePane, setMobilePane] = useState<'tickets' | 'detail' | 'chat'>('detail')
  const [agents, setAgents] = useState<SupportAgent[]>([])
  const [requestAgentEmail, setRequestAgentEmail] = useState<string | null>(null)

  const onlineCount = agents.filter((a) => a.isOnline).length

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
      setMobilePane('detail')
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
      setCreateOpen(false)
      setSubject('')
      setBody('')
      await load()
      setSelected(res.data)
      setMobilePane('detail')
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

  const startWithAgent = (agent: SupportAgent) => {
    setRequestAgentEmail(agent.email)
    setMobilePane('chat')
  }

  return (
    <div
      className="support-page flex flex-col"
      style={{
        margin: 'calc(var(--main-pad) * -1)',
        width: 'calc(100% + 2 * var(--main-pad))',
        height: 'calc(100dvh - 3.5rem)',
        minHeight: 520,
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      <header
        className="relative flex shrink-0 flex-wrap items-center justify-between gap-3 overflow-hidden border-b px-4 py-3.5 md:px-6"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated, var(--bg-card))' }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 60% 120% at 0% 50%, rgba(14,165,233,0.12), transparent 55%), radial-gradient(ellipse 40% 80% at 100% 0%, rgba(16,185,129,0.08), transparent 50%)',
          }}
        />
        <div className="relative flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/25">
            <LifeBuoy size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight leading-tight">Support Center</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              <span>Tickets & live chat with Hexalyte</span>
              <span className="hidden sm:inline text-slate-300">·</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                {onlineCount > 0 ? `${onlineCount} online now` : 'Team offline'}
              </span>
            </p>
          </div>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobilePane('chat')}
            className="hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold sm:inline-flex lg:hidden"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <MessageCircle size={15} className="text-sky-500" /> Chat
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-600/20 hover:bg-sky-500"
          >
            <Plus size={16} /> New ticket
          </button>
        </div>
      </header>

      <div className="flex shrink-0 border-b lg:hidden" style={{ borderColor: 'var(--border-subtle)' }}>
        {(
          [
            ['tickets', 'Tickets'],
            ['detail', 'Team / Ticket'],
            ['chat', 'Live Chat'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`flex-1 py-2.5 text-xs font-bold ${mobilePane === key ? 'border-b-2 border-sky-500 text-sky-600' : ''}`}
            style={{ color: mobilePane === key ? undefined : 'var(--text-muted)' }}
            onClick={() => setMobilePane(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(300px,380px)]">
        {/* Tickets */}
        <aside
          className={`min-h-0 flex-col border-r ${mobilePane === 'tickets' ? 'flex' : 'hidden'} lg:flex`}
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated, var(--bg-card))' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Ticket size={12} /> Your tickets
            </span>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-600">{items.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {loading && (
              <div className="flex justify-center py-12" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="animate-spin" size={20} />
              </div>
            )}
            {!loading && items.length === 0 && (
              <p className="px-3 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No tickets yet — create one or chat live.
              </p>
            )}
            {items.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => void openTicket(t.id)}
                className="mb-1.5 block w-full rounded-xl border px-3.5 py-3 text-left transition hover:border-sky-300/80"
                style={{
                  borderColor: selected?.id === t.id ? 'rgba(14,165,233,0.45)' : 'var(--border-subtle)',
                  background: selected?.id === t.id ? 'rgba(14,165,233,0.08)' : 'transparent',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {t.ticketNumber}
                  </span>
                  <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${statusTone(t.status)}`}>
                    {t.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-1 truncate text-sm font-semibold">{t.subject}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span>{t.priority}</span>
                  <span>·</span>
                  <span>{t.category}</span>
                  {t.slaBreached && (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600">
                      <AlertCircle size={10} /> SLA
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Detail / team hub */}
        <section
          className={`min-h-0 flex-col ${mobilePane === 'detail' ? 'flex' : 'hidden'} lg:flex`}
          style={{ background: 'var(--bg-primary)' }}
        >
          {selected ? (
            <>
              <div
                className="shrink-0 border-b px-5 py-4"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated, var(--bg-card))' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {selected.ticketNumber}
                    </div>
                    <h2 className="mt-0.5 text-lg font-bold leading-snug">{selected.subject}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      <span className={`rounded-md border px-1.5 py-0.5 font-bold uppercase ${statusTone(selected.status)}`}>
                        {selected.status.replace(/_/g, ' ')}
                      </span>
                      <span>{selected.priority}</span>
                      <span>·</span>
                      <span>{selected.category}</span>
                      <span>·</span>
                      <span>SLA {new Date(selected.slaDueAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => setSelected(null)}
                  >
                    Back to team
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {(selected.messages ?? []).map((m) => (
                  <div
                    key={m.id}
                    className="rounded-2xl border px-4 py-3 text-sm"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated, var(--bg-card))' }}
                  >
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      {m.authorType.replace(/_/g, ' ')} · {m.authorEmail}
                      <span className="ml-2 font-normal opacity-70">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>
                  </div>
                ))}
              </div>
              {selected.status !== 'CLOSED' && (
                <div
                  className="flex shrink-0 gap-2 border-t p-3"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated, var(--bg-card))' }}
                >
                  <input
                    className="h-11 flex-1 rounded-xl border bg-transparent px-3 text-sm outline-none focus:border-sky-500"
                    style={{ borderColor: 'var(--border-subtle)' }}
                    placeholder="Write a reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void sendReply()
                    }}
                  />
                  <button
                    type="button"
                    disabled={saving}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                    onClick={() => void sendReply()}
                  >
                    <Send size={16} /> Reply
                  </button>
                  {selected.status === 'RESOLVED' && (
                    <button
                      type="button"
                      className="h-11 rounded-xl border px-3 text-xs font-semibold"
                      style={{ borderColor: 'var(--border-subtle)' }}
                      onClick={() =>
                        void supportTicketsApi.close(selected.id).then((r) => {
                          setSelected(r.data)
                          void load()
                        })
                      }
                    >
                      Close
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(14,165,233,0.14), transparent 60%), radial-gradient(ellipse 50% 40% at 80% 80%, rgba(16,185,129,0.08), transparent 55%)',
                }}
              />
              <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 py-6 md:px-8">
                <div className="w-full max-w-[220px] shrink-0 animate-[scHubIn_0.45s_ease]">
                  <SupportLottie
                    src="/lottie/customer-support.json"
                    autoplay
                    loop
                    style={{ width: '100%', height: 'auto' }}
                  />
                </div>
                <div className="mt-1 max-w-lg text-center">
                  <h2 className="text-2xl font-bold tracking-tight">Meet the Hexalyte team</h2>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Pick who you want to talk to — online agents reply in live chat. Or open a ticket for billing,
                    bugs, and how-to help.
                  </p>
                </div>

                <div className="mt-6 w-full max-w-2xl">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
                      <Users size={13} /> Support team
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {onlineCount > 0 ? `${onlineCount} online` : 'All offline'}
                    </span>
                  </div>

                  {agents.length === 0 ? (
                    <div
                      className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                    >
                      Support agents will appear here when available.
                    </div>
                  ) : (
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {agents.map((agent, i) => (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => startWithAgent(agent)}
                          className="group flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md hover:shadow-sky-500/10 animate-[scHubUp_0.4s_ease_both]"
                          style={{
                            borderColor: 'var(--border-subtle)',
                            background: 'var(--bg-elevated, var(--bg-card))',
                            animationDelay: `${i * 55}ms`,
                          }}
                        >
                          <div className="relative shrink-0">
                            <div
                              className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white ${
                                agent.isOnline ? 'bg-sky-600' : 'bg-slate-400'
                              }`}
                            >
                              {initials(agent.name)}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                agent.isOnline ? 'bg-emerald-500 sc-hub-pulse' : 'bg-slate-400'
                              }`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{agent.name}</div>
                            <div className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {agent.title}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              agent.isOnline
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {agent.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
                  >
                    <Plus size={16} /> Create ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobilePane('chat')}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold lg:hidden"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <MessageCircle size={15} /> Open live chat
                  </button>
                </div>
              </div>
              <style>{`
                @keyframes scHubIn {
                  from { opacity: 0; transform: translateY(6px) scale(0.98); }
                  to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes scHubUp {
                  from { opacity: 0; transform: translateY(10px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                @keyframes scHubPulse {
                  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
                  70% { box-shadow: 0 0 0 7px rgba(16, 185, 129, 0); }
                  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                .sc-hub-pulse { animation: scHubPulse 1.6s ease-out infinite; }
              `}</style>
            </div>
          )}
        </section>

        {/* Live chat */}
        <aside
          className={`min-h-0 border-l ${mobilePane === 'chat' ? 'flex' : 'hidden'} lg:flex`}
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <SupportLiveChatPanel
            embedded
            teamPickerCompact
            className="h-full w-full"
            requestAgentEmail={requestAgentEmail}
            onRequestHandled={() => setRequestAgentEmail(null)}
            onAgentsChange={setAgents}
          />
        </aside>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => setCreateOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New support ticket"
            className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl"
            style={{
              background: 'var(--bg-elevated, var(--bg-card, #fff))',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <div className="text-base font-bold">New support ticket</div>
                <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Hexalyte will respond by SLA priority
                </div>
              </div>
              <button type="button" className="rounded-lg p-2 hover:bg-black/5" onClick={() => setCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <input
                className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm outline-none focus:border-sky-500"
                style={{ borderColor: 'var(--border-subtle)' }}
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="h-11 rounded-xl border bg-transparent px-2 text-sm"
                  style={{ borderColor: 'var(--border-subtle)' }}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <select
                  className="h-11 rounded-xl border bg-transparent px-2 text-sm"
                  style={{ borderColor: 'var(--border-subtle)' }}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                className="min-h-[140px] w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-sky-500"
                style={{ borderColor: 'var(--border-subtle)' }}
                placeholder="Describe the issue…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                onClick={() => void create()}
              >
                {saving ? 'Submitting…' : 'Submit ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SupportTicketsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>Loading support…</div>}>
      <SupportPageInner />
    </Suspense>
  )
}
