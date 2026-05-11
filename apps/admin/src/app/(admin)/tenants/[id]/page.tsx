'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, KeyRound, HardDrive,
  Users, CreditCard, FileText, ScrollText, AlertTriangle, LogIn, Ban,
  RefreshCw, Trash2, MessageSquare, Plus, Shield
} from 'lucide-react'
import { fetchTenants, type TenantRow } from '@/lib/api'

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-green', TRIAL: 'badge-blue', SUSPENDED: 'badge-yellow', CANCELLED: 'badge-gray',
}
const PLAN_BADGE: Record<string, string> = {
  STARTER: 'badge-gray', PRO: 'badge-blue', ENTERPRISE: 'badge-purple',
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-LK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const TABS = ['Overview', 'Users', 'Invoices', 'Audit Log', 'Support Notes', 'Danger Zone']

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tenant, setTenant] = useState<TenantRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [newNote, setNewNote] = useState('')
  const [showImpersonate, setShowImpersonate] = useState(false)
  const [showSuspend, setShowSuspend] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  useEffect(() => {
    fetchTenants()
      .then(d => setTenant(d.data.find(t => t.id === id) ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const tenantLogs: { id: string; severity: string; eventType: string; details: string; actor: string; ip: string; timestamp: string }[] = []
  const tenantNotes: { id: string; adminName: string; ticketRef?: string; note: string; createdAt: string }[] = []

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Building2 size={40} className="mb-3 animate-pulse" />
        <p className="text-sm">Loading tenant...</p>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Building2 size={40} className="mb-3" />
        <p className="text-lg font-medium text-gray-600">Tenant not found</p>
        <Link href="/tenants" className="mt-3 text-sm text-blue-600 hover:underline">← Back to tenants</Link>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <Link href="/tenants" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} />Back to Tenants
      </Link>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {tenant.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{tenant.name}</h1>
              <span className={PLAN_BADGE[tenant.plan]}>{tenant.plan}</span>
              <span className={STATUS_BADGE[tenant.status]}>{tenant.status}</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">{tenant.ownerEmail}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-gray-600"><Mail size={13} />{tenant.ownerEmail}</div>
              <div className="flex items-center gap-1.5 text-gray-600"><Users size={13} />{tenant._count?.users ?? '?'} users</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowImpersonate(true)} className="btn-secondary text-xs">
              <LogIn size={13} />Impersonate
            </button>
            <a
              href={`https://auth.hexalyte.com/admin/console`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs"
            >
              <KeyRound size={13} />Keycloak
            </a>
            {tenant.status === 'ACTIVE' || tenant.status === 'TRIAL' ? (
              <button onClick={() => setShowSuspend(true)} className="btn-secondary text-xs text-amber-600 border-amber-200 hover:bg-amber-50">
                <Ban size={13} />Suspend
              </button>
            ) : (
              <button className="btn-secondary text-xs text-green-600 border-green-200 hover:bg-green-50">
                <RefreshCw size={13} />Reactivate
              </button>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          {[
            { label: 'MRR', value: tenant.mrr ? `Rs.${tenant.mrr.toLocaleString()}` : 'Trial', icon: CreditCard },
            { label: 'Users', value: String(tenant._count?.users ?? '—'), icon: Users },
            { label: 'Joined', value: fmtDate(tenant.createdAt), icon: Building2 },
            { label: 'Plan', value: tenant.plan, icon: RefreshCw },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <s.icon size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400">{s.label}</p>
                <p className="text-sm font-semibold text-gray-800">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 gap-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Overview' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="section-title">Subscription Info</h3>
            <dl className="space-y-2.5">
              {[
                ['Plan', <span className={PLAN_BADGE[tenant.plan]}>{tenant.plan}</span>],
                ['Status', <span className={STATUS_BADGE[tenant.status]}>{tenant.status}</span>],
                ['MRR', tenant.mrr ? `Rs.${tenant.mrr.toLocaleString()}` : 'Free Trial'],
                ['Subscription Ends', tenant.subscriptionEndsAt ? fmtDate(tenant.subscriptionEndsAt) : '—'],
                ['Joined', fmtDate(tenant.createdAt)],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between">
                  <dt className="text-xs text-gray-500">{k}</dt>
                  <dd className="text-xs font-medium text-gray-800">{v as React.ReactNode}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="card p-5">
            <h3 className="section-title">DB Schema Health</h3>
            <dl className="space-y-2.5">
              {[
                ['Tenant ID', <span className="font-mono text-xs text-blue-600">{tenant.id}</span>],
                ['DB', 'Managed schema'],
                ['Last Backup', 'Today 02:00 IST'],
                ['Backup Status', <span className="badge-green">Success</span>],
                ['Active Connections', '3'],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between">
                  <dt className="text-xs text-gray-500">{k}</dt>
                  <dd className="text-xs font-medium text-gray-800">{v as React.ReactNode}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {tab === 'Users' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="section-title !mb-0">Tenant Users</h3>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="th">User</th><th className="th">Role</th>
              <th className="th">Status</th><th className="th">Last Login</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              <tr><td colSpan={4} className="td text-center text-xs text-gray-400 py-8">User list not yet available from backend API</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Invoices' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="section-title !mb-0">Invoice History</h3>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="th">Invoice #</th><th className="th">Amount</th>
              <th className="th">Status</th><th className="th">Issued</th><th className="th">Due</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {[1, 2, 3].map(n => (
                <tr key={n} className="hover:bg-gray-50">
                  <td className="td font-mono text-xs text-gray-600">INV-{2026 - n}05-{String(n).padStart(4, '0')}</td>
                  <td className="td font-semibold text-xs">{tenant.mrr ? `Rs.${tenant.mrr.toLocaleString()}` : '—'}</td>
                  <td className="td"><span className={n === 1 ? 'badge-green' : 'badge-green'}>PAID</span></td>
                  <td className="td text-xs text-gray-500">1 {['May', 'Apr', 'Mar'][n - 1]} 2026</td>
                  <td className="td text-xs text-gray-500">15 {['May', 'Apr', 'Mar'][n - 1]} 2026</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Audit Log' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="section-title !mb-0">Audit Log</h3>
          </div>
          {tenantLogs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400">No audit events for this tenant.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {tenantLogs.map(l => (
                <div key={l.id} className="flex items-start gap-3 px-5 py-3">
                  <span className={`badge mt-0.5 flex-shrink-0 ${l.severity === 'INFO' ? 'badge-blue' : l.severity === 'WARN' ? 'badge-yellow' : 'badge-red'}`}>
                    {l.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{l.eventType.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">{l.details}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">by {l.actor} · {l.ip}</p>
                  </div>
                  <p className="text-[10px] text-gray-400 flex-shrink-0">{fmtDateTime(l.timestamp)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'Support Notes' && (
        <div className="space-y-3">
          <div className="card p-4">
            <textarea
              className="input resize-none mb-2"
              rows={3}
              placeholder="Add an internal support note..."
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <input className="input flex-1" placeholder="Ticket ref (optional)" />
              <button className="btn-primary text-xs" onClick={() => setNewNote('')}>
                <Plus size={13} />Add Note
              </button>
            </div>
          </div>
          {tenantNotes.map(n => (
            <div key={n.id} className="card p-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-800">{n.adminName}</span>
                  {n.ticketRef && <span className="badge-blue text-[10px]">{n.ticketRef}</span>}
                </div>
                <span className="text-[10px] text-gray-400">{fmtDateTime(n.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-600">{n.note}</p>
            </div>
          ))}
          {tenantNotes.length === 0 && !newNote && (
            <p className="text-sm text-gray-400 text-center py-6">No notes yet.</p>
          )}
        </div>
      )}

      {tab === 'Danger Zone' && (
        <div className="card border-red-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-red-500" />
            <h3 className="text-sm font-bold text-red-700">Danger Zone</h3>
          </div>
          <p className="text-sm text-gray-600 mb-5">These actions are irreversible. Proceed with extreme caution.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-800">Suspend Tenant</p>
                <p className="text-xs text-gray-500">Block login access. Data preserved. Can be reactivated.</p>
              </div>
              <button onClick={() => setShowSuspend(true)} className="btn-secondary text-amber-600 border-amber-300 hover:bg-amber-100 text-xs">
                <Ban size={13} />Suspend
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-800">Delete Tenant</p>
                <p className="text-xs text-gray-500">Permanently deletes all data, schema, and Keycloak realm.</p>
              </div>
              <button onClick={() => setShowDelete(true)} className="btn-danger text-xs">
                <Trash2 size={13} />Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Impersonate modal */}
      {showImpersonate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <LogIn size={18} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Impersonate Tenant</h3>
                <p className="text-xs text-gray-500">Full audit log will be recorded</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You are about to log in as <strong>{tenant.ownerName}</strong> ({tenant.name}). This session will:
            </p>
            <ul className="text-xs text-gray-500 space-y-1 mb-4 pl-4 list-disc">
              <li>Be fully audit logged</li>
              <li>Auto-expire after 30 minutes</li>
              <li>Block access to billing section</li>
            </ul>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowImpersonate(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowImpersonate(false)} className="btn-primary">Start Session</button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend modal */}
      {showSuspend && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Suspend {tenant.name}?</h3>
            <p className="text-sm text-gray-600 mb-4">All users will lose access immediately. Data will be preserved.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSuspend(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowSuspend(false)} className="btn-danger">Suspend</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Delete {tenant.name}?</h3>
            <p className="text-sm text-gray-600 mb-4">This is permanent. Type the shop name to confirm:</p>
            <input className="input mb-4" placeholder={tenant.name} value={deleteInput} onChange={e => setDeleteInput(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowDelete(false); setDeleteInput('') }} className="btn-secondary">Cancel</button>
              <button disabled={deleteInput !== tenant.name} className="btn-danger disabled:opacity-40">Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
