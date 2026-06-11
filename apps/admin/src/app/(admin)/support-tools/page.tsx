'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LogIn, Search, Trash2, RefreshCw, MessageSquare, Plus,
  AlertTriangle, Clock, Loader2, ExternalLink, Copy, CheckCheck,
  ShieldCheck, Package, Users, Wrench, ShoppingCart, Activity,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  fetchTenants, fetchSupportNotes, createSupportNote, deleteSupportNote,
  impersonateTenant, fetchTenantDebug, resetLoginRateLimit,
  type TenantRow, type SupportNote, type TenantDebug,
} from '@/lib/api'

const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_URL || 'https://app.hexalyte.com'

function fmtDT(s: string) {
  return new Date(s).toLocaleString('en-LK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TABS = ['Impersonation', 'Login Limits', 'Debug Tools', 'Support Notes']

/* ── Tenant picker ─────────────────────────────────────────────────────────── */
function TenantPicker({
  tenants, selectedId, onSelect, filter = () => true,
}: {
  tenants: TenantRow[]; selectedId: string | null
  onSelect: (id: string) => void; filter?: (t: TenantRow) => boolean
}) {
  const [search, setSearch] = useState('')
  const filtered = tenants.filter(t =>
    filter(t) &&
    (t.name.toLowerCase().includes(search.toLowerCase()) ||
     t.ownerEmail.toLowerCase().includes(search.toLowerCase()))
  )
  return (
    <div className="card p-5">
      <h3 className="section-title mb-3">Select Tenant</h3>
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
        <Search size={13} className="text-gray-400" />
        <input className="bg-transparent text-sm outline-none flex-1 placeholder-gray-400"
          placeholder="Search tenant…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
        {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-6">No tenants found</p>}
        {filtered.map(t => (
          <button key={t.id} onClick={() => onSelect(t.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${selectedId === t.id ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${selectedId === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {t.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold truncate ${selectedId === t.id ? 'text-white' : 'text-gray-800'}`}>{t.name}</p>
              <p className={`text-[10px] truncate ${selectedId === t.id ? 'text-white/70' : 'text-gray-400'}`}>{t.ownerEmail}</p>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${t.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : t.status === 'TRIAL' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'} ${selectedId === t.id ? 'opacity-80' : ''}`}>
              {t.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Impersonation tab ─────────────────────────────────────────────────────── */
function ImpersonationTab({ tenants }: { tenants: TenantRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirm, setConfirm]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [copied, setCopied]         = useState(false)
  const [loginUrl, setLoginUrl]     = useState<string | null>(null)

  const selectedTenant = tenants.find(t => t.id === selectedId)

  const handleImpersonate = async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      const res = await impersonateTenant(selectedId)
      const url = `${WEB_APP_URL}/impersonate?token=${encodeURIComponent(res.token)}`
      setLoginUrl(url)
      setConfirm(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    if (!loginUrl) return
    navigator.clipboard.writeText(loginUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <TenantPicker tenants={tenants} selectedId={selectedId} onSelect={id => { setSelectedId(id); setLoginUrl(null) }}
        filter={t => t.status === 'ACTIVE' || t.status === 'TRIAL'} />

      <div className="space-y-4">
        {loginUrl ? (
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              <h3 className="section-title">Session Ready</h3>
            </div>
            <p className="text-xs text-gray-500">A 1-hour impersonation token has been generated for <strong>{selectedTenant?.name}</strong>.</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[10px] text-gray-500 break-all">{loginUrl}</div>
            <div className="flex gap-2">
              <button onClick={copyLink} className="btn-secondary flex-1 justify-center text-xs">
                {copied ? <CheckCheck size={13} className="text-emerald-600" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
              <a href={loginUrl} target="_blank" rel="noreferrer" className="btn-primary flex-1 justify-center text-xs">
                <ExternalLink size={13} />Open in Tab
              </a>
            </div>
            <button onClick={() => setLoginUrl(null)} className="text-xs text-gray-400 underline w-full text-center">Reset</button>
          </div>
        ) : selectedTenant ? (
          <div className="card p-5">
            <h3 className="section-title mb-4">Session Details</h3>
            <dl className="space-y-2 text-sm mb-5">
              {[
                ['Tenant', selectedTenant.name],
                ['Owner', selectedTenant.ownerName],
                ['Plan', selectedTenant.plan],
                ['Status', selectedTenant.status],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-medium text-gray-800">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between">
                <dt className="text-gray-500">Session Limit</dt>
                <dd className="flex items-center gap-1 font-medium text-amber-600"><Clock size={12} />1 hour</dd>
              </div>
            </dl>
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">This action is audit-logged. Session token expires in 1 hour.</p>
            </div>
            <button onClick={() => setConfirm(true)} disabled={loading} className="btn-primary w-full justify-center">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              Generate Impersonation Link
            </button>
          </div>
        ) : (
          <div className="card p-12 text-center">
            <LogIn size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Select an active tenant to begin</p>
          </div>
        )}
      </div>

      {confirm && selectedTenant && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Generate Impersonation Link?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This creates a token that logs into <strong>{selectedTenant.name}</strong> as <strong>{selectedTenant.ownerName}</strong>. The link is valid for 1 hour.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleImpersonate} disabled={loading} className="btn-primary">
                {loading && <Loader2 size={13} className="animate-spin" />}Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Debug Tools tab ───────────────────────────────────────────────────────── */
function DebugToolsTab({ tenants }: { tenants: TenantRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [debug, setDebug]           = useState<TenantDebug | null>(null)
  const [loading, setLoading]       = useState(false)
  const [expanded, setExpanded]     = useState<'claims' | 'pos' | null>(null)

  useEffect(() => {
    if (!selectedId) { setDebug(null); return }
    setLoading(true)
    fetchTenantDebug(selectedId)
      .then(setDebug)
      .catch(() => setDebug(null))
      .finally(() => setLoading(false))
  }, [selectedId])

  const stats = debug?.counts
  const statRows = stats ? [
    { icon: Package,      label: 'Products',  val: stats.products  },
    { icon: Users,        label: 'Customers', val: stats.customers },
    { icon: ShoppingCart, label: 'Sales',     val: stats.sales     },
    { icon: Wrench,       label: 'Repairs',   val: stats.repairs   },
    { icon: Users,        label: 'Users',     val: stats.users     },
  ] : []

  return (
    <div className="grid md:grid-cols-2 gap-4 items-start">
      <TenantPicker tenants={tenants} selectedId={selectedId} onSelect={id => setSelectedId(id)} />

      <div>
        {loading && (
          <div className="card p-10 text-center"><Loader2 size={22} className="animate-spin text-gray-400 mx-auto" /></div>
        )}
        {!loading && !debug && (
          <div className="card p-12 text-center">
            <Activity size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Select a tenant to view debug stats</p>
          </div>
        )}
        {!loading && debug && (
          <div className="space-y-3">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{debug.tenant.name}</p>
                  <p className="text-[10px] text-gray-400">{debug.tenant.plan} · Created {fmtDate(debug.tenant.createdAt)}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${debug.tenant.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {debug.tenant.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {statRows.map(({ icon: Icon, label, val }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                    <Icon size={13} className="text-gray-400 mx-auto mb-1" />
                    <p className="text-sm font-bold text-gray-900">{val.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
              {debug.lastActivity && (
                <p className="text-[10px] text-gray-400 mt-3 text-center">Last sale activity: {fmtDT(debug.lastActivity)}</p>
              )}
            </div>

            {debug.recentWarrantyClaims.length > 0 && (
              <div className="card p-4">
                <button onClick={() => setExpanded(expanded === 'claims' ? null : 'claims')}
                  className="flex items-center justify-between w-full mb-2">
                  <p className="text-xs font-semibold text-gray-700">Recent Warranty Claims ({debug.recentWarrantyClaims.length})</p>
                  {expanded === 'claims' ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </button>
                {expanded === 'claims' && (
                  <div className="space-y-1.5">
                    {debug.recentWarrantyClaims.map((c, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 text-xs">
                        <p className="text-gray-600 truncate flex-1">{c.issue}</p>
                        <span className="badge-gray text-[10px] flex-shrink-0">{c.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {debug.recentPurchaseOrders.length > 0 && (
              <div className="card p-4">
                <button onClick={() => setExpanded(expanded === 'pos' ? null : 'pos')}
                  className="flex items-center justify-between w-full mb-2">
                  <p className="text-xs font-semibold text-gray-700">Recent Purchase Orders ({debug.recentPurchaseOrders.length})</p>
                  {expanded === 'pos' ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </button>
                {expanded === 'pos' && (
                  <div className="space-y-1.5">
                    {debug.recentPurchaseOrders.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <p className="text-gray-600">{p.poNumber}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Rs.{Number(p.total ?? 0).toLocaleString()}</span>
                          <span className="badge-gray text-[10px]">{p.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={() => { setDebug(null); setSelectedId(selectedId) }}
              className="btn-secondary w-full justify-center text-xs">
              <RefreshCw size={12} />Refresh Stats
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Support Notes tab ─────────────────────────────────────────────────────── */
function SupportNotesTab({ tenants }: { tenants: TenantRow[] }) {
  const [notes, setNotes]       = useState<SupportNote[]>([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [saving, setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm]         = useState({ tenantId: '', note: '', ticketRef: '' })
  const [filterTenant, setFilterTenant] = useState('')

  const reload = useCallback(() => {
    setLoadingNotes(true)
    fetchSupportNotes(filterTenant || undefined)
      .then(setNotes).catch(() => setNotes([]))
      .finally(() => setLoadingNotes(false))
  }, [filterTenant])

  useEffect(() => { reload() }, [reload])

  const handleAdd = async () => {
    if (!form.tenantId || !form.note.trim()) return
    setSaving(true)
    try {
      const n = await createSupportNote({
        tenantId: form.tenantId, note: form.note.trim(),
        adminName: 'Support Admin', ticketRef: form.ticketRef.trim() || undefined,
      })
      setNotes(prev => [n, ...prev])
      setForm({ tenantId: '', note: '', ticketRef: '' })
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note?')) return
    setDeletingId(id)
    try {
      await deleteSupportNote(id)
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch { /* ignore */ } finally { setDeletingId(null) }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="section-title mb-3">Add Internal Note</h3>
        <div className="space-y-3">
          <select className="input text-sm" value={form.tenantId}
            onChange={e => setForm({ ...form, tenantId: e.target.value })}>
            <option value="">Select tenant…</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <textarea className="input resize-none text-sm" rows={3} placeholder="Internal support note…"
            value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          <div className="flex gap-2">
            <input className="input flex-1 text-sm" placeholder="Ticket ref (e.g. TKT-1234)"
              value={form.ticketRef} onChange={e => setForm({ ...form, ticketRef: e.target.value })} />
            <button onClick={handleAdd} disabled={!form.tenantId || !form.note || saving}
              className="btn-primary disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Add
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select className="input text-sm max-w-xs" value={filterTenant}
          onChange={e => setFilterTenant(e.target.value)}>
          <option value="">All tenants</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={reload} className="btn-secondary text-xs">
          <RefreshCw size={12} />Refresh
        </button>
      </div>

      {loadingNotes ? (
        <div className="card p-10 text-center"><Loader2 size={20} className="animate-spin text-gray-400 mx-auto" /></div>
      ) : notes.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageSquare size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No support notes yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge-gray text-[10px]">{n.tenant?.name ?? n.tenantId}</span>
                  {n.ticketRef && <span className="badge-blue text-[10px]">{n.ticketRef}</span>}
                  <span className="text-xs font-medium text-gray-700">{n.adminName}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-gray-400">{fmtDT(n.createdAt)}</span>
                  <button onClick={() => handleDelete(n.id)} disabled={deletingId === n.id}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                    {deletingId === n.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600">{n.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Login rate limit reset ─────────────────────────────────────────────────── */
function LoginLimitsTab({ tenants }: { tenants: TenantRow[] }) {
  const [email, setEmail] = useState('')
  const [ip, setIp] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const pickOwnerEmail = (tenantId: string) => {
    const t = tenants.find(x => x.id === tenantId)
    if (t?.ownerEmail) setEmail(t.ownerEmail)
  }

  const handleReset = async (resetAll = false) => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await resetLoginRateLimit(
        resetAll
          ? { resetAll: true }
          : { email: email.trim(), ip: ip.trim() || undefined },
      )
      if (res.scope === 'all') {
        setMessage({ type: 'ok', text: 'All login rate limits cleared. Users can sign in again.' })
      } else {
        setMessage({
          type: 'ok',
          text: `Rate limit cleared for ${res.email}. ${res.keysCleared ?? 0} block(s) removed — user can try login now.`,
        })
      }
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Reset failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <TenantPicker tenants={tenants} selectedId={null} onSelect={pickOwnerEmail} />

      <div className="card p-5 space-y-4">
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="section-title">Clear login rate limit</h3>
            <p className="text-xs text-gray-500 mt-1">
              When users see &quot;Too many login attempts&quot;, clear their block here so they can sign in without waiting 15 minutes.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">User email</label>
          <input
            className="input w-full text-sm"
            type="email"
            placeholder="owner@shop.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">IP address (optional)</label>
          <input
            className="input w-full text-sm"
            placeholder="Leave empty to clear all IPs for this email"
            value={ip}
            onChange={e => setIp(e.target.value)}
          />
        </div>

        {message && (
          <div className={`text-sm px-3 py-2 rounded-lg border ${
            message.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={loading || !email.trim()}
            onClick={() => handleReset(false)}
            className="btn-primary flex-1 justify-center text-sm"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Clear for this email
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (!confirm('Clear ALL login rate limits for every user?')) return
              handleReset(true)
            }}
            className="btn-secondary flex-1 justify-center text-sm"
          >
            Clear all limits
          </button>
        </div>

        <p className="text-[10px] text-gray-400">
          Action is logged in Activity Logs as <code className="text-gray-500">RATE_LIMIT_RESET</code>.
        </p>
      </div>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */
export default function SupportToolsPage() {
  const [tab, setTab]         = useState('Impersonation')
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loadingT, setLoadingT] = useState(true)

  useEffect(() => {
    fetchTenants({ limit: '500' } as any)
      .then((d: any) => setTenants(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingT(false))
  }, [])

  return (
    <div className="space-y-5">
      <div className="page-header">
        <h1 className="page-title">Support Tools</h1>
        <p className="text-sm text-gray-500 mt-0.5">Impersonation, debug stats, and internal notes</p>
      </div>

      <div className="flex border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {loadingT ? (
        <div className="card p-12 text-center"><Loader2 size={22} className="animate-spin text-gray-400 mx-auto" /></div>
      ) : (
        <>
          {tab === 'Impersonation' && <ImpersonationTab tenants={tenants} />}
          {tab === 'Login Limits'  && <LoginLimitsTab tenants={tenants} />}
          {tab === 'Debug Tools'   && <DebugToolsTab tenants={tenants} />}
          {tab === 'Support Notes' && <SupportNotesTab tenants={tenants} />}
        </>
      )}
    </div>
  )
}
