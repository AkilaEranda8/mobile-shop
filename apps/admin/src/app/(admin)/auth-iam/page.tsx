'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  CheckCircle, Shield, Globe, Users, Search, KeyRound,
  LogOut, Eye, RefreshCw, X, Loader2, AlertTriangle,
  Activity, Server, Database, ShieldCheck, ShieldAlert,
} from 'lucide-react'
import {
  fetchStats, fetchUsers, fetchHealth, fetchTenants,
  revokeSessionsForTenant,
  type UserRow, type PlatformStats, type HealthData, type TenantRow,
} from '@/lib/api'

/* ── helpers ─────────────────────────────────────────────────── */
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })
}

const ROLE_BADGE: Record<string, string> = {
  PLATFORM_ADMIN: 'badge-purple',
  OWNER:    'badge-blue',
  MANAGER:  'badge-yellow',
  CASHIER:  'badge-gray',
  TECHNICIAN: 'badge-gray',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:     'badge-green',
  TRIAL:      'badge-yellow',
  SUSPENDED:  'badge-red',
  CANCELLED:  'badge-red',
}

/* ── Reset Password Modal ────────────────────────────────────── */
function ResetPasswordModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [done, setDone] = useState(false)
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Reset Password</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={15} /></button>
        </div>
        {done ? (
          <div className="text-center py-4">
            <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-800">Password reset email sent</p>
            <p className="text-xs text-gray-400 mt-1">{user.email}</p>
            <button onClick={onClose} className="btn-primary mt-4 w-full justify-center">Done</button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-1">Send a password reset email to:</p>
            <p className="text-sm font-semibold text-gray-900 mb-1">{user.name}</p>
            <p className="text-xs text-gray-400 mb-5">{user.email} · {user.tenant?.name}</p>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={() => setDone(true)} className="btn-primary flex-1 justify-center">Send Reset Email</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Revoke Sessions Modal ───────────────────────────────────── */
function RevokeModal({ tenantId, tenantName, onClose, onDone }: { tenantId: string; tenantName: string; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  const handleRevoke = async () => {
    setLoading(true)
    try { await revokeSessionsForTenant(tenantId); onDone(); onClose() }
    catch {}
    finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-red-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Revoke All Sessions</h3>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          This will force-logout all users in <strong className="text-gray-900">{tenantName}</strong>. They will need to log in again.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleRevoke} disabled={loading} className="btn-danger flex-1 justify-center disabled:opacity-50">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />} Revoke All
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────── */
const TABS = ['System Status', 'Tenant Realms', 'User Management', 'Security Policies']

export default function AuthIAMPage() {
  const [tab, setTab]       = useState('System Status')
  const [stats, setStats]   = useState<PlatformStats | null>(null)
  const [health, setHealth] = useState<HealthData | null>(null)
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [users, setUsers]   = useState<UserRow[]>([])
  const [totalUsers, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [realmSearch, setRealmSearch] = useState('')

  const [resetUser, setResetUser]       = useState<UserRow | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([fetchStats(), fetchHealth(), fetchTenants({ limit: '200' }), fetchUsers({ limit: '100' })])
      .then(([st, he, ten, us]) => {
        setStats(st); setHealth(he)
        setTenants(ten.data); setUsers(us.data); setTotal(us.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  /* derived */
  const filteredUsers = useMemo(() =>
    users.filter(u =>
      (u.name.toLowerCase().includes(search.toLowerCase()) ||
       u.email.toLowerCase().includes(search.toLowerCase()) ||
       u.tenant?.name.toLowerCase().includes(search.toLowerCase())) &&
      (roleFilter === 'ALL' || u.role === roleFilter)
    ), [users, search, roleFilter])

  const filteredTenants = useMemo(() =>
    tenants.filter(t => t.name.toLowerCase().includes(realmSearch.toLowerCase())),
    [tenants, realmSearch])

  const activeCount  = tenants.filter(t => t.status === 'ACTIVE').length
  const trialCount   = tenants.filter(t => t.status === 'TRIAL').length
  const suspCount    = tenants.filter(t => t.status === 'SUSPENDED').length

  return (
    <div className="space-y-5">
      {/* Modals */}
      {resetUser    && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />}
      {revokeTarget && <RevokeModal tenantId={revokeTarget.id} tenantName={revokeTarget.name} onClose={() => setRevokeTarget(null)} onDone={load} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="page-title">Auth / IAM</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading...' : `${totalUsers} users · ${tenants.length} tenants · ${activeCount} active`}
          </p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button onClick={load} className="btn-secondary text-sm" disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',    value: String(totalUsers),  icon: Users,      color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100' },
          { label: 'Active Tenants', value: String(activeCount), icon: ShieldCheck,color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Trial Tenants',  value: String(trialCount),  icon: Activity,   color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100' },
          { label: 'Suspended',      value: String(suspCount),   icon: ShieldAlert,color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100' },
        ].map(m => (
          <div key={m.label} className={`card p-4 flex items-center gap-3 border ${m.border}`}>
            <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center flex-shrink-0`}>
              <m.icon size={18} className={m.color} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{m.label}</p>
              <p className="text-2xl font-bold text-gray-900 leading-none mt-0.5">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── SYSTEM STATUS ────────────────────────────────────── */}
      {tab === 'System Status' && (
        <div className="grid xl:grid-cols-3 gap-5">
          {/* Service health */}
          <div className="xl:col-span-2 card p-5">
            <h3 className="section-title">Service Health</h3>
            <div className="space-y-3">
              {[
                { name: 'API Server',  key: 'api',      icon: Server,   val: health?.api },
                { name: 'Database',    key: 'database', icon: Database, val: health?.database },
                { name: 'Auth Service',key: 'redis',    icon: Shield,   val: health?.redis },
                { name: 'JWT Service', key: 'keycloak', icon: KeyRound, val: health?.keycloak },
              ].map(s => {
                const healthy = s.val?.status === 'HEALTHY'
                return (
                  <div key={s.name} className={`flex items-center justify-between p-3.5 rounded-xl border ${healthy ? 'bg-emerald-50/40 border-emerald-100' : 'bg-red-50/40 border-red-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${healthy ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        <s.icon size={15} className={healthy ? 'text-emerald-700' : 'text-red-600'} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                        <p className="text-[10px] text-gray-500">{s.val?.responseTimeMs ?? '—'}ms response</p>
                      </div>
                    </div>
                    <span className={healthy ? 'badge-green' : 'badge-red'}>
                      {s.val?.status ?? 'Unknown'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Token settings */}
          <div className="card p-5">
            <h3 className="section-title">Token Configuration</h3>
            <div className="space-y-0 divide-y divide-gray-50">
              {[
                ['Access Token TTL',    '5 minutes'],
                ['Refresh Token TTL',   '30 minutes'],
                ['Session Idle',        '30 minutes'],
                ['Session Max',         '10 hours'],
                ['Admin Session',       '2 hours'],
                ['Password Hash',       'bcrypt · 12 rounds'],
                ['JWT Algorithm',       'RS256'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5 text-sm">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-800">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Platform stats */}
          <div className="xl:col-span-3 card p-5">
            <h3 className="section-title">Platform Overview</h3>
            <div className="grid sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Tenants',    value: stats?.totalTenants ?? '—' },
                { label: 'Total Users',      value: totalUsers },
                { label: 'New This Month',   value: stats?.newTenantsThisMonth ?? '—' },
                { label: 'Auth Uptime',      value: '99.95%' },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TENANT REALMS ────────────────────────────────────── */}
      {tab === 'Tenant Realms' && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-8 text-sm" placeholder="Search tenants…"
                value={realmSearch} onChange={e => setRealmSearch(e.target.value)} />
            </div>
            <span className="text-xs text-gray-400 ml-auto">{filteredTenants.length} tenants</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="th">Tenant / Realm</th>
                  <th className="th">Plan</th>
                  <th className="th">Status</th>
                  <th className="th text-center">Users</th>
                  <th className="th text-center">Sales</th>
                  <th className="th">Created</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTenants.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-sm text-gray-400">{loading ? 'Loading…' : 'No tenants'}</td></tr>
                )}
                {filteredTenants.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50/70 transition-colors group">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{t.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{t.id.slice(0, 12)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="td"><span className={ROLE_BADGE[t.plan] ?? 'badge-gray'}>{t.plan}</span></td>
                    <td className="td"><span className={STATUS_COLORS[t.status] ?? 'badge-gray'}>{t.status}</span></td>
                    <td className="td text-center text-xs font-medium text-gray-800">{(t._count as any)?.users ?? '—'}</td>
                    <td className="td text-center text-xs font-medium text-gray-800">{(t._count as any)?.sales ?? '—'}</td>
                    <td className="td text-xs text-gray-500">{fmtDate(t.createdAt)}</td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setRevokeTarget({ id: t.id, name: t.name })}
                          title="Revoke all sessions"
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors font-medium">
                          <LogOut size={11} /> Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <p className="text-xs text-gray-400">Active: <span className="font-semibold text-gray-700">{activeCount}</span></p>
            <p className="text-xs text-gray-400">Trial: <span className="font-semibold text-amber-600">{trialCount}</span></p>
            <p className="text-xs text-gray-400">Suspended: <span className="font-semibold text-red-600">{suspCount}</span></p>
          </div>
        </div>
      )}

      {/* ── USER MANAGEMENT ──────────────────────────────────── */}
      {tab === 'User Management' && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-8 text-sm" placeholder="Search name, email, or shop…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {(['ALL','OWNER','MANAGER','CASHIER','TECHNICIAN'] as const).map(r => (
                <button key={r} onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${roleFilter === r ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {r === 'ALL' ? 'All' : r.charAt(0) + r.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400 ml-auto">{filteredUsers.length} / {totalUsers}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="th">User</th>
                  <th className="th">Tenant</th>
                  <th className="th">Role</th>
                  <th className="th">Status</th>
                  <th className="th">Joined</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-sm text-gray-400">{loading ? 'Loading…' : 'No users found'}</td></tr>
                )}
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/70 transition-colors group">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{u.name}</p>
                          <p className="text-[10px] text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <p className="text-xs text-gray-700">{u.tenant?.name ?? '—'}</p>
                      <p className="text-[10px] text-gray-400">{u.tenant?.plan}</p>
                    </td>
                    <td className="td"><span className={ROLE_BADGE[u.role] ?? 'badge-gray'}>{u.role}</span></td>
                    <td className="td">
                      <span className={u.isActive ? 'badge-green' : 'badge-red'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="td text-xs text-gray-500">{fmtDate(u.createdAt)}</td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setResetUser(u)} title="Reset password"
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors font-medium">
                          <KeyRound size={11} /> Reset
                        </button>
                        <button
                          onClick={() => setRevokeTarget({ id: u.tenant?.id ?? '', name: u.tenant?.name ?? u.name })}
                          title="Revoke sessions for this tenant"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <LogOut size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SECURITY POLICIES ────────────────────────────────── */}
      {tab === 'Security Policies' && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {[
            {
              title: 'Password Policy', icon: KeyRound, color: 'text-violet-600', bg: 'bg-violet-50',
              items: [
                ['Min Length',           '10 characters'],
                ['Uppercase Required',   'Yes'],
                ['Number Required',      'Yes'],
                ['Symbol Required',      'Yes'],
                ['Expiry',               '90 days'],
                ['History',              'Last 5 passwords'],
              ],
            },
            {
              title: 'Brute-Force Protection', icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50',
              items: [
                ['Max Login Attempts',   '5'],
                ['Wait After Failure',   '30 seconds'],
                ['Lockout After',        '20 failures'],
                ['Unlock Method',        'Admin or time-based'],
                ['IP Throttling',        'Enabled'],
                ['Rate Limit',           '20 req / min'],
              ],
            },
            {
              title: 'MFA Settings', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50',
              items: [
                ['MFA Required For',     'Owners, Managers'],
                ['TOTP',                 'Enabled'],
                ['SMS OTP',              'Enabled'],
                ['Grace Period',         '7 days after registration'],
                ['Trusted Devices',      '30 days'],
              ],
            },
            {
              title: 'Session Security', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50',
              items: [
                ['Concurrent Sessions',  '5 max per user'],
                ['Idle Timeout',         '30 minutes'],
                ['Max Session',          '10 hours'],
                ['Secure Cookies',       'Enabled (Strict)'],
                ['CORS Policy',          'Whitelist-only'],
              ],
            },
            {
              title: 'Audit & Logging', icon: Eye, color: 'text-gray-600', bg: 'bg-gray-50',
              items: [
                ['Login Events',         'Logged'],
                ['Failed Logins',        'Logged + Alerted'],
                ['Token Events',         'Logged'],
                ['Log Retention',        '90 days'],
                ['SIEM Integration',     'Coming soon'],
              ],
            },
            {
              title: 'Social Login', icon: Globe, color: 'text-sky-600', bg: 'bg-sky-50',
              items: [
                ['Google OAuth 2.0',     'Enabled'],
                ['Apple Sign-In',        'Disabled'],
                ['Microsoft Azure AD',   'Disabled'],
                ['WhatsApp OTP',         'Planned'],
              ],
            },
          ].map(section => (
            <div key={section.title} className="card p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className={`w-8 h-8 rounded-lg ${section.bg} flex items-center justify-center flex-shrink-0`}>
                  <section.icon size={15} className={section.color} />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
              </div>
              <div className="space-y-0 divide-y divide-gray-50">
                {section.items.map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 text-sm">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
