'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { authStorage } from '@/lib/auth'
import {
  getApiBaseUrl,
  supportChatApi,
  type SupportAgent,
  type SupportChatSession,
} from '@/lib/api'

const Lottie = dynamic(() => import('lottie-react').then((mod) => mod.Lottie), { ssr: false })

type ChatMsg = NonNullable<SupportChatSession['messages']>[number]

type Props = {
  /** Full-height panel for Support page (no floating chrome) */
  embedded?: boolean
  className?: string
  /** Parent can request starting a chat with this agent email */
  requestAgentEmail?: string | null
  onRequestHandled?: () => void
  onAgentsChange?: (agents: SupportAgent[]) => void
  /** When true, idle state is a short prompt (team shown elsewhere) */
  teamPickerCompact?: boolean
  /** Optional close control for popup mode */
  onClose?: () => void
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

export function SupportLiveChatPanel({
  embedded = false,
  className = '',
  requestAgentEmail = null,
  onRequestHandled,
  onAgentsChange,
  teamPickerCompact = false,
  onClose,
}: Props) {
  void embedded
  const [agents, setAgents] = useState<SupportAgent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<SupportAgent | null>(null)
  const [session, setSession] = useState<SupportChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)
  const startChatRef = useRef<(agent: SupportAgent) => Promise<void>>(async () => undefined)

  const scrollBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  const loadAgents = useCallback(async () => {
    try {
      const res = await supportChatApi.agents()
      const rows = (res as { data: SupportAgent[] }).data
      const list = Array.isArray(rows) ? rows : []
      setAgents(list)
      onAgentsChange?.(list)
    } catch {
      setAgents([])
      onAgentsChange?.([])
    } finally {
      setAgentsLoading(false)
    }
  }, [onAgentsChange])

  useEffect(() => {
    void loadAgents()
    const t = setInterval(() => void loadAgents(), 15000)
    return () => clearInterval(t)
  }, [loadAgents])

  const connectStream = useCallback((sessionId: string) => {
    esRef.current?.close()
    const token = authStorage.getAccessToken()
    if (!token) return
    const url = `${getApiBaseUrl()}/support-chat/sessions/${sessionId}/stream?access_token=${encodeURIComponent(token)}`
    try {
      const es = new EventSource(url)
      es.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse(ev.data) as ChatMsg
          setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))
          scrollBottom()
        } catch {
          /* ignore */
        }
      })
      es.addEventListener('session', () => {
        void supportChatApi.get(sessionId).then((res) => {
          const s = (res as { data: SupportChatSession }).data
          setSession(s)
          setMessages(s.messages ?? [])
        })
      })
      esRef.current = es
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => () => esRef.current?.close(), [])

  useEffect(() => {
    void supportChatApi
      .mine()
      .then((res) => {
        const rows = (res as { data: SupportChatSession[] }).data
        const open = (Array.isArray(rows) ? rows : []).find(
          (s) => s.status === 'WAITING' || s.status === 'ACTIVE',
        )
        if (!open) return
        void supportChatApi.get(open.id).then((r) => {
          const s = (r as { data: SupportChatSession }).data
          setSession(s)
          setMessages(s.messages ?? [])
          connectStream(s.id)
          if (s.assigneeAdminEmail) {
            setSelectedAgent(
              (prev) => prev ?? agents.find((a) => a.email === s.assigneeAdminEmail) ?? null,
            )
          }
        })
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startChat = async (agent: SupportAgent) => {
    setBusy(true)
    setSelectedAgent(agent)
    try {
      const res = await supportChatApi.start({
        subject: 'Live support',
        preferredAgentEmail: agent.email,
      })
      const s = (res as { data: SupportChatSession }).data
      setSession(s)
      setMessages(s.messages ?? [])
      connectStream(s.id)
      scrollBottom()
    } catch (e: any) {
      toast.error(e?.message || 'Could not start chat')
      setSelectedAgent(null)
    } finally {
      setBusy(false)
    }
  }
  startChatRef.current = startChat

  useEffect(() => {
    if (!requestAgentEmail || busy) return
    const agent = agents.find(
      (a) => a.email.toLowerCase() === requestAgentEmail.toLowerCase(),
    )
    if (!agent) return
    const open = session && session.status !== 'ENDED'
    if (open) {
      onRequestHandled?.()
      return
    }
    void startChatRef.current(agent).finally(() => onRequestHandled?.())
  }, [requestAgentEmail, agents, busy, session, onRequestHandled])

  useEffect(() => {
    if (!session || session.status === 'ENDED') return
    const t = setInterval(() => {
      void supportChatApi.get(session.id).then((res) => {
        const s = (res as { data: SupportChatSession }).data
        setSession(s)
        setMessages(s.messages ?? [])
      })
    }, 4000)
    return () => clearInterval(t)
  }, [session?.id, session?.status])

  const send = async () => {
    if (!session || !text.trim()) return
    const body = text.trim()
    setText('')
    try {
      const res = await supportChatApi.send(session.id, body)
      const msg = (res as { data: ChatMsg }).data
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      scrollBottom()
    } catch (e: any) {
      toast.error(e?.message || 'Send failed')
      setText(body)
    }
  }

  const end = async () => {
    if (!session) return
    try {
      const res = await supportChatApi.end(session.id)
      setSession((res as { data: SupportChatSession }).data)
      toast.success('Chat ended')
    } catch (e: any) {
      toast.error(e?.message || 'Could not end chat')
    }
  }

  const resetToTeam = () => {
    esRef.current?.close()
    setSession(null)
    setMessages([])
    setSelectedAgent(null)
    void loadAgents()
  }

  const inChat = Boolean(session && session.status !== 'ENDED')
  const showTeamPicker = !inChat
  const onlineCount = agents.filter((a) => a.isOnline).length

  const statusLabel =
    session?.status === 'WAITING'
      ? selectedAgent
        ? `Waiting for ${selectedAgent.name}…`
        : 'Waiting for agent…'
      : session?.status === 'ACTIVE'
        ? `Connected · ${session.assigneeAdminEmail || 'agent'}`
        : session?.status === 'ENDED'
          ? 'Chat ended'
          : teamPickerCompact
            ? 'Pick a teammate to start'
            : 'Pick a support teammate'

  return (
    <div
      className={`support-chat-panel flex flex-col overflow-hidden ${className}`}
      style={{
        borderColor: 'var(--border-subtle)',
        background:
          'linear-gradient(180deg, rgba(14,165,233,0.06) 0%, var(--bg-elevated, var(--bg-card, #fff)) 28%)',
      }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live Chat
          </div>
          <div className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {statusLabel}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {inChat && (
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              onClick={() => void end()}
            >
              End
            </button>
          )}
          {session?.status === 'ENDED' && (
            <button
              type="button"
              className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-500"
              onClick={resetToTeam}
            >
              New chat
            </button>
          )}
          {onClose && (
            <button
              type="button"
              aria-label="Close live chat"
              className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"
              style={{ color: 'var(--text-muted)' }}
              onClick={onClose}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {showTeamPicker ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {teamPickerCompact ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
              <div className="h-24 w-24">
                <Lottie
                  src="/lottie/customer-support.json"
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {onlineCount > 0
                  ? `${onlineCount} agent${onlineCount === 1 ? '' : 's'} online`
                  : 'Team offline'}
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Select a support teammate in the center to start chatting.
              </p>
              {busy && (
                <div className="inline-flex items-center gap-2 text-xs text-sky-600">
                  <Loader2 className="animate-spin" size={14} />
                  Connecting…
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="relative flex flex-col items-center px-4 pb-2 pt-4">
                <div className="h-28 w-28 animate-[scFadeIn_0.5s_ease]">
                  <Lottie
                    src="/lottie/customer-support.json"
                    loop
                    autoplay
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
                <p className="text-center text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Hexalyte Support Team
                </p>
                <p className="mt-0.5 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {onlineCount > 0
                    ? `${onlineCount} online now — pick who you want to talk to`
                    : 'Team is offline — you can still leave a message'}
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
                {agentsLoading && (
                  <div className="flex justify-center py-10" style={{ color: 'var(--text-muted)' }}>
                    <Loader2 className="animate-spin" size={20} />
                  </div>
                )}
                {!agentsLoading && agents.length === 0 && (
                  <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No support agents available yet.
                  </p>
                )}
                {agents.map((agent, i) => (
                  <button
                    key={agent.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void startChat(agent)}
                    className="group flex w-full animate-[scSlideUp_0.35s_ease_both] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:border-sky-400 hover:bg-sky-50/80 disabled:opacity-60 dark:hover:bg-sky-950/30"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      animationDelay: `${i * 40}ms`,
                    }}
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
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                          agent.isOnline ? 'bg-emerald-500 sc-pulse-online' : 'bg-slate-400'
                        }`}
                        title={agent.isOnline ? 'Online' : 'Offline'}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {agent.name}
                      </div>
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
                {busy && (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs text-sky-600">
                    <Loader2 className="animate-spin" size={14} />
                    Starting chat…
                  </div>
                )}
              </div>
            </>
          )}
          <style>{`
            @keyframes scFadeIn {
              from { opacity: 0; transform: scale(0.96); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes scSlideUp {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes scPulse {
              0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55); }
              70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
              100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
            }
            .sc-pulse-online {
              box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55);
              animation: scPulse 1.6s ease-out infinite;
            }
          `}</style>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {busy && !messages.length && (
              <div className="flex justify-center py-10" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="animate-spin" size={20} />
              </div>
            )}
            {messages.map((m) => {
              const mine = m.authorType === 'TENANT_USER'
              return (
                <div
                  key={m.id}
                  className={`flex animate-[scSlideUp_0.25s_ease] ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                      mine
                        ? 'bg-sky-600 text-white'
                        : m.authorType === 'SYSTEM'
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {session?.status !== 'ENDED' && session && (
            <div className="flex gap-2 border-t p-2" style={{ borderColor: 'var(--border-subtle)' }}>
              <input
                className="h-10 flex-1 rounded-xl border bg-transparent px-3 text-sm outline-none focus:border-sky-500"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                placeholder="Type a message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void send()
                }}
              />
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white hover:bg-sky-500"
                onClick={() => void send()}
              >
                <Send size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Floating Live Chat popup — available anywhere in the dashboard */
export function SupportLiveChatWidget() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[45] flex flex-col items-end gap-3">
      {open && (
        <div
          className="pointer-events-auto flex h-[min(560px,78vh)] w-[min(390px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl shadow-sky-900/15 animate-[scPopIn_0.28s_ease]"
          style={{
            borderColor: 'var(--border-subtle)',
            background: 'var(--bg-elevated, #fff)',
          }}
          role="dialog"
          aria-label="Live chat"
        >
          <SupportLiveChatPanel
            embedded
            className="h-full w-full"
            onClose={() => setOpen(false)}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`pointer-events-auto group inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98] ${
          open
            ? 'bg-slate-700 hover:bg-slate-600 shadow-slate-900/20'
            : 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/30'
        }`}
        aria-expanded={open}
        aria-label={open ? 'Close live chat' : 'Open live chat'}
      >
        {open ? (
          <>
            <X size={18} />
            Close
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <MessageCircle size={18} />
            Live Chat
          </>
        )}
      </button>

      <style>{`
        @keyframes scPopIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
