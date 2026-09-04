'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Loader2, LifeBuoy, Plus, Send, Ticket, X, AlertCircle, MessageCircle,
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

  const closeChat = () => {
    setChatActive(false)
    setPickingTeam(false)
    setRequestAgentEmail(null)
  }

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
        background: '#f3f5f8',
        color: 'var(--text-primary)',
      }}
    >
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-3.5 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white shadow-md shadow-sky-500/25">
            <LifeBuoy size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 md:text-xl">
              Support Center
            </h1>
            <p className="truncate text-[12px] text-slate-500">
              Get help from the Hexalyte support team — tickets & live chat.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium ${
              teamOnline
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${teamOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}
            />
            {teamOnline
              ? 'Support team online · Usually replies in a few minutes'
              : 'Support team offline · Leave a message anytime'}
          </div>
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
          >
            <Plus size={16} /> New Ticket
          </button>
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="flex shrink-0 border-b border-slate-200 bg-white lg:hidden">
        {(
          [
            ['tickets', 'Tickets'],
            ['hub', 'Help'],
            ['chat', 'Live Chat'],
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

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(300px,360px)] lg:gap-3 lg:p-3">
        {/* LEFT — tickets */}
        <aside
          className={`min-h-0 flex-col border-r border-slate-200 bg-white lg:rounded-2xl lg:border ${
            mobilePane === 'tickets' ? 'flex' : 'hidden'
          } lg:flex`}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
              <Ticket size={15} className="text-sky-500" /> Your Tickets
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              {items.length}
            </span>
          </div>

          <div className="flex gap-1 overflow-x-auto px-3 pb-2">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setTicketFilter(f.key)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  ticketFilter === f.key
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
                {f.key === 'ALL' ? ` (${filterCounts.ALL})` : ''}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
            {loading && (
              <div className="flex justify-center py-10 text-slate-400">
                <Loader2 className="animate-spin" size={20} />
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <p className="px-2 py-8 text-center text-sm text-slate-400">No tickets in this filter.</p>
            )}
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => void openTicket(t.id)}
                className={`block w-full rounded-xl border px-3 py-3 text-left transition hover:border-sky-300 ${
                  selected?.id === t.id
                    ? 'border-sky-400 bg-sky-50/80'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-slate-400">{t.ticketNumber}</span>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${statusTone(t.status)}`}
                  >
                    {t.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-slate-900">{t.subject}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                  <span>
                    {t.priority} · {t.category}
                  </span>
                  <span>·</span>
                  <span>Updated {timeAgo(t.createdAt)}</span>
                  {t.slaBreached && (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600">
                      <AlertCircle size={10} /> SLA
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="m-3 mt-0 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-[12px] text-sky-800">
            <div className="font-semibold">Need immediate help?</div>
            <button type="button" className="mt-0.5 text-sky-600 underline-offset-2 hover:underline" onClick={beginLiveChat}>
              Try Live Chat →
            </button>
          </div>
        </aside>

        {/* CENTER — hub / ticket detail */}
        <section
          className={`min-h-0 flex-col overflow-hidden bg-white lg:rounded-2xl lg:border lg:border-slate-200 ${
            mobilePane === 'hub' ? 'flex' : 'hidden'
          } lg:flex`}
        >
          {selected ? (
            <>
              <div className="shrink-0 border-b border-slate-200 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-slate-400">{selected.ticketNumber}</div>
                    <h2 className="mt-0.5 text-lg font-bold text-slate-900">{selected.subject}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className={`rounded-md border px-1.5 py-0.5 font-bold uppercase ${statusTone(selected.status)}`}>
                        {selected.status.replace(/_/g, ' ')}
                      </span>
                      <span>
                        {selected.priority} · {selected.category}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
                    onClick={() => setSelected(null)}
                  >
                    Back
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {(selected.messages ?? []).map((m) => (
                  <div key={m.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {m.authorType.replace(/_/g, ' ')} · {m.authorEmail}
                      <span className="ml-2 font-normal">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-800">{m.body}</div>
                  </div>
                ))}
              </div>
              {selected.status !== 'CLOSED' && (
                <div className="flex shrink-0 gap-2 border-t border-slate-200 p-3">
                  <input
                    className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500"
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
                  {selected.status === ('RESOLVED' as SupportTicketStatus) && (
                    <button
                      type="button"
                      className="h-11 rounded-xl border border-slate-200 px-3 text-xs font-semibold"
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
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-8">
              <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
                <div className="w-full max-w-[240px]">
                  <SupportLottie
                    src="/lottie/customer-support.json"
                    autoplay
                    loop
                    style={{ width: '100%', height: 'auto' }}
                  />
                </div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                  How can we help?
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">Get help from the Hexalyte Support Team.</p>

                <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                      <MessageCircle size={20} />
                    </div>
                    <div className="mt-3 text-base font-bold text-slate-900">Live Chat</div>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                      Chat with Hexalyte support in real time. Pick a teammate who is available.
                    </p>
                    <div className="mt-3 text-[12px] font-medium text-emerald-600">
                      {onlineCount > 0
                        ? `${onlineCount} support agent${onlineCount === 1 ? '' : 's'} online`
                        : 'Team offline — you can still leave a message'}
                    </div>
                    <button
                      type="button"
                      onClick={beginLiveChat}
                      className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
                    >
                      Start Live Chat
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                      <Ticket size={20} />
                    </div>
                    <div className="mt-3 text-base font-bold text-slate-900">Support Ticket</div>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                      For billing, bugs, account issues, or anything that needs a tracked reply.
                    </p>
                    <button
                      type="button"
                      onClick={() => openCreate()}
                      className="mt-8 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
                    >
                      <Plus size={16} /> Create Ticket
                    </button>
                  </div>
                </div>

                <div className="mt-8 w-full text-left">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
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
                          className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-800">{topic.title}</div>
                            <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{topic.blurb}</div>
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

        {/* RIGHT — live chat */}
        <aside
          className={`min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-white lg:rounded-2xl lg:border ${
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
          ) : pickingTeam ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">Pick a teammate</div>
                  <div className="text-[11px] text-slate-500">
                    {onlineCount > 0 ? `${onlineCount} online now` : 'Team offline'}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                  onClick={closeChat}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {agents.length === 0 && (
                  <p className="py-10 text-center text-sm text-slate-400">No support agents available.</p>
                )}
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => startWithAgent(agent)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition hover:border-sky-400 hover:bg-sky-50/80"
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${
                          agent.isOnline ? 'bg-sky-600' : 'bg-slate-400'
                        }`}
                      >
                        {initials(agent.name)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                          agent.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{agent.name}</div>
                      <div className="truncate text-[11px] text-slate-500">{agent.title}</div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
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
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                    <LifeBuoy size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Hexalyte Support</div>
                    <div className="text-[11px] text-slate-500">
                      Support team · {onlineCount} online
                    </div>
                  </div>
                </div>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${teamOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}
                />
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="h-28 w-28">
                  <SupportLottie
                    src="/lottie/customer-support.json"
                    autoplay
                    loop
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
                <p className="text-sm font-semibold text-slate-800">Ready when you are</p>
                <p className="text-[12px] leading-relaxed text-slate-500">
                  Start Live Chat from the center, then pick a teammate to open the conversation here.
                </p>
                <button
                  type="button"
                  onClick={beginLiveChat}
                  className="mt-1 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                >
                  Start Live Chat
                </button>
              </div>
            </div>
          )}
        </aside>
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
