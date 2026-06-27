'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, Plus, MoreHorizontal, Eye, Edit2, Ban,
  RefreshCw, Trash2, KeyRound, ChevronLeft, ChevronRight,
  Building2, Users, TrendingUp, AlertCircle, CheckCircle,
  Copy, CheckCheck, MessageCircle,
} from 'lucide-react'
import Link from 'next/link'
import {
  fetchTenants, fetchStats, updateTenantStatus, deleteTenant, createTenant,
  billingWhatsappApi,
  type TenantRow, type PlatformStats,
} from '@/lib/api'
import {
  buildTenantOnboardShareMessage,
} from '@/lib/tenantOnboardMessage'

function WhatsAppFormattedLine({ line }: { line: string }) {
  const parts = line.split(/(\*[^*]+\*|_[^_]+_)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*')) {
          return <strong key={i} className="font-semibold text-gray-900">{part.slice(1, -1)}</strong>
        }
        if (part.startsWith('_') && part.endsWith('_')) {
          return <em key={i} className="text-gray-600 not-italic text-[12px]">{part.slice(1, -1)}</em>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function WhatsAppMessagePreview({ message }: { message: string }) {
  return (
    <div className="space-y-1">
      {message.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />
        if (line.startsWith('─')) {
          return (
            <div key={i} className="text-[10px] tracking-widest text-gray-300 font-medium py-0.5">
              {line}
            </div>
          )
        }
        return (
          <p key={i} className="text-[13px] text-gray-800 leading-[1.55] m-0">
            <WhatsAppFormattedLine line={line} />
          </p>
        )
      })}
    </div>
  )
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'badge-green',
  TRIAL:     'badge-blue',
  SUSPENDED: 'badge-yellow',
  CANCELLED: 'badge-gray',
}
const PLAN_BADGE: Record<string, string> = {
  STARTER:    'badge-gray',
  PRO:        'badge-blue',
  ENTERPRISE: 'badge-purple',
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })
}
function fmtMRR(n: number) {
  return n === 0 ? '—' : `Rs.${n.toLocaleString()}`
}

const PER_PAGE = 20

export default function TenantsPage() {
  const [tenants, setTenants]   = useState<TenantRow[]>([])
  const [total, setTotal]       = useState(0)
  const [stats, setStats]       = useState<PlatformStats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [planFilter, setPlanFilter]     = useState('ALL')
  const [page, setPage]         = useState(1)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<TenantRow | null>(null)
  const [deleteInput, setDeleteInput]     = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showOnboard, setShowOnboard]     = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback((params: { search?: string; status?: string; plan?: string; page?: number } = {}) => {
    setLoading(true)
    const p: Record<string, string> = {
      page: String(params.page ?? page),
      limit: String(PER_PAGE),
    }
    if ((params.search ?? search))               p.search = params.search ?? search
    if ((params.status ?? statusFilter) !== 'ALL') p.status = params.status ?? statusFilter
    if ((params.plan   ?? planFilter)   !== 'ALL') p.plan   = params.plan   ?? planFilter
    fetchTenants(p)
      .then(d => { setTenants(d.data); setTotal(d.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search, statusFilter, planFilter, page])

  useEffect(() => {
    load()
    fetchStats().then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('search')
    if (!q) return
    setSearch(q)
    setPage(1)
    load({ search: q, page: 1 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch(v: string) {
    setSearch(v); setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load({ search: v, page: 1 }), 350)
  }
  function handleStatus(v: string) { setStatusFilter(v); setPage(1); load({ status: v, page: 1 }) }
  function handlePlan(v: string)   { setPlanFilter(v);   setPage(1); load({ plan: v,   page: 1 }) }
  function handlePage(p: number)   { setPage(p); load({ page: p }) }

  async function handleStatusAction(t: TenantRow, newStatus: string) {
    setActionLoading(t.id); setMenuOpen(null)
    try {
      await updateTenantStatus(t.id, newStatus)
      load()
    } catch {}
    setActionLoading(null)
  }

  async function handleDelete() {
    if (!confirmDelete || deleteInput !== confirmDelete.name) return
    setActionLoading(confirmDelete.id)
    try {
      await deleteTenant(confirmDelete.id)
      setConfirmDelete(null); setDeleteInput('')
      load()
    } catch {}
    setActionLoading(null)
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div>
          <h1 className="page-title">Tenants</h1>
          <p className="text-sm text-gray-500">{loading ? 'Loading…' : `${total.toLocaleString()} tenants`}</p>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button onClick={() => load()} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => setShowOnboard(true)} className="btn-primary text-sm">
            <Plus size={14} />Onboard Tenant
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',     value: stats?.totalTenants ?? '—',     icon: Building2,    color: 'text-gray-600',    bg: 'bg-gray-100',    border: 'border-gray-200'   },
          { label: 'Active',    value: stats?.activeTenants ?? '—',    icon: CheckCircle,  color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100'},
          { label: 'Trial',     value: stats?.trialTenants ?? '—',     icon: Users,        color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-100'   },
          { label: 'Suspended', value: stats?.suspendedTenants ?? '—', icon: AlertCircle,  color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100'  },
        ].map(k => (
          <div key={k.label} className={`card p-4 flex items-center gap-3 border ${k.border}`}>
            <div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
              <k.icon size={15} className={k.color} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{k.label}</p>
              <p className="text-xl font-bold text-gray-900 leading-none mt-0.5">{String(k.value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-gray-400" />
          <input className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1"
            placeholder="Search shop, owner, email…"
            value={search} onChange={e => handleSearch(e.target.value)} />
        </div>
        <select className="input w-auto text-sm" value={statusFilter} onChange={e => handleStatus(e.target.value)}>
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="TRIAL">Trial</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select className="input w-auto text-sm" value={planFilter} onChange={e => handlePlan(e.target.value)}>
          <option value="ALL">All Plans</option>
          <option value="STARTER">Starter</option>
          <option value="PRO">Pro</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="th">Shop</th>
                <th className="th">Owner</th>
                <th className="th">Plan</th>
                <th className="th">Status</th>
                <th className="th text-right">MRR</th>
                <th className="th text-right">Sales</th>
                <th className="th text-right">Users</th>
                <th className="th whitespace-nowrap">Joined</th>
                <th className="th text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr><td colSpan={9} className="td py-12 text-center">
                  <RefreshCw size={18} className="animate-spin mx-auto text-gray-400" />
                </td></tr>
              )}
              {!loading && tenants.length === 0 && (
                <tr><td colSpan={9} className="td py-10 text-center text-gray-400 text-sm">No tenants match your filters.</td></tr>
              )}
              {!loading && tenants.map(t => (
                <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${actionLoading === t.id ? 'opacity-50' : ''}`}>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gray-900 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-xs">{t.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{t.id.slice(-8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <p className="text-xs text-gray-700 font-medium">{t.ownerName}</p>
                    <p className="text-[10px] text-gray-400">{t.ownerEmail}</p>
                  </td>
                  <td className="td"><span className={PLAN_BADGE[t.plan] ?? 'badge-gray'}>{t.plan}</span></td>
                  <td className="td"><span className={STATUS_BADGE[t.status] ?? 'badge-gray'}>{t.status}</span></td>
                  <td className="td text-right font-semibold text-xs text-gray-800">{fmtMRR(t.mrr ?? 0)}</td>
                  <td className="td text-right text-xs text-gray-600">{t._count?.sales?.toLocaleString() ?? '—'}</td>
                  <td className="td text-right text-xs text-gray-600">{t._count?.users ?? '—'}</td>
                  <td className="td text-xs text-gray-500 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                  <td className="td text-center">
                    <div className="relative flex items-center justify-center gap-1">
                      <Link href={`/tenants/${t.id}`}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Eye size={14} />
                      </Link>
                      <button onClick={() => setMenuOpen(menuOpen === t.id ? null : t.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreHorizontal size={14} />
                      </button>
                      {menuOpen === t.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-20">
                          <Link href={`/tenants/${t.id}`} onClick={() => setMenuOpen(null)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            <Eye size={13} />View Details
                          </Link>
                          <Link href={`/tenants/${t.id}`} onClick={() => setMenuOpen(null)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            <Edit2 size={13} />Edit Plan / MRR
                          </Link>
                          <a href="https://auth.hexalyte.com/admin/console" target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            <KeyRound size={13} />Keycloak Realm
                          </a>
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            {t.status === 'ACTIVE' || t.status === 'TRIAL' ? (
                              <button onClick={() => handleStatusAction(t, 'SUSPENDED')}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50">
                                <Ban size={13} />Suspend
                              </button>
                            ) : (
                              <button onClick={() => handleStatusAction(t, 'ACTIVE')}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50">
                                <CheckCircle size={13} />Reactivate
                              </button>
                            )}
                          </div>
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            <button onClick={() => { setConfirmDelete(t); setMenuOpen(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                              <Trash2 size={13} />Delete Tenant
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {((page - 1) * PER_PAGE + 1).toLocaleString()}–{Math.min(page * PER_PAGE, total).toLocaleString()} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => handlePage(Math.max(1, page - 1))} disabled={page === 1 || loading}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded-lg hover:bg-gray-100">
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const n = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i
                return (
                  <button key={n} onClick={() => handlePage(n)}
                    className={`w-7 h-7 text-xs rounded-lg ${n === page ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {n}
                  </button>
                )
              })}
              <button onClick={() => handlePage(Math.min(totalPages, page + 1))} disabled={page === totalPages || loading}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded-lg hover:bg-gray-100">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete Tenant</h3>
                <p className="text-xs text-gray-500">This action is irreversible</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Permanently deletes <strong>{confirmDelete.name}</strong>, all data, and Keycloak realm.
            </p>
            <p className="text-sm text-gray-700 mb-2">
              Type <strong className="font-mono text-red-600">{confirmDelete.name}</strong> to confirm:
            </p>
            <input className="input mb-4" placeholder={confirmDelete.name}
              value={deleteInput} onChange={e => setDeleteInput(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirmDelete(null); setDeleteInput('') }} className="btn-secondary">Cancel</button>
              <button disabled={deleteInput !== confirmDelete.name || !!actionLoading}
                className="btn-danger disabled:opacity-40" onClick={handleDelete}>
                {actionLoading ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOnboard && (
        <OnboardModal onClose={() => setShowOnboard(false)} onCreated={load} />
      )}
    </div>
  )
}

function OnboardModal({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ shopName: '', ownerName: '', email: '', phone: '', password: '', plan: 'STARTER', country: 'LK' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<{ subdomain: string; ownerEmail: string; tempPassword?: string; whatsappSent?: boolean } | null>(null)
  const [sendingWa, setSendingWa] = useState(false)

  const loginPassword = result?.tempPassword ?? form.password
  const shareMessage = result && loginPassword
    ? buildTenantOnboardShareMessage({
        shopName: form.shopName,
        ownerName: form.ownerName,
        email: result.ownerEmail || form.email,
        password: loginPassword,
        plan: form.plan,
        phone: form.phone,
        subdomain: result.subdomain,
      })
    : ''

  async function copyShareMessage() {
    if (!shareMessage) return
    await navigator.clipboard.writeText(shareMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function sendViaWhatsAppApi() {
    if (!result || !loginPassword || !form.phone.trim()) return
    setSendingWa(true)
    setError('')
    try {
      await billingWhatsappApi.sendOnboardCredentials({
        phone: form.phone.trim(),
        shopName: form.shopName,
        ownerName: form.ownerName,
        email: result.ownerEmail || form.email,
        password: loginPassword,
        plan: form.plan,
        subdomain: result.subdomain,
      })
      setResult(prev => prev ? { ...prev, whatsappSent: true } : prev)
    } catch (e: any) {
      setError(e.message || 'Failed to send WhatsApp message')
    } finally {
      setSendingWa(false)
    }
  }

  async function provision() {
    setLoading(true)
    setError('')
    try {
      const res = await createTenant({ shopName: form.shopName, ownerName: form.ownerName, email: form.email, phone: form.phone, plan: form.plan, password: form.password || undefined })
      setResult({
        subdomain: res.subdomain,
        ownerEmail: res.ownerEmail,
        tempPassword: res.tempPassword,
      })
      setStep(4)
      onCreated?.()
    } catch (e: any) {
      setError(e.message || 'Failed to create tenant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
        {/* Steps */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${n <= step ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>{n}</div>
              {n < 4 && <div className={`flex-1 h-0.5 w-8 ${n < step ? 'bg-gray-900' : 'bg-gray-200'}`} />}
            </div>
          ))}
          <p className="ml-2 text-sm text-gray-500">
            {['Shop Details', 'Plan', 'Provisioning', 'Done'][step - 1]}
          </p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Shop Details</h3>
            {[
              { label: 'Shop Name', key: 'shopName', placeholder: 'e.g. iRepair Hub' },
              { label: 'Owner Name', key: 'ownerName', placeholder: 'e.g. Kamal Perera' },
              { label: 'Email', key: 'email', placeholder: 'owner@shop.com' },
              { label: 'Phone', key: 'phone', placeholder: '+94771234567' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                <input className="input" placeholder={f.placeholder}
                  value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password <span className="text-gray-400 font-normal">(leave blank to auto-generate)</span></label>
              <div className="relative">
                <input className="input pr-10" placeholder="Min 8 characters" type={showPwd ? 'text' : 'password'}
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Select Plan</h3>
            {[
              { id: 'STARTER', label: 'Starter', price: 'Rs.2,999/mo', desc: '3 users, 1 branch, basic POS + repairs' },
              { id: 'PRO', label: 'Pro', price: 'Rs.4,999/mo', desc: '10 users, 3 branches, analytics, warranties' },
              { id: 'ENTERPRISE', label: 'Enterprise', price: 'Rs.14,399/mo', desc: 'Unlimited users, API access, white-label' },
            ].map(p => (
              <label key={p.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.plan === p.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="plan" value={p.id} checked={form.plan === p.id} onChange={() => setForm({ ...form, plan: p.id })} className="accent-gray-900" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{p.label}</p>
                    <p className="text-sm font-bold text-gray-800">{p.price}</p>
                  </div>
                  <p className="text-xs text-gray-500">{p.desc}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Auto-Provisioning</h3>
            <p className="text-sm text-gray-500">The following will be created automatically:</p>
            {[
              { label: 'PostgreSQL schema', detail: `schema: ${form.shopName.toLowerCase().replace(/\s/g, '_') || 'tenant_xxx'}`, done: true },
              { label: 'Keycloak realm', detail: `realm: ${form.shopName.toLowerCase().replace(/\s/g, '-') || 'tenant-xxx'}`, done: true },
              { label: 'Default roles & permissions', detail: 'Owner, Manager, Cashier, Technician', done: true },
              { label: 'Welcome email', detail: `to ${form.email || 'owner@shop.com'}`, done: false },
              { label: 'WhatsApp credentials', detail: form.phone ? `send manually to ${form.phone} after onboard` : 'add owner phone to enable', done: !!form.phone.trim() },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className="text-white text-[10px] font-bold">✓</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-800">{item.label}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="py-2">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">Tenant Onboarded!</h3>
              <p className="text-sm text-gray-500">{form.shopName} is now active on {form.plan} plan.</p>
              {result?.whatsappSent && form.phone.trim() && (
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                  <CheckCircle size={13} /> Login credentials sent to {form.phone} via WhatsApp
                </div>
              )}
            </div>

            {shareMessage && (
              <div className="rounded-xl border border-[#b8e6b0] overflow-hidden shadow-sm">
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#075e54] text-white">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <MessageCircle size={14} />
                    Share with owner
                  </div>
                  <span className="text-[10px] text-white/70">WhatsApp ready</span>
                </div>

                <div className="bg-[#e5ddd5] p-4">
                  <div className="bg-[#dcf8c6] rounded-2xl rounded-tr-sm shadow-sm border border-[#c8e8b0] p-4 max-h-72 overflow-y-auto ml-6 relative">
                    <div className="absolute -right-1 top-3 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-[#dcf8c6]" />
                    <WhatsAppMessagePreview message={shareMessage} />
                    <p className="text-[10px] text-gray-500 text-right mt-3 mb-0">Just now ✓✓</p>
                  </div>
                </div>
              </div>
            )}

            {shareMessage && (
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <button type="button" onClick={copyShareMessage}
                  className="btn-secondary flex-1 justify-center text-sm">
                  {copied ? <><CheckCheck size={14} className="text-green-600" /> Copied!</> : <><Copy size={14} /> Copy message</>}
                </button>
                {form.phone.trim() && (
                  <button
                    type="button"
                    onClick={sendViaWhatsAppApi}
                    disabled={sendingWa}
                    className="btn-primary flex-1 justify-center text-sm disabled:opacity-60"
                    style={{ background: '#25D366', borderColor: '#25D366' }}
                  >
                    <MessageCircle size={14} />
                    {sendingWa ? 'Sending…' : result?.whatsappSent ? 'Resend via WhatsApp' : 'Send via WhatsApp'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600 mt-3 text-center">{error}</p>}
        <div className="flex justify-between mt-6">
          <button onClick={onClose} className="btn-secondary">
            {step === 4 ? 'Close' : 'Cancel'}
          </button>
          {step < 4 && (
            <button
              onClick={step === 3 ? provision : () => setStep(s => s + 1)}
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Provisioning…' : step === 3 ? 'Provision Tenant' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
