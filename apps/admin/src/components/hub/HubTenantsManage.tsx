'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Ban,
  Building2,
  CheckCircle,
  Eye,
  FileText,
  KeyRound,
  Loader2,
  LogOut,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import {
  fetchFashionOverview,
  fetchFashionTenants,
  getFashionTenant,
  updateFashionTenant,
  provisionFashionSsl,
  sendFashionInvoice,
  fashionPlatform,
  type FashionTenantRow,
} from '@/lib/fashion-api'
import {
  fetchSalonStats,
  fetchSalonTenants,
  salonPlatform,
  type SalonTenantRow,
} from '@/lib/salon-api'
import HubOnboardModal from '@/components/hub/HubOnboardModal'

type Product = 'fashion' | 'salon'
type Row = FashionTenantRow | SalonTenantRow

const FASHION_PLANS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'] as const
const FASHION_STATUSES = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'] as const
const SALON_PLANS = ['trial', 'basic', 'pro', 'enterprise'] as const
const SALON_STATUSES = ['active', 'suspended', 'cancelled'] as const

function badge(status: string) {
  const s = status.toUpperCase()
  if (['ACTIVE', 'PAID'].includes(s)) return 'badge-green'
  if (['TRIAL', 'DRAFT', 'PENDING'].includes(s)) return 'badge-yellow'
  if (['SUSPENDED', 'CANCELLED', 'OVERDUE'].includes(s)) return 'badge-red'
  if (['ENTERPRISE', 'PROFESSIONAL', 'PRO'].includes(s)) return 'badge-purple'
  return 'badge-gray'
}

function fmtDate(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })
}

function slugOf(t: Row) {
  return 'subdomain' in t ? t.subdomain : 'slug' in t ? t.slug : ''
}

function trialOf(t: Row) {
  if ('trialEndsAt' in t) return t.trialEndsAt
  if ('trial_ends_at' in t) return t.trial_ends_at
  return null
}

function isActiveLike(status?: string) {
  const s = String(status || '').toUpperCase()
  return s === 'ACTIVE' || s === 'TRIAL'
}

export default function HubTenantsManage({ product }: { product: Product }) {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [planFilter, setPlanFilter] = useState('ALL')
  const [showOnboard, setShowOnboard] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [kpis, setKpis] = useState({ total: 0, active: 0, trial: 0, suspended: 0 })

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [detailStats, setDetailStats] = useState<Record<string, number> | null>(null)
  const [editRow, setEditRow] = useState<Row | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftPlan, setDraftPlan] = useState('')
  const [draftStatus, setDraftStatus] = useState('')
  const [trialDays, setTrialDays] = useState('14')

  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [confirmClear, setConfirmClear] = useState<SalonTenantRow | null>(null)
  const [clearInput, setClearInput] = useState('')

  const [featuresTenant, setFeaturesTenant] = useState<SalonTenantRow | null>(null)
  const [featureKeys, setFeatureKeys] = useState<{ key: string; label?: string }[]>([])
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([])

  const menuRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reload = useCallback(async (opts?: { search?: string; status?: string; plan?: string }) => {
    setLoading(true)
    setError('')
    try {
      const q = opts?.search ?? search
      const status = opts?.status ?? statusFilter
      const plan = opts?.plan ?? planFilter
      const params: Record<string, string> = {}
      if (q.trim()) params.search = q.trim()
      if (status !== 'ALL') params.status = status
      if (plan !== 'ALL') params.plan = plan

      if (product === 'fashion') {
        const [list, overview] = await Promise.all([
          fetchFashionTenants(params),
          fetchFashionOverview().catch(() => null),
        ])
        setRows(list.data)
        setTotal(list.total)
        setKpis({
          total: overview?.stats.totalTenants ?? list.total,
          active: overview?.stats.activeTenants ?? list.data.filter((t) => t.status === 'ACTIVE').length,
          trial: overview?.stats.trialTenants ?? list.data.filter((t) => t.status === 'TRIAL').length,
          suspended:
            overview?.stats.suspendedTenants ??
            list.data.filter((t) => t.status === 'SUSPENDED').length,
        })
      } else {
        const [list, stats] = await Promise.all([
          fetchSalonTenants({ ...params, limit: '200' }),
          fetchSalonStats().catch(() => null),
        ])
        setRows(list.data)
        setTotal(list.total)
        setKpis({
          total: stats?.totalTenants ?? list.total,
          active: stats?.activePaid ?? list.data.filter((t) => t.status === 'active' && t.plan !== 'trial').length,
          trial: stats?.activeTrials ?? list.data.filter((t) => t.plan === 'trial').length,
          suspended: stats?.suspended ?? list.data.filter((t) => t.status === 'suspended').length,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }, [product, search, statusFilter, planFilter])

  useEffect(() => {
    reload()
  }, [product]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function handleSearch(v: string) {
    setSearch(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => reload({ search: v }), 350)
  }

  async function run(label: string, fn: () => Promise<unknown>, success = 'Done') {
    setBusy(label)
    setError('')
    setMsg('')
    setMenuOpen(null)
    try {
      const result = await fn()
      if (result && typeof result === 'object') {
        const o = result as Record<string, unknown>
        if (typeof o.loginUrl === 'string') {
          setMsg(`Impersonation ready`)
          window.open(o.loginUrl, '_blank', 'noopener,noreferrer')
        } else if (typeof o.token === 'string') {
          await navigator.clipboard.writeText(o.token)
          setMsg(`Impersonation token copied for ${String((o.tenant as { slug?: string })?.slug || 'tenant')}`)
        } else if (typeof o.message === 'string') {
          setMsg(o.message)
        } else {
          setMsg(success)
        }
      } else {
        setMsg(success)
      }
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy('')
    }
  }

  async function openDetail(t: Row) {
    setBusy(`detail-${t.id}`)
    setError('')
    try {
      if (product === 'fashion') {
        const d = await getFashionTenant(String(t.id))
        setDetail(d as Record<string, unknown>)
        setDetailStats(null)
      } else {
        const [d, s] = await Promise.all([
          salonPlatform.getTenant(t.id),
          salonPlatform.tenantStats(t.id).catch(() => null),
        ])
        setDetail(d as Record<string, unknown>)
        setDetailStats(s)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tenant')
    } finally {
      setBusy('')
      setMenuOpen(null)
    }
  }

  function openEdit(t: Row) {
    setEditRow(t)
    setDraftName(t.name)
    setDraftPlan(String(t.plan || (product === 'fashion' ? 'STARTER' : 'trial')))
    setDraftStatus(String(t.status || (product === 'fashion' ? 'ACTIVE' : 'active')))
    setTrialDays('14')
    setMenuOpen(null)
  }

  async function openFeatures(t: SalonTenantRow) {
    setBusy(`feat-${t.id}`)
    try {
      const f = await salonPlatform.getFeatures(t.id)
      const catalog = (f.catalog || []).map((c) =>
        typeof c === 'string' ? { key: c, label: c } : { key: c.key, label: c.label || c.key },
      )
      setFeatureKeys(catalog)
      setEnabledFeatures(f.enabled_features || f.effective || [])
      setFeaturesTenant(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load features')
    } finally {
      setBusy('')
      setMenuOpen(null)
    }
  }

  const filtered = useMemo(() => rows, [rows])

  const plans = product === 'fashion' ? FASHION_PLANS : SALON_PLANS
  const statuses = product === 'fashion' ? FASHION_STATUSES : SALON_STATUSES

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {product === 'fashion' ? 'Fashion' : 'Salon'} tenants
          </h2>
          <p className="text-sm text-gray-500">
            {loading ? 'Loading…' : `${total.toLocaleString()} tenants · full manage`}
          </p>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button type="button" onClick={() => reload()} disabled={loading} className="btn-secondary text-sm">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" onClick={() => setShowOnboard(true)} className="btn-primary text-sm">
            <Plus size={14} /> Onboard tenant
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 break-all">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: kpis.total, icon: Building2, color: 'text-gray-600', bg: 'bg-gray-100' },
          { label: 'Active', value: kpis.active, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Trial', value: kpis.trial, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Suspended', value: kpis.suspended, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center`}>
              <k.icon size={15} className={k.color} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{k.label}</p>
              <p className="text-xl font-bold text-gray-900 leading-none mt-0.5">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-gray-400" />
          <input
            className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1"
            placeholder="Search name, slug, email…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-auto text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            reload({ status: e.target.value })
          }}
        >
          <option value="ALL">All status</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="input w-auto text-sm"
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value)
            reload({ plan: e.target.value })
          }}
        >
          <option value="ALL">All plans</option>
          {plans.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" ref={menuRef}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Shop</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Trial / period</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <RefreshCw size={18} className="animate-spin mx-auto" />
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    No tenants match your filters
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((t) => {
                  const id = String(t.id)
                  const suspended = String(t.status || '').toUpperCase() === 'SUSPENDED'
                  return (
                    <tr key={id} className={`hover:bg-gray-50/80 ${busy.includes(id) ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gray-900 text-white text-[11px] font-bold flex items-center justify-center">
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-xs truncate">{t.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono truncate">
                              {slugOf(t)}
                              {t.email ? ` · ${t.email}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={badge(String(t.plan || ''))}>{t.plan || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={badge(String(t.status || ''))}>{t.status || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(trialOf(t))}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {'_count' in t ? (t as FashionTenantRow)._count?.users ?? '—' : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(t.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="relative inline-flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            onClick={() => openDetail(t)}
                            title="View details"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                            onClick={() => setMenuOpen(menuOpen === id ? null : id)}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {menuOpen === id && (
                            <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-30 text-left">
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                onClick={() => openDetail(t)}
                              >
                                <Eye size={13} /> View details
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                onClick={() => openEdit(t)}
                              >
                                <Wrench size={13} /> Edit plan / status
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                disabled={!!busy}
                                onClick={() =>
                                  run(`imp-${id}`, () =>
                                    product === 'fashion'
                                      ? fashionPlatform.impersonate(id)
                                      : salonPlatform.impersonate(id),
                                  )
                                }
                              >
                                <KeyRound size={13} /> Impersonate
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                disabled={!!busy}
                                onClick={() => {
                                  if (!window.confirm(`Revoke all sessions for ${t.name}?`)) return
                                  run(
                                    `rev-${id}`,
                                    () =>
                                      product === 'fashion'
                                        ? fashionPlatform.revokeSessions(id)
                                        : salonPlatform.revokeSessions(id),
                                    'Sessions revoked',
                                  )
                                }}
                              >
                                <LogOut size={13} /> Revoke sessions
                              </button>
                              {product === 'fashion' && (
                                <>
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                    disabled={!!busy}
                                    onClick={() =>
                                      run(`inv-${id}`, () => sendFashionInvoice(id, { months: 1 }), 'Invoice sent')
                                    }
                                  >
                                    <FileText size={13} /> Send invoice
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                    disabled={!!busy}
                                    onClick={() =>
                                      run(`ssl-${id}`, () => provisionFashionSsl(id), 'SSL provision queued')
                                    }
                                  >
                                    <Shield size={13} /> Provision SSL
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                    disabled={!!busy}
                                    onClick={() =>
                                      run(`dbg-${id}`, () => fashionPlatform.tenantDebug(id), 'Debug loaded')
                                    }
                                  >
                                    <Wrench size={13} /> Debug dump
                                  </button>
                                </>
                              )}
                              {product === 'salon' && (
                                <>
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                    onClick={() => openFeatures(t as SalonTenantRow)}
                                  >
                                    <Shield size={13} /> Features
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                    onClick={() => {
                                      setConfirmClear(t as SalonTenantRow)
                                      setClearInput('')
                                      setMenuOpen(null)
                                    }}
                                  >
                                    <Trash2 size={13} /> Clear trial data
                                  </button>
                                </>
                              )}
                              <div className="border-t border-gray-100 mt-1 pt-1">
                                {suspended || !isActiveLike(t.status) ? (
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50"
                                    disabled={!!busy}
                                    onClick={() =>
                                      run(
                                        `act-${id}`,
                                        () =>
                                          product === 'fashion'
                                            ? updateFashionTenant(id, { status: 'ACTIVE' })
                                            : salonPlatform.quickStatus(id, 'activate'),
                                        'Activated',
                                      )
                                    }
                                  >
                                    <CheckCircle size={13} /> Activate
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50"
                                    disabled={!!busy}
                                    onClick={() =>
                                      run(
                                        `sus-${id}`,
                                        () =>
                                          product === 'fashion'
                                            ? updateFashionTenant(id, { status: 'SUSPENDED' })
                                            : salonPlatform.quickStatus(id, 'suspend'),
                                        'Suspended',
                                      )
                                    }
                                  >
                                    <Ban size={13} /> Suspend
                                  </button>
                                )}
                              </div>
                              <div className="border-t border-gray-100 mt-1 pt-1">
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                  onClick={() => {
                                    setConfirmDelete(t)
                                    setDeleteInput('')
                                    setMenuOpen(null)
                                  }}
                                >
                                  <Trash2 size={13} /> Cancel / delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setDetail(null)}>
          <div
            className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">{String(detail.name || 'Tenant')}</h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {String(detail.subdomain || detail.slug || detail.id)}
                </p>
              </div>
              <button type="button" className="p-1 rounded-lg text-gray-400 hover:bg-gray-100" onClick={() => setDetail(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={badge(String(detail.plan || ''))}>{String(detail.plan || '—')}</span>
              <span className={badge(String(detail.status || ''))}>{String(detail.status || '—')}</span>
            </div>
            <dl className="space-y-2 text-sm">
              {(
                [
                  ['Email', detail.email],
                  ['Phone', detail.phone],
                  ['Shop type', detail.shopType],
                  ['Currency', detail.currency],
                  ['Created', detail.createdAt ? fmtDate(String(detail.createdAt)) : null],
                  ['Trial ends', detail.trialEndsAt || detail.trial_ends_at],
                ] as [string, unknown][]
              ).map(([label, value]) =>
                value != null && value !== '' ? (
                  <div key={label} className="flex justify-between gap-3 border-b border-gray-50 py-2">
                    <dt className="text-xs text-gray-400">{label}</dt>
                    <dd className="text-xs font-medium text-gray-900 text-right break-all">{String(value)}</dd>
                  </div>
                ) : null,
              )}
            </dl>
            {detailStats && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {Object.entries(detailStats).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                    <p className="text-[10px] uppercase text-gray-400">{k}</p>
                    <p className="text-sm font-bold text-gray-900">{v}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => openEdit(detail as unknown as Row)}>
                Edit
              </button>
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={!!busy}
                onClick={() =>
                  run(`imp-${detail.id}`, () =>
                    product === 'fashion'
                      ? fashionPlatform.impersonate(String(detail.id))
                      : salonPlatform.impersonate(detail.id as string | number),
                  )
                }
              >
                Impersonate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editRow && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Edit · {editRow.name}</h3>
              <button type="button" onClick={() => setEditRow(null)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
                <X size={15} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input className="input" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
                <select className="input" value={draftPlan} onChange={(e) => setDraftPlan(e.target.value)}>
                  {plans.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select className="input" value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {product === 'salon' && draftPlan === 'trial' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Extend trial (days)</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                  />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setEditRow(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1 justify-center"
                  disabled={!!busy}
                  onClick={() =>
                    run(
                      'save',
                      async () => {
                        if (product === 'fashion') {
                          await updateFashionTenant(String(editRow.id), {
                            name: draftName,
                            plan: draftPlan,
                            status: draftStatus,
                          })
                        } else {
                          await salonPlatform.updateTenant(editRow.id, {
                            name: draftName,
                            plan: draftPlan,
                            status: draftStatus,
                          })
                          if (draftPlan === 'trial' && Number(trialDays) > 0) {
                            await salonPlatform.adjustTrial(editRow.id, { days: Number(trialDays) })
                          }
                        }
                      },
                      'Tenant updated',
                    ).then(() => {
                      setEditRow(null)
                      setDetail(null)
                    })
                  }
                >
                  {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete / cancel confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Cancel tenant</h3>
            <p className="text-xs text-gray-500 mb-3">
              Type <strong className="text-gray-800">{confirmDelete.name}</strong> to confirm. This sets status to
              cancelled / cancelled.
            </p>
            <input
              className="input mb-3"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={confirmDelete.name}
            />
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setConfirmDelete(null)}>
                Back
              </button>
              <button
                type="button"
                className="btn-danger flex-1 justify-center"
                disabled={deleteInput !== confirmDelete.name || !!busy}
                onClick={() =>
                  run(
                    'delete',
                    async () => {
                      if (product === 'fashion') {
                        await updateFashionTenant(String(confirmDelete.id), { status: 'CANCELLED' })
                      } else {
                        await salonPlatform.deleteTenant(confirmDelete.id)
                      }
                    },
                    'Tenant cancelled',
                  ).then(() => setConfirmDelete(null))
                }
              >
                {busy === 'delete' ? <Loader2 size={14} className="animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear salon data */}
      {confirmClear && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Clear trial data</h3>
            <p className="text-xs text-gray-500 mb-3">
              Type slug <strong className="font-mono text-gray-800">{confirmClear.slug}</strong> to wipe operational
              data (keeps login accounts).
            </p>
            <input
              className="input mb-3 font-mono"
              value={clearInput}
              onChange={(e) => setClearInput(e.target.value)}
              placeholder={confirmClear.slug}
            />
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setConfirmClear(null)}>
                Back
              </button>
              <button
                type="button"
                className="btn-danger flex-1 justify-center"
                disabled={clearInput !== confirmClear.slug || !!busy}
                onClick={() =>
                  run(
                    'clear',
                    () => salonPlatform.clearTenantData(confirmClear.id, clearInput),
                    'Trial data cleared',
                  ).then(() => setConfirmClear(null))
                }
              >
                {busy === 'clear' ? <Loader2 size={14} className="animate-spin" /> : 'Clear data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Features modal (salon) */}
      {featuresTenant && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl border border-gray-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Features · {featuresTenant.name}</h3>
              <button type="button" onClick={() => setFeaturesTenant(null)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
                <X size={15} />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {featureKeys.length === 0 && (
                <p className="text-xs text-gray-400">No feature catalog returned. You can still save an empty override.</p>
              )}
              {featureKeys.map((f) => {
                const on = enabledFeatures.includes(f.key)
                return (
                  <label
                    key={f.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                  >
                    <span className="text-gray-800">{f.label || f.key}</span>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setEnabledFeatures((prev) =>
                          on ? prev.filter((k) => k !== f.key) : [...prev, f.key],
                        )
                      }
                    />
                  </label>
                )
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1 justify-center text-xs"
                disabled={!!busy}
                onClick={() =>
                  run(
                    'feat-reset',
                    () => salonPlatform.updateFeatures(featuresTenant.id, null),
                    'Features reset to plan defaults',
                  ).then(() => setFeaturesTenant(null))
                }
              >
                Reset defaults
              </button>
              <button
                type="button"
                className="btn-primary flex-1 justify-center text-xs"
                disabled={!!busy}
                onClick={() =>
                  run(
                    'feat-save',
                    () => salonPlatform.updateFeatures(featuresTenant.id, enabledFeatures),
                    'Features saved',
                  ).then(() => setFeaturesTenant(null))
                }
              >
                {busy === 'feat-save' ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOnboard && (
        <HubOnboardModal
          product={product}
          onClose={() => setShowOnboard(false)}
          onCreated={() => reload()}
        />
      )}
    </div>
  )
}
