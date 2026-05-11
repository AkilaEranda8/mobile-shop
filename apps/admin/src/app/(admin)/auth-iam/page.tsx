'use client'

import { useState } from 'react'
import { CheckCircle, RefreshCw, Shield, Lock, Globe, Users, Search, KeyRound, LogOut, Eye, RotateCcw, Edit } from 'lucide-react'

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-LK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const TABS = ['Keycloak Status', 'Realm Management', 'Global IAM', 'User Management']

export default function AuthIAMPage() {
  const [tab, setTab] = useState('Keycloak Status')
  const [realms] = useState<{ id: string; name: string; shopName?: string; users: number; sessions: number; activeSessions: number; status: string; lastActivity: string }[]>([])
  const [search, setSearch] = useState('')
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null)

  const filteredRealms = realms.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.shopName ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Auth / IAM</h1>
        <a href="https://auth.hexalyte.com/admin" target="_blank" rel="noreferrer" className="btn-secondary text-sm">
          <Globe size={14} />Open Keycloak Console
        </a>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Keycloak Status */}
      {tab === 'Keycloak Status' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'Cluster Status', value: 'Online', sub: '3 nodes active', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Active Sessions', value: '1,284', sub: 'Across all realms', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Uptime', value: '99.95%', sub: 'Last 30 days', icon: Shield, color: 'text-violet-600', bg: 'bg-violet-50' },
            ].map(s => (
              <div key={s.label} className="stat-card flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <s.icon size={18} className={s.color} />
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 mb-0.5">{s.label}</p>
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-[10px] text-gray-400">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="card p-5">
            <h3 className="section-title">Cluster Nodes</h3>
            <div className="space-y-3">
              {[
                { name: 'keycloak-node-1', status: 'HEALTHY', load: '32%', sessions: 432 },
                { name: 'keycloak-node-2', status: 'HEALTHY', load: '28%', sessions: 406 },
                { name: 'keycloak-node-3', status: 'HEALTHY', load: '41%', sessions: 446 },
              ].map(n => (
                <div key={n.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-sm font-mono text-gray-700">{n.name}</span>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-gray-500">
                    <span>Load: {n.load}</span>
                    <span>Sessions: {n.sessions}</span>
                    <span className="badge-green">Healthy</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="section-title">Token Settings</h3>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              {[
                ['Access Token Lifetime', '5 minutes'],
                ['Refresh Token Lifetime', '30 minutes'],
                ['SSO Session Idle', '30 minutes'],
                ['SSO Session Max', '10 hours'],
                ['Offline Session Idle', '30 days'],
                ['Admin Session Timeout', '2 hours'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-800">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Realm Management */}
      {tab === 'Realm Management' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 max-w-sm">
              <Search size={14} className="text-gray-400" />
              <input className="bg-transparent text-sm outline-none flex-1 placeholder-gray-400"
                placeholder="Search realms..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="th">Realm</th>
                  <th className="th">Tenant</th>
                  <th className="th text-center">Sessions</th>
                  <th className="th">Status</th>
                  <th className="th">Last Activity</th>
                  <th className="th text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRealms.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="td font-mono text-xs text-blue-600">{r.name}</td>
                    <td className="td text-xs text-gray-600">{r.shopName ?? <span className="text-gray-400 italic">master</span>}</td>
                    <td className="td text-center text-xs font-medium text-gray-800">{r.activeSessions}</td>
                    <td className="td">
                      <span className={r.status === 'ACTIVE' ? 'badge-green' : 'badge-yellow'}>{r.status}</span>
                    </td>
                    <td className="td text-xs text-gray-500">{fmtDateTime(r.lastActivity)}</td>
                    <td className="td">
                      <div className="flex items-center justify-center gap-1">
                        <button title="Revoke all sessions"
                          onClick={() => setRevokeConfirm(r.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <LogOut size={13} />
                        </button>
                        <button title="Reset password policy"
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <RotateCcw size={13} />
                        </button>
                        <button title={r.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          {r.status === 'ACTIVE' ? <Lock size={13} /> : <CheckCircle size={13} />}
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

      {/* Global IAM Settings */}
      {tab === 'Global IAM' && (
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              title: 'MFA Policy',
              items: [
                { label: 'MFA Required For', value: 'Owners, Managers' },
                { label: 'MFA Methods', value: 'TOTP, SMS OTP' },
                { label: 'Grace Period', value: '7 days' },
              ],
            },
            {
              title: 'Brute-Force Protection',
              items: [
                { label: 'Max Login Attempts', value: '5' },
                { label: 'Wait After Failure', value: '30 seconds' },
                { label: 'Permanent Lockout After', value: '20 failures' },
              ],
            },
            {
              title: 'Password Policy',
              items: [
                { label: 'Min Length', value: '10 characters' },
                { label: 'Requires', value: 'Upper, Lower, Number, Symbol' },
                { label: 'Expiry', value: '90 days' },
              ],
            },
            {
              title: 'Social Login',
              items: [
                { label: 'Google OAuth', value: 'Enabled' },
                { label: 'Apple Sign-In', value: 'Disabled' },
                { label: 'Microsoft', value: 'Disabled' },
              ],
            },
          ].map(section => (
            <div key={section.title} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title !mb-0">{section.title}</h3>
                <button className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Edit size={11} />Edit
                </button>
              </div>
              <div className="space-y-2.5">
                {section.items.map(item => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{item.label}</span>
                    <span className="font-medium text-gray-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User Management */}
      {tab === 'User Management' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 max-w-sm">
            <Search size={14} className="text-gray-400" />
            <input className="bg-transparent text-sm outline-none flex-1 placeholder-gray-400"
              placeholder="Search users across all realms..." />
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="th">User</th>
                  <th className="th">Realm</th>
                  <th className="th">Role</th>
                  <th className="th">Sessions</th>
                  <th className="th text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { name: 'Kamal Perera', email: 'kamal@irepair.lk', realm: 'irepair-hub', role: 'OWNER', sessions: 2 },
                  { name: 'Nimal Silva', email: 'nimal@phonezone.lk', realm: 'phonezone-galle', role: 'OWNER', sessions: 0 },
                  { name: 'Arun Kumar', email: 'arun@techfix.in', realm: 'techfix-pro', role: 'OWNER', sessions: 3 },
                  { name: 'Staff Member', email: 'staff@techfix.in', realm: 'techfix-pro', role: 'CASHIER', sessions: 1 },
                ].map((u, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="td">
                      <p className="text-xs font-medium text-gray-800">{u.name}</p>
                      <p className="text-[10px] text-gray-400">{u.email}</p>
                    </td>
                    <td className="td text-xs font-mono text-blue-600">{u.realm}</td>
                    <td className="td"><span className={u.role === 'OWNER' ? 'badge-purple' : 'badge-gray'}>{u.role}</span></td>
                    <td className="td">
                      <span className={`text-xs font-medium ${u.sessions > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {u.sessions} active
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-center gap-1">
                        <button title="View sessions" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Eye size={13} />
                        </button>
                        <button title="Force logout" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <LogOut size={13} />
                        </button>
                        <button title="Reset password" className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <KeyRound size={13} />
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

      {/* Revoke sessions modal */}
      {revokeConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Revoke All Sessions</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will force-logout all users in realm <strong className="font-mono text-blue-600">{revokeConfirm}</strong>. They will need to log in again.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRevokeConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => setRevokeConfirm(null)} className="btn-danger">Revoke All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
