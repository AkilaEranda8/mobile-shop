'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { authStorage } from '@/lib/auth'
import { getApiBaseUrl, supportChatApi, type SupportChatSession } from '@/lib/api'

type ChatMsg = NonNullable<SupportChatSession['messages']>[number]

export function SupportLiveChatWidget() {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<SupportChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  const scrollBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  const connectStream = useCallback((sessionId: string) => {
    esRef.current?.close()
    const token = authStorage.getAccessToken()
    if (!token) return
    // EventSource can't set Authorization; use fetch-stream polyfill via query is insecure.
    // Prefer polling fallback when EventSource auth is limited — still open SSE with token query for same-origin API.
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
      es.onerror = () => {
        /* keep open; browser retries */
      }
      esRef.current = es
    } catch {
      /* EventSource unsupported */
    }
  }, [])

  useEffect(() => () => esRef.current?.close(), [])

  const startChat = async () => {
    setBusy(true)
    try {
      const res = await supportChatApi.start({ subject: 'Live support' })
      const s = (res as { data: SupportChatSession }).data
      setSession(s)
      setMessages(s.messages ?? [])
      connectStream(s.id)
      scrollBottom()
    } catch (e: any) {
      toast.error(e?.message || 'Could not start chat')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (open && !session) void startChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Polling fallback every 4s while open
  useEffect(() => {
    if (!open || !session || session.status === 'ENDED') return
    const t = setInterval(() => {
      void supportChatApi.get(session.id).then((res) => {
        const s = (res as { data: SupportChatSession }).data
        setSession(s)
        setMessages(s.messages ?? [])
      })
    }, 4000)
    return () => clearInterval(t)
  }, [open, session?.id, session?.status])

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

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-500"
        >
          <MessageCircle size={18} />
          Live Chat
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex h-[min(520px,70vh)] w-[min(380px,92vw)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
            <div>
              <div className="text-sm font-bold">Hexalyte Support</div>
              <div className="text-[11px] text-slate-500">
                {session?.status === 'WAITING'
                  ? 'Waiting for agent…'
                  : session?.status === 'ACTIVE'
                    ? `Agent: ${session.assigneeAdminEmail || 'connected'}`
                    : session?.status === 'ENDED'
                      ? 'Ended'
                      : 'Connecting…'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {session && session.status !== 'ENDED' && (
                <button type="button" className="rounded-md px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50" onClick={() => void end()}>
                  End
                </button>
              )}
              <button type="button" className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {busy && !messages.length && (
              <div className="flex justify-center py-8 text-slate-400">
                <Loader2 className="animate-spin" size={20} />
              </div>
            )}
            {messages.map((m) => {
              const mine = m.authorType === 'TENANT_USER'
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                      mine
                        ? 'bg-blue-600 text-white'
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
          {session?.status !== 'ENDED' && (
            <div className="flex gap-2 border-t border-slate-200 p-2 dark:border-slate-700">
              <input
                className="h-10 flex-1 rounded-xl border border-slate-200 bg-transparent px-3 text-sm outline-none focus:border-blue-500 dark:border-slate-600"
                placeholder="Type a message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void send()
                }}
              />
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500"
                onClick={() => void send()}
              >
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
