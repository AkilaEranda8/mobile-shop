'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Send } from 'lucide-react'
import {
  supportChatAdminApi,
  type AdminChatSession,
  type SupportAgent,
} from '@/lib/api'

export default function AdminLiveChatPage() {
  const [sessions, setSessions] = useState<AdminChatSession[]>([])
  const [selected, setSelected] = useState<AdminChatSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [me, setMe] = useState<SupportAgent | null>(null)
  const [team, setTeam] = useState<SupportAgent[]>([])
  const [presenceBusy, setPresenceBusy] = useState(false)
  const [presenceMsg, setPresenceMsg] = useState<string | null>(null)

  const loadPresence = useCallback(async () => {
    try {
      const [mine, agents] = await Promise.all([
        supportChatAdminApi.myPresence(),
        supportChatAdminApi.agents(),
      ])
      setMe(mine)
      setTeam(Array.isArray(agents) ? agents : [])
    } catch {
      /* ignore */
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await supportChatAdminApi.list()
      setSessions(Array.isArray(rows) ? rows : [])
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    void loadPresence()
    const t = setInterval(() => {
      void load()
      void loadPresence()
    }, 5000)
    return () => clearInterval(t)
  }, [load, loadPresence])

  useEffect(() => {
    if (!me?.isOnline) return
    const beat = () => {
      void supportChatAdminApi.setPresence({ heartbeat: true }).then(setMe).catch(() => undefined)
    }
    beat()
    const t = setInterval(beat, 30000)
    return () => clearInterval(t)
  }, [me?.isOnline])

  useEffect(() => {
    if (!selected) return
    const t = setInterval(() => {
      void supportChatAdminApi.get(selected.id).then(setSelected)
    }, 3000)
    return () => clearInterval(t)
  }, [selected?.id])

  const open = async (id: string) => {
    setSelected(await supportChatAdminApi.get(id))
  }

  const toggleOnline = async () => {
    setPresenceBusy(true)
    setPresenceMsg(null)
    try {
      const next = await supportChatAdminApi.setPresence({ isOnline: !me?.isOnline })
      setMe(next)
      setPresenceMsg(next.isOnline ? 'You are online for tenants' : 'You are offline')
      void loadPresence()
    } catch (e: any) {
      setPresenceMsg(e?.message || 'Could not update status')
    } finally {
      setPresenceBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Live Chat</h1>
          <p className="text-sm text-gray-500">Claim waiting sessions and chat with tenants</p>
          {presenceMsg && <p className="mt-1 text-xs text-emerald-700">{presenceMsg}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={presenceBusy}
            onClick={() => void toggleOnline()}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white ${
              me?.isOnline ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-500 hover:bg-slate-400'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full bg-white ${me?.isOnline ? 'animate-pulse' : 'opacity-70'}`}
            />
            {presenceBusy ? '…' : me?.isOnline ? 'Online' : 'Go Online'}
          </button>
          <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => void load()}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Support team</div>
        <div className="flex flex-wrap gap-2">
          {team.length === 0 && <span className="text-sm text-gray-400">No agents yet</span>}
          {team.map((a) => (
            <div
              key={a.id}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
            >
              <span className={`h-2 w-2 rounded-full ${a.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span className="font-semibold text-gray-800">{a.name}</span>
              <span className="text-gray-400">{a.isOnline ? 'online' : 'offline'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl border bg-white">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin" />
            </div>
          )}
          {!loading && sessions.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-400">No active chats</p>
          )}
          {sessions.map((s) => {
            const forMe =
              s.assigneeAdminEmail &&
              me?.email &&
              s.assigneeAdminEmail.toLowerCase() === me.email.toLowerCase()
            return (
              <button
                key={s.id}
                type="button"
                className={`block w-full border-b px-4 py-3 text-left hover:bg-gray-50 ${
                  selected?.id === s.id ? 'bg-blue-50' : ''
                } ${forMe && s.status === 'WAITING' ? 'ring-1 ring-inset ring-amber-300' : ''}`}
                onClick={() => void open(s.id)}
              >
                <div className="flex justify-between text-xs">
                  <span
                    className={`font-bold ${s.status === 'WAITING' ? 'text-amber-600' : 'text-emerald-600'}`}
                  >
                    {s.status}
                    {forMe && s.status === 'WAITING' ? ' · for you' : ''}
                  </span>
                  <span className="text-gray-400">{new Date(s.lastMessageAt).toLocaleTimeString()}</span>
                </div>
                <div className="truncate text-sm font-semibold">{s.tenant?.name || 'Tenant'}</div>
                <div className="truncate text-[11px] text-gray-500">
                  {s.startedBy?.email}
                  {s.assigneeAdminEmail ? ` → ${s.assigneeAdminEmail}` : ''}
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-xl border bg-white">
          {!selected ? (
            <div className="flex h-[480px] items-center justify-center text-sm text-gray-400">
              Select a session
            </div>
          ) : (
            <div className="flex h-[480px] flex-col">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <div className="font-semibold">{selected.tenant?.name}</div>
                  <div className="text-xs text-gray-500">
                    {selected.status}
                    {selected.assigneeAdminEmail ? ` · ${selected.assigneeAdminEmail}` : ''}
                    {selected.ticket ? ` · ${selected.ticket.ticketNumber}` : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  {selected.status === 'WAITING' && (
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() => void supportChatAdminApi.claim(selected.id).then(setSelected)}
                    >
                      Claim
                    </button>
                  )}
                  {selected.status !== 'ENDED' && (
                    <>
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        onClick={() =>
                          void supportChatAdminApi.convert(selected.id).then(() => {
                            void open(selected.id)
                          })
                        }
                      >
                        Convert to ticket
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600"
                        onClick={() => void supportChatAdminApi.end(selected.id).then(setSelected)}
                      >
                        End
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {(selected.messages ?? []).map((m) => {
                  const mine = m.authorType === 'PLATFORM_ADMIN'
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                          mine ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <div className="mb-0.5 text-[10px] opacity-70">{m.authorEmail}</div>
                        {m.body}
                      </div>
                    </div>
                  )
                })}
              </div>
              {selected.status !== 'ENDED' && (
                <div className="flex gap-2 border-t p-3">
                  <input
                    className="h-10 flex-1 rounded-lg border px-3 text-sm"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && text.trim()) {
                        void supportChatAdminApi.send(selected.id, text.trim()).then(() => {
                          setText('')
                          void open(selected.id)
                        })
                      }
                    }}
                    placeholder="Reply to tenant…"
                  />
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white"
                    onClick={() => {
                      if (!text.trim()) return
                      void supportChatAdminApi.send(selected.id, text.trim()).then(() => {
                        setText('')
                        void open(selected.id)
                      })
                    }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
