'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Loader2, LifeBuoy, Plus, Send, Ticket, X, MessageCircle,
  CreditCard, UserRound, BookOpen, Sparkles, HelpCircle, Wrench,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  supportTicketsApi,
  supportChatApi,
  type SupportAgent,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '@/lib/api'
import { SupportLiveChatPanel } from '@/components/support/SupportLiveChatWidget'

const SupportLottie = dynamic(
  () => import('lottie-react').then((mod) => mod.Lottie),
  { ssr: false },
)

const CATEGORIES: SupportTicketCategory[] = ['BUG', 'BILLING', 'HOW_TO', 'ACCOUNT', 'FEATURE', 'OTHER']
const PRIORITIES: SupportTicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

type TicketFilter = 'ALL' | 'OPEN' | 'WAITING' | 'RESOLVED' | 'CLOSED'

const TOPICS: Array<{
  key: SupportTicketCategory
  title: string
  blurb: string
  icon: typeof Wrench
}> = [
  { key: 'BUG', title: 'Technical Issues', blurb: 'Bugs, errors, and system problems', icon: Wrench },
  { key: 'BILLING', title: 'Billing & Payments', blurb: 'Invoices, subscriptions, payments', icon: CreditCard },
  { key: 'ACCOUNT', title: 'Account Help', blurb: 'Login, users, permissions', icon: UserRound },
  { key: 'HOW_TO', title: 'How To', blurb: 'Guides and feature walkthroughs', icon: BookOpen },
  { key: 'FEATURE', title: 'Feature Requests', blurb: 'Ideas to improve Hexalyte', icon: Sparkles },
  { key: 'OTHER', title: 'Other', blurb: 'Anything else we can help with', icon: HelpCircle },
]

function statusTone(status: string) {
  if (status === 'OPEN') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
  if (status === 'IN_PROGRESS') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
  if (status === 'WAITING_CUSTOMER') return 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/25'
  if (status === 'RESOLVED') return 'bg-brand-500/15 text-sky-700 dark:text-sky-300 border-brand-500/25'
  return 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/25'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function matchesFilter(t: SupportTicket, filter: TicketFilter) {
  if (filter === 'ALL') return true
  if (filter === 'OPEN') return t.status === 'OPEN' || t.status === 'IN_PROGRESS'
  if (filter === 'WAITING') return t.status === 'WAITING_CUSTOMER'
  if (filter === 'RESOLVED') return t.status === 'RESOLVED'
  if (filter === 'CLOSED') return t.status === 'CLOSED'
  return true
}

function SupportPageInner() {
  const [items, setItems] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SupportTicket | null>(null)
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>('ALL')
  const [createOpen, setCreateOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<SupportTicketCategory>('OTHER')
  const [priority, setPriority] = useState<SupportTicketPriority>('MEDIUM')
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)
  const [mobilePane, setMobilePane] = useState<'tickets' | 'hub' | 'chat'>('hub')
  const [agents, setAgents] = useState<SupportAgent[]>([])
  const [requestAgentEmail, setRequestAgentEmail] = useState<string | null>(null)
  const [chatActive, setChatActive] = useState(false)
  const [pickingTeam, setPickingTeam] = useState(false)

  const onlineCount = agents.filter((a) => a.isOnline).length
  const teamOnline = onlineCount > 0

  const filtered = useMemo(
    () => items.filter((t) => matchesFilter(t, ticketFilter)),
    [items, ticketFilter],
  )

  const filterCounts = useMemo(() => {
    const count = (f: TicketFilter) => items.filter((t) => matchesFilter(t, f)).length
    return {
      ALL: items.length,
      OPEN: count('OPEN'),
      WAITING: count('WAITING'),
      RESOLVED: count('RESOLVED'),
      CLOSED: count('CLOSED'),
    }
  }, [items])

  const loadAgents = useCallback(async () => {
    try {
      const res = await supportChatApi.agents()
      const rows = (res as { data: SupportAgent[] }).data
      setAgents(Array.isArray(rows) ? rows : [])
    } catch {
      setAgents([])
    }
  }, [])

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
    void loadAgents()
    const t = setInterval(() => void loadAgents(), 15000)
    return () => clearInterval(t)
  }, [load, loadAgents])

  const openTicket = async (id: string) => {
    try {
      const res = await supportTicketsApi.get(id)
      setSelected(res.data)
      setPickingTeam(false)
      setMobilePane('hub')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to open ticket')
    }
  }

  const openCreate = (cat?: SupportTicketCategory) => {
    if (cat) setCategory(cat)
    setCreateOpen(true)
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
      setMobilePane('hub')
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

  const closeChat = () => {
    setChatActive(false)
    setPickingTeam(false)
    setRequestAgentEmail(null)
    setMobilePane('hub')
  }

  const beginLiveChat = () => {
    setSelected(null)
    setPickingTeam(true)
    setChatActive(false)
    setRequestAgentEmail(null)
    setMobilePane('chat')
  }

  const startWithAgent = (agent: SupportAgent) => {
    setSelected(null)
    setPickingTeam(false)
    setRequestAgentEmail(agent.email)
    setChatActive(true)
    setMobilePane('chat')
  }

  const showChatPane = pickingTeam || chatActive

  const filters: Array<{ key: TicketFilter; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'OPEN', label: 'Open' },
    { key: 'WAITING', label: 'Waiting' },
    { key: 'RESOLVED', label: 'Resolved' },
    { key: 'CLOSED', label: 'Closed' },
  ]

  return (
    <div
      className="support-page flex flex-col"
      style={{
        margin: 'calc(var(--main-pad) * -1)',
        width: 'calc(100% + 2 * var(--main-pad))',
        height: 'calc(100dvh - 3.5rem)',
        minHeight: 560,
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
            <LifeBuoy size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-[var(--text-primary)] md:text-lg">Support Center</h1>
            <p className="truncate text-[11px] text-[var(--text-muted)]">
              Tickets & live chat with Hexalyte
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              teamOnline ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-[var(--bg-subtle-md)] text-[var(--text-muted)]'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${teamOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {teamOnline ? `${onlineCount} online` : 'Offline'}
          </div>
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-500"
          >
            <Plus size={15} /> New Ticket
          </button>
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="flex shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-card)] lg:hidden">
        {(
          [
            ['tickets', 'Tickets'],
            ['hub', 'Help'],
            ...(showChatPane ? ([['chat', 'Chat']] as const) : []),
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`flex-1 py-2.5 text-xs font-bold ${
              mobilePane === key ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400' : 'text-[var(--text-muted)]'
            }`}
            onClick={() => setMobilePane(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className={`grid min-h-0 flex-1 lg:gap-3 lg:p-3 ${
          showChatPane
            ? 'lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(300px,360px)]'
            : 'lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]'
        }`}
      >
        {/* LEFT — tickets */}
        <aside
          className={`min-h-0 flex-col bg-[var(--bg-card)] lg:rounded-xl lg:border lg:border-[var(--border-default)] ${
            mobilePane === 'tickets' ? 'flex' : 'hidden'
          } lg:flex`}
        >
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-3">
            <div className="text-sm font-bold text-[var(--text-primary)]">Your Tickets</div>
            <span className="rounded-md bg-[var(--bg-subtle-md)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
              {items.length}
            </span>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] px-2 py-2">
            {filters.map((f) => {
              const n = filterCounts[f.key]
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setTicketFilter(f.key)}
                  className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${
                    ticketFilter === f.key
                      ? 'bg-brand-600 text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle-md)]'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1 ${ticketFilter === f.key ? 'text-brand-100' : 'text-[var(--text-muted)]'}`}>
                    {n}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {loading && (
              <div className="flex justify-center py-10 text-[var(--text-muted)]">
                <Loader2 className="animate-spin" size={18} />
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-2 py-10 text-center">
                <p className="text-sm text-[var(--text-muted)]">No tickets here</p>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                  onClick={() => setTicketFilter('ALL')}
                >
                  Show all tickets
                </button>
              </div>
            )}
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => void openTicket(t.id)}
                className={`block w-full rounded-lg border px-3 py-2.5 text-left transition ${
                  selected?.id === t.id
                    ? 'border-sky-400 bg-brand-500/10'
                    : 'border-transparent hover:border-[var(--border-default)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">{t.ticketNumber}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${statusTone(t.status)}`}
                  >
                    {t.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[13px] font-semibold text-[var(--text-primary)]">{t.subject}</div>
                <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                  {t.priority} · {t.category} · {timeAgo(t.createdAt)}
                  {t.slaBreached ? (
                    <span className="ml-1 font-semibold text-rose-600 dark:text-rose-400">· SLA</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* CENTER — hub / ticket detail */}
        <section
          className={`min-h-0 flex-col overflow-hidden bg-[var(--bg-card)] lg:rounded-xl lg:border lg:border-[var(--border-default)] ${
            mobilePane === 'hub' ? 'flex' : 'hidden'
          } lg:flex`}
        >
          {selected ? (
            <>
              <div className="shrink-0 border-b border-[var(--border-subtle)] px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-[var(--text-muted)]">{selected.ticketNumber}</div>
                    <h2 className="mt-0.5 text-base font-bold text-[var(--text-primary)]">{selected.subject}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      <span className={`rounded border px-1.5 py-0.5 font-bold uppercase ${statusTone(selected.status)}`}>
                        {selected.status.replace(/_/g, ' ')}
                      </span>
                      <span>
                        {selected.priority} · {selected.category}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-subtle-md)]"
                    onClick={() => setSelected(null)}
                  >
                    Back
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
                {(selected.messages ?? []).map((m) => (
                  <div key={m.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                      {m.authorType.replace(/_/g, ' ')} · {m.authorEmail}
                      <span className="ml-2 font-normal">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed text-[var(--text-primary)]">{m.body}</div>
                  </div>
                ))}
              </div>
              {selected.status !== 'CLOSED' && (
                <div className="flex shrink-0 gap-2 border-t border-[var(--border-subtle)] p-3">
                  <input
                    className="h-10 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-brand-500"
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
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                    onClick={() => void sendReply()}
                  >
                    <Send size={15} /> Reply
                  </button>
                  {selected.status === ('RESOLVED' as SupportTicketStatus) && (
                    <button
                      type="button"
                      className="h-10 rounded-lg border border-[var(--border-default)] px-3 text-xs font-semibold"
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
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-4xl flex-col px-5 py-5 md:px-7 md:py-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-full max-w-[200px] md:max-w-[220px]">
                    <SupportLottie
                      src="/lottie/customer-support.json"
                      autoplay
                      loop
                      style={{ width: '100%', height: 'auto' }}
                    />
                  </div>
                  <h2 className="mt-1.5 text-xl font-bold tracking-tight text-[var(--text-primary)] md:text-2xl">
                    How can we help?
                  </h2>
                  <p className="mt-1.5 max-w-md text-[13px] text-[var(--text-muted)] md:text-sm">
                    Pick live chat or open a ticket — we&apos;re here for you.
                  </p>
                </div>

                <div className="mt-5 grid gap-3.5 sm:grid-cols-2 md:gap-4">
                  <button
                    type="button"
                    onClick={beginLiveChat}
                    className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 text-left transition hover:border-brand-300 hover:shadow-sm md:p-5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-300">
                      <MessageCircle size={20} />
                    </div>
                    <div className="mt-3 text-base font-bold text-[var(--text-primary)]">Live Chat</div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
                      Talk to a Hexalyte teammate in real time.
                    </p>
                    <div className="mt-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {onlineCount > 0 ? `${onlineCount} online now` : 'Leave a message anytime'}
                    </div>
                    <span className="mt-4 inline-flex rounded-lg bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white">
                      Start Live Chat
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openCreate()}
                    className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 text-left transition hover:border-emerald-300 hover:shadow-sm md:p-5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 dark:text-emerald-300">
                      <Ticket size={20} />
                    </div>
                    <div className="mt-3 text-base font-bold text-[var(--text-primary)]">Support Ticket</div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
                      Billing, bugs, account — tracked with SLA.
                    </p>
                    <span className="mt-9 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[13px] font-semibold text-white">
                      <Plus size={14} /> Create Ticket
                    </span>
                  </button>
                </div>

                <div className="mt-7">
                  <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    Common topics
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {TOPICS.map((topic) => {
                      const Icon = topic.icon
                      return (
                        <button
                          key={topic.key}
                          type="button"
                          onClick={() => openCreate(topic.key)}
                          className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] px-3.5 py-3 text-left transition hover:border-brand-300 hover:bg-brand-500/10"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-subtle)] text-brand-600 dark:text-brand-400">
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                              {topic.title}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                              {topic.blurb}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT — only when chat / team pick is active */}
        {showChatPane && (
          <aside
            className={`min-h-0 flex-col overflow-hidden bg-[var(--bg-card)] lg:rounded-xl lg:border lg:border-[var(--border-default)] ${
              mobilePane === 'chat' ? 'flex' : 'hidden'
            } lg:flex`}
          >
            {chatActive ? (
              <SupportLiveChatPanel
                embedded
                className="h-full w-full"
                requestAgentEmail={requestAgentEmail}
                onRequestHandled={() => setRequestAgentEmail(null)}
                onClose={closeChat}
              />
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">Pick a teammate</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {onlineCount > 0 ? `${onlineCount} online` : 'Team offline — leave a message'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle-md)]"
                    onClick={closeChat}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
                  {agents.length === 0 && (
                    <p className="py-10 text-center text-sm text-[var(--text-muted)]">No agents available yet.</p>
                  )}
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => startWithAgent(agent)}
                      className="flex w-full items-center gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-500/10"
                    >
                      <div className="relative shrink-0">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${
                            agent.isOnline ? 'bg-brand-600' : 'bg-slate-400'
                          }`}
                        >
                          {initials(agent.name)}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-card)] ${
                            agent.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{agent.name}</div>
                        <div className="truncate text-[10px] text-[var(--text-muted)]">{agent.title}</div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                          agent.isOnline
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-[var(--bg-subtle-md)] text-[var(--text-muted)]'
                        }`}
                      >
                        {agent.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Create ticket modal */}
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
            className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-3.5">
              <div>
                <div className="text-base font-bold text-[var(--text-primary)]">New support ticket</div>
                <div className="text-[12px] text-[var(--text-muted)]">Hexalyte will respond by SLA priority</div>
              </div>
              <button type="button" className="rounded-lg p-2 hover:bg-[var(--bg-subtle-md)]" onClick={() => setCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <input
                className="h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-brand-500"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="h-11 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]"
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
                  className="h-11 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]"
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
                className="min-h-[140px] w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-brand-500"
                placeholder="Describe the issue…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-5 py-3">
              <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
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
    <Suspense fallback={<div className="p-8 text-sm text-[var(--text-muted)]">Loading support…</div>}>
      <SupportPageInner />
    </Suspense>
  )
}
