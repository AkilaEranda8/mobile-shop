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
      const goingOnline = !me?.isOnline
      const next = await supportChatAdminApi.setPresence({
        isOnline: goingOnline,
        // Going online also puts you on the tenant-visible team
        ...(goingOnline ? { visibleOnTeam: true } : {}),
      })
      setMe(next)
      setPresenceMsg(
        next.isOnline
          ? 'You are online and visible to tenants'
          : 'You are offline',
      )
      void loadPresence()
    } catch (e: any) {
      setPresenceMsg(e?.message || 'Could not update status')
    } finally {
      setPresenceBusy(false)
    }
  }

  const patchAgent = async (
    agent: SupportAgent,
    body: { isOnline?: boolean; visibleOnTeam?: boolean },
  ) => {
    setPresenceBusy(true)
    setPresenceMsg(null)
    try {
      const isSelf = me?.id === agent.id
      const next = isSelf
        ? await supportChatAdminApi.setPresence(body)
        : await supportChatAdminApi.updateAgent(agent.id, body)
      if (isSelf) setMe(next)
      setTeam((prev) => prev.map((a) => (a.id === next.id ? next : a)))
      setPresenceMsg('Team updated')
    } catch (e: any) {
      setPresenceMsg(e?.message || 'Could not update agent')
    } finally {
      setPresenceBusy(false)
    }
  }

  const visibleCount = team.filter((a) => a.visibleOnTeam).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Live Chat</h1>
          <p className="text-sm text-gray-500">
            Choose who appears on the tenant Support team, then set Online / Offline
          </p>
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

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Support team roster
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              Only people with <span className="font-semibold text-gray-700">Show on team</span> appear for
              tenants. {visibleCount} visible now.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {team.length === 0 && <span className="text-sm text-gray-400">No platform admins found</span>}
          {team.map((a) => {
            const isSelf = me?.id === a.id
            return (
              <div
                key={a.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  a.visibleOnTeam ? 'border-sky-200 bg-sky-50/40' : 'border-gray-100 bg-white'
                }`}
              >
                <div className="relative shrink-0">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${
                      a.isOnline ? 'bg-sky-600' : 'bg-slate-400'
                    }`}
                  >
                    {a.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase() ?? '')
                      .join('') || '?'}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                      a.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-gray-900">
                    {a.name}
                    {isSelf ? <span className="ml-1 text-[11px] font-normal text-sky-600">(you)</span> : null}
                  </div>
                  <div className="truncate text-[11px] text-gray-500">
                    {a.title} · {a.email}
                  </div>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    checked={Boolean(a.visibleOnTeam)}
                    disabled={presenceBusy}
                    onChange={(e) =>
                      void patchAgent(a, {
                        visibleOnTeam: e.target.checked,
                        ...(e.target.checked ? {} : { isOnline: false }),
                      })
                    }
                  />
                  Show on team
                </label>
                <button
                  type="button"
                  disabled={presenceBusy || !a.visibleOnTeam}
                  onClick={() => void patchAgent(a, { isOnline: !a.isOnline })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-40 ${
                    a.isOnline
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={!a.visibleOnTeam ? 'Enable Show on team first' : undefined}
                >
                  {a.isOnline ? 'Online' : 'Offline'}
                </button>
              </div>
            )
          })}
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
