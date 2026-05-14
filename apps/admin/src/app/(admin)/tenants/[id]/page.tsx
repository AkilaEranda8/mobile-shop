'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Building2, KeyRound, Users, CreditCard,
  AlertTriangle, LogIn, Ban, RefreshCw, Trash2, Plus,
  ShoppingCart, Wrench, CheckCircle, XCircle,
} from 'lucide-react'
import {
  fetchTenant, fetchTenantSales, fetchActivityLogs,
  updateTenantStatus, updateTenant, deleteTenant,
  type TenantRow, type TenantSale,
} from '@/lib/api'

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

const TABS = ['Overview', 'Users', 'Sales', 'Audit Log', 'Danger Zone']
const SALE_STATUS_BADGE: Record<string, string> = {
  PAID: 'badge-green', PARTIAL: 'badge-yellow', UNPAID: 'badge-red', REFUNDED: 'badge-gray',
}
const ROLE_BADGE: Record<string, string> = {
  OWNER: 'badge-purple', MANAGER: 'badge-blue', CASHIER: 'badge-gray', TECHNICIAN: 'badge-yellow',
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tenant, setTenant]   = useState<TenantRow | null>(null)
  const [sales, setSales]     = useState<TenantSale[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('Overview')
  const [actionLoading, setActionLoading] = useState(false)
  const [showSuspend, setShowSuspend] = useState(false)
  const [showDelete, setShowDelete]   = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [editPlan, setEditPlan]       = useState<{ plan: string; mrr: string } | null>(null)

  const loadTenant = useCallback(() => {
    setLoading(true)
    fetchTenant(id)
      .then(t => setTenant(t))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    loadTenant()
    fetchTenantSales(id).then(setSales).catch(() => {})
    fetchActivityLogs({ limit: 50 }).then(r => {
      setAuditLogs(r.data)
    }).catch(() => {})
  }, [id, loadTenant])

  async function handleSuspend() {
    if (!tenant) return
    setActionLoading(true)
    try {
      await updateTenantStatus(tenant.id, 'SUSPENDED')
      setShowSuspend(false); loadTenant()
    } catch {}
    setActionLoading(false)
  }

  async function handleReactivate() {
    if (!tenant) return
    setActionLoading(true)
    try {
      await updateTenantStatus(tenant.id, 'ACTIVE')
      loadTenant()
    } catch {}
    setActionLoading(false)
  }

  async function handleDelete() {
    if (!tenant || deleteInput !== tenant.name) return
    setActionLoading(true)
    try {
      await deleteTenant(tenant.id)
      router.push('/tenants')
    } catch {}
    setActionLoading(false)
  }

  async function handleSavePlan() {
    if (!tenant || !editPlan) return
    setActionLoading(true)
    try {
      await updateTenant(tenant.id, { plan: editPlan.plan, mrr: Number(editPlan.mrr) || undefined })
      setEditPlan(null); loadTenant()
    } catch {}
    setActionLoading(false)
  }

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

  const tenantAudit = auditLogs.filter(l =>
    l.actor?.toLowerCase().includes(tenant.name.toLowerCase()) ||
    l.details?.toLowerCase().includes(tenant.name.toLowerCase()) ||
    l.target?.toLowerCase().includes(tenant.name.toLowerCase())
  ).slice(0, 30)

  return (
    <div className="space-y-5">
      <Link href="/tenants" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} />Back to Tenants
      </Link>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {tenant.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{tenant.name}</h1>
              <span className={PLAN_BADGE[tenant.plan] ?? 'badge-gray'}>{tenant.plan}</span>
              <span className={STATUS_BADGE[tenant.status] ?? 'badge-gray'}>{tenant.status}</span>
            </div>
            <p className="text-xs text-gray-500">{tenant.ownerName} · {tenant.ownerEmail}</p>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <a href="https://auth.hexalyte.com/admin/console" target="_blank" rel="noopener noreferrer"
              className="btn-secondary text-xs"><KeyRound size={13} />Keycloak</a>
            {(tenant.status === 'ACTIVE' || tenant.status === 'TRIAL') ? (
              <button onClick={() => setShowSuspend(true)} className="btn-secondary text-xs text-amber-600 border-amber-200 hover:bg-amber-50">
                <Ban size={13} />Suspend
              </button>
            ) : (
              <button onClick={handleReactivate} disabled={actionLoading}
                className="btn-secondary text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                <CheckCircle size={13} />Reactivate
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-5 pt-5 border-t border-gray-100">
          {[
            { label: 'MRR',       value: tenant.mrr ? `Rs.${tenant.mrr.toLocaleString()}` : 'Trial', icon: CreditCard },
            { label: 'Users',     value: String(tenant._count?.users ?? (tenant.users?.length ?? '—')), icon: Users },
            { label: 'Sales',     value: (tenant._count?.sales ?? '—').toLocaleString(), icon: ShoppingCart },
            { label: 'Repairs',   value: (tenant._count?.repairs ?? '—').toLocaleString(), icon: Wrench },
            { label: 'Customers', value: (tenant._count?.customers ?? '—').toLocaleString(), icon: Building2 },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <s.icon size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400">{s.label}</p>
                <p className="text-sm font-semibold text-gray-800">{String(s.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'Overview' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title !mb-0">Subscription</h3>
              <button onClick={() => setEditPlan({ plan: tenant.plan, mrr: String(tenant.mrr ?? '') })}
                className="text-xs text-blue-600 hover:underline">Edit</button>
            </div>
            <dl className="space-y-2.5">
              {[
                ['Plan',  <span className={PLAN_BADGE[tenant.plan] ?? 'badge-gray'}>{tenant.plan}</span>],
                ['Status', <span className={STATUS_BADGE[tenant.status] ?? 'badge-gray'}>{tenant.status}</span>],
                ['MRR',  tenant.mrr ? `Rs.${tenant.mrr.toLocaleString()}` : 'Free Trial'],
                ['Sub. Ends', tenant.subscriptionEndsAt ? fmtDate(tenant.subscriptionEndsAt) : '—'],
                ['Trial Ends', tenant.trialEndsAt ? fmtDate(tenant.trialEndsAt) : '—'],
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
            <h3 className="section-title">Tenant Info</h3>
            <dl className="space-y-2.5">
              {[
                ['Tenant ID',  <span className="font-mono text-[10px] text-blue-600 break-all">{tenant.id}</span>],
                ['Owner',  tenant.ownerName],
                ['Email',  tenant.ownerEmail],
                ['Products',  (tenant._count?.products ?? '—').toLocaleString()],
                ['Branches',  (tenant.branches?.length ?? '—').toLocaleString()],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-2">
                  <dt className="text-xs text-gray-500 flex-shrink-0">{k}</dt>
                  <dd className="text-xs font-medium text-gray-800 text-right">{v as React.ReactNode}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* ── Users ── */}
      {tab === 'Users' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="section-title !mb-0">Users</h3>
            <span className="text-xs text-gray-500">{(tenant.users?.length ?? 0)} total</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="th">Name</th>
                <th className="th">Email</th>
                <th className="th">Role</th>
                <th className="th">Status</th>
                <th className="th">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(tenant.users ?? []).length === 0 && (
                <tr><td colSpan={5} className="td py-8 text-center text-gray-400 text-sm">No users found.</td></tr>
              )}
              {(tenant.users ?? []).map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 text-[10px] font-bold text-gray-600 flex items-center justify-center flex-shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <span className="text-xs font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="td text-xs text-gray-600">{u.email}</td>
                  <td className="td"><span className={ROLE_BADGE[u.role] ?? 'badge-gray'}>{u.role}</span></td>
                  <td className="td">
                    {u.isActive
                      ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle size={11} />Active</span>
                      : <span className="flex items-center gap-1 text-xs text-gray-400"><XCircle size={11} />Inactive</span>}
                  </td>
                  <td className="td text-xs text-gray-500">{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Sales ── */}
      {tab === 'Sales' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="section-title !mb-0">Recent Sales</h3>
            <span className="text-xs text-gray-500">Last 30</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="th">Invoice #</th>
                <th className="th">Customer</th>
                <th className="th">Cashier</th>
                <th className="th text-right">Total</th>
                <th className="th">Status</th>
                <th className="th">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sales.length === 0 && (
                <tr><td colSpan={6} className="td py-8 text-center text-gray-400 text-sm">No sales yet.</td></tr>
              )}
              {sales.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="td font-mono text-xs text-blue-600">{s.invoiceNumber}</td>
                  <td className="td text-xs text-gray-700">{s.customerName ?? '—'}</td>
                  <td className="td text-xs text-gray-600">{s.cashierName}</td>
                  <td className="td text-right text-xs font-semibold text-gray-900">Rs.{Number(s.total).toLocaleString()}</td>
                  <td className="td"><span className={SALE_STATUS_BADGE[s.status] ?? 'badge-gray'}>{s.status}</span></td>
                  <td className="td text-xs text-gray-500 whitespace-nowrap">{fmtDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Audit Log ── */}
      {tab === 'Audit Log' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
            <h3 className="section-title !mb-0">Activity for {tenant.name}</h3>
          </div>
          {tenantAudit.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No recent activity found for this tenant.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {tenantAudit.map((l: any) => (
                <div key={l.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50">
                  <span className={`badge flex-shrink-0 mt-0.5 ${l.severity === 'INFO' ? 'badge-blue' : l.severity === 'WARN' ? 'badge-yellow' : 'badge-red'}`}>
                    {l.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{l.eventType.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{l.details}</p>
                  </div>
                  <p className="text-[10px] text-gray-400 flex-shrink-0 font-mono">{fmtDateTime(l.timestamp)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Danger Zone ── */}
      {tab === 'Danger Zone' && (
        <div className="card border-red-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-red-500" />
            <h3 className="text-sm font-bold text-red-700">Danger Zone</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-800">Suspend Tenant</p>
                <p className="text-xs text-gray-500">Block all user logins. Data preserved. Can be reactivated.</p>
              </div>
              {(tenant.status === 'ACTIVE' || tenant.status === 'TRIAL') ? (
                <button onClick={() => setShowSuspend(true)} disabled={actionLoading}
                  className="btn-secondary text-amber-600 border-amber-300 hover:bg-amber-100 text-xs">
                  <Ban size={13} />Suspend
                </button>
              ) : (
                <button onClick={handleReactivate} disabled={actionLoading}
                  className="btn-secondary text-emerald-600 border-emerald-200 hover:bg-emerald-50 text-xs">
                  <CheckCircle size={13} />Reactivate
                </button>
              )}
            </div>
            <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-800">Delete Tenant</p>
                <p className="text-xs text-gray-500">Permanently deletes all data, schema, and Keycloak realm.</p>
              </div>
              <button onClick={() => setShowDelete(true)} disabled={actionLoading} className="btn-danger text-xs">
                <Trash2 size={13} />Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Plan modal */}
      {editPlan && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Edit Plan & MRR</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
                <select className="input" value={editPlan.plan} onChange={e => setEditPlan({ ...editPlan, plan: e.target.value })}>
                  <option>STARTER</option><option>PRO</option><option>ENTERPRISE</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">MRR (Rs.)</label>
                <input className="input" type="number" value={editPlan.mrr}
                  onChange={e => setEditPlan({ ...editPlan, mrr: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditPlan(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleSavePlan} disabled={actionLoading} className="btn-primary">
                {actionLoading ? 'Saving…' : 'Save Changes'}
              </button>
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
              <button onClick={handleSuspend} disabled={actionLoading} className="btn-danger">
                {actionLoading ? 'Suspending…' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Delete {tenant.name}?</h3>
            <p className="text-sm text-gray-600 mb-3">This is permanent. Type the shop name to confirm:</p>
            <input className="input mb-4" placeholder={tenant.name}
              value={deleteInput} onChange={e => setDeleteInput(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowDelete(false); setDeleteInput('') }} className="btn-secondary">Cancel</button>
              <button disabled={deleteInput !== tenant.name || actionLoading}
                className="btn-danger disabled:opacity-40" onClick={handleDelete}>
                {actionLoading ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
