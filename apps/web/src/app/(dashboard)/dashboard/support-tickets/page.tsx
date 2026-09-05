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
  if (status === 'OPEN') return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25'
  if (status === 'IN_PROGRESS') return 'bg-amber-500/15 text-amber-700 border-amber-500/25'
  if (status === 'WAITING_CUSTOMER') return 'bg-slate-500/15 text-slate-600 border-slate-500/25'
  if (status === 'RESOLVED') return 'bg-sky-500/15 text-sky-700 border-sky-500/25'
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
        background: '#f1f5f9',
        color: 'var(--text-primary)',
      }}
    >
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white">
            <LifeBuoy size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-slate-900 md:text-lg">Support Center</h1>
            <p className="truncate text-[11px] text-slate-500">
              Tickets & live chat with Hexalyte
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              teamOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${teamOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {teamOnline ? `${onlineCount} online` : 'Offline'}
          </div>
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            <Plus size={15} /> New Ticket
          </button>
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="flex shrink-0 border-b border-slate-200 bg-white lg:hidden">
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
              mobilePane === key ? 'border-b-2 border-sky-500 text-sky-600' : 'text-slate-400'
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
          className={`min-h-0 flex-col bg-white lg:rounded-xl lg:border lg:border-slate-200 ${
            mobilePane === 'tickets' ? 'flex' : 'hidden'
          } lg:flex`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3">
            <div className="text-sm font-bold text-slate-800">Your Tickets</div>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
              {items.length}
            </span>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 py-2">
            {filters.map((f) => {
              const n = filterCounts[f.key]
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setTicketFilter(f.key)}
                  className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${
                    ticketFilter === f.key
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1 ${ticketFilter === f.key ? 'text-sky-100' : 'text-slate-400'}`}>
                    {n}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {loading && (
              <div className="flex justify-center py-10 text-slate-400">
                <Loader2 className="animate-spin" size={18} />
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-2 py-10 text-center">
                <p className="text-sm text-slate-400">No tickets here</p>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-sky-600 hover:underline"
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
                    ? 'border-sky-400 bg-sky-50'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-slate-400">{t.ticketNumber}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${statusTone(t.status)}`}
                  >
                    {t.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[13px] font-semibold text-slate-900">{t.subject}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {t.priority} · {t.category} · {timeAgo(t.createdAt)}
                  {t.slaBreached ? (
                    <span className="ml-1 font-semibold text-rose-600">· SLA</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* CENTER — hub / ticket detail */}
        <section
          className={`min-h-0 flex-col overflow-hidden bg-white lg:rounded-xl lg:border lg:border-slate-200 ${
            mobilePane === 'hub' ? 'flex' : 'hidden'
          } lg:flex`}
        >
          {selected ? (
            <>
              <div className="shrink-0 border-b border-slate-100 px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-slate-400">{selected.ticketNumber}</div>
                    <h2 className="mt-0.5 text-base font-bold text-slate-900">{selected.subject}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
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
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
                    onClick={() => setSelected(null)}
                  >
                    Back
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
                {(selected.messages ?? []).map((m) => (
                  <div key={m.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {m.authorType.replace(/_/g, ' ')} · {m.authorEmail}
                      <span className="ml-2 font-normal">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-800">{m.body}</div>
                  </div>
                ))}
              </div>
              {selected.status !== 'CLOSED' && (
                <div className="flex shrink-0 gap-2 border-t border-slate-100 p-3">
                  <input
                    className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500"
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
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                    onClick={() => void sendReply()}
                  >
                    <Send size={15} /> Reply
                  </button>
                  {selected.status === ('RESOLVED' as SupportTicketStatus) && (
                    <button
                      type="button"
                      className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold"
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
              <div className="mx-auto flex max-w-2xl flex-col px-5 py-5 md:px-8 md:py-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-full max-w-[160px]">
                    <SupportLottie
                      src="/lottie/customer-support.json"
                      autoplay
                      loop
                      style={{ width: '100%', height: 'auto' }}
                    />
                  </div>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                    How can we help?
                  </h2>
                  <p className="mt-1 text-[13px] text-slate-500">
                    Pick live chat or open a ticket — we&apos;re here for you.
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={beginLiveChat}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:shadow-sm"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                      <MessageCircle size={18} />
                    </div>
                    <div className="mt-2.5 text-sm font-bold text-slate-900">Live Chat</div>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                      Talk to a Hexalyte teammate in real time.
                    </p>
                    <div className="mt-2 text-[11px] font-semibold text-emerald-600">
                      {onlineCount > 0 ? `${onlineCount} online now` : 'Leave a message anytime'}
                    </div>
                    <span className="mt-3 inline-flex rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white">
                      Start Live Chat
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openCreate()}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:shadow-sm"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <Ticket size={18} />
                    </div>
                    <div className="mt-2.5 text-sm font-bold text-slate-900">Support Ticket</div>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                      Billing, bugs, account — tracked with SLA.
                    </p>
                    <span className="mt-8 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
                      <Plus size={13} /> Create Ticket
                    </span>
                  </button>
                </div>

                <div className="mt-6">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Common topics
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {TOPICS.map((topic) => {
                      const Icon = topic.icon
                      return (
                        <button
                          key={topic.key}
                          type="button"
                          onClick={() => openCreate(topic.key)}
                          className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-2.5 py-2 text-left transition hover:border-sky-300 hover:bg-sky-50/60"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-sky-600">
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-semibold text-slate-800">{topic.title}</div>
                            <div className="truncate text-[10px] text-slate-500">{topic.blurb}</div>
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
            className={`min-h-0 flex-col overflow-hidden bg-white lg:rounded-xl lg:border lg:border-slate-200 ${
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
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">Pick a teammate</div>
                    <div className="text-[11px] text-slate-500">
                      {onlineCount > 0 ? `${onlineCount} online` : 'Team offline — leave a message'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                    onClick={closeChat}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
                  {agents.length === 0 && (
                    <p className="py-10 text-center text-sm text-slate-400">No agents available yet.</p>
                  )}
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => startWithAgent(agent)}
                      className="flex w-full items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-left transition hover:border-sky-300 hover:bg-sky-50/70"
                    >
                      <div className="relative shrink-0">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${
                            agent.isOnline ? 'bg-sky-600' : 'bg-slate-400'
                          }`}
                        >
                          {initials(agent.name)}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                            agent.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-slate-900">{agent.name}</div>
                        <div className="truncate text-[10px] text-slate-500">{agent.title}</div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                          agent.isOnline
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
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
            className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <div className="text-base font-bold text-slate-900">New support ticket</div>
                <div className="text-[12px] text-slate-500">Hexalyte will respond by SLA priority</div>
              </div>
              <button type="button" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-500"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm"
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
                  className="h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm"
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
                className="min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
                placeholder="Describe the issue…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
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
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading support…</div>}>
      <SupportPageInner />
    </Suspense>
  )
}
