'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  X,
  Ban,
  Mail,
} from 'lucide-react'
import {
  fetchFashionBillingSummary,
  fetchFashionPlans,
  fetchFashionTenants,
  updateFashionTenant,
  updateFashionPlan,
  sendFashionInvoice,
  type FashionPlanRow,
  type FashionTenantRow,
} from '@/lib/fashion-api'
import {
  salonPlatform,
  fetchSalonTenants,
  fetchSalonStats,
  type SalonInvoiceRow,
  type SalonPlanRow,
  type SalonTenantRow,
} from '@/lib/salon-api'
import { formatMoney as fmtMoney } from '@/lib/format-money'

type HubProductKind = 'fashion' | 'salon'

type Tab = 'overview' | 'tenants' | 'invoices' | 'plans'

function fmtDate(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })
}

function badge(status: string) {
  const s = status.toUpperCase()
  if (['ACTIVE', 'PAID', 'SUCCESS'].includes(s)) return 'badge-green'
  if (['TRIAL', 'DRAFT', 'ISSUED', 'DUE', 'PENDING'].includes(s)) return 'badge-yellow'
  if (['SUSPENDED', 'CANCELLED', 'OVERDUE', 'TRIAL_EXPIRED', 'FAILED'].includes(s)) return 'badge-red'
  if (['ENTERPRISE', 'PROFESSIONAL', 'PRO'].includes(s)) return 'badge-brand'
  return 'badge-gray'
}

const FASHION_PLANS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const
const FASHION_STATUSES = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'] as const
const SALON_PLANS = ['trial', 'basic', 'pro', 'enterprise'] as const
const SALON_STATUSES = ['active', 'suspended', 'cancelled'] as const

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function HubSubscriptionsManage({ product }: { product: HubProductKind }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('ALL')

  // Fashion
  const [billing, setBilling] = useState<Awaited<ReturnType<typeof fetchFashionBillingSummary>> | null>(null)
  const [fashionTenants, setFashionTenants] = useState<FashionTenantRow[]>([])
  const [fashionPlans, setFashionPlans] = useState<FashionPlanRow[]>([])

  // Salon
  const [salonStats, setSalonStats] = useState<Awaited<ReturnType<typeof fetchSalonStats>> | null>(null)
  const [salonTenants, setSalonTenants] = useState<SalonTenantRow[]>([])
  const [salonPlans, setSalonPlans] = useState<SalonPlanRow[]>([])
  const [salonInvoices, setSalonInvoices] = useState<SalonInvoiceRow[]>([])

  // Modals
  const [editTenant, setEditTenant] = useState<FashionTenantRow | SalonTenantRow | null>(null)
  const [editPlan, setEditPlan] = useState<FashionPlanRow | SalonPlanRow | null>(null)
  const [invoiceTenant, setInvoiceTenant] = useState<FashionTenantRow | SalonTenantRow | null>(null)
  const [draftPlan, setDraftPlan] = useState('')
  const [draftStatus, setDraftStatus] = useState('')
  const [draftMonths, setDraftMonths] = useState(1)
  const [planPrice, setPlanPrice] = useState('')
  const [planName, setPlanName] = useState('')
  const [planFeatures, setPlanFeatures] = useState('')
  const [trialDays, setTrialDays] = useState('14')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (product === 'fashion') {
        const [b, t, p] = await Promise.all([
          fetchFashionBillingSummary(),
          fetchFashionTenants(),
          fetchFashionPlans(),
        ])
        setBilling(b)
        setFashionTenants(t.data)
        setFashionPlans(Array.isArray(p) ? p : [])
      } else {
        const [stats, t, p, inv] = await Promise.all([
          fetchSalonStats(),
          fetchSalonTenants({ limit: '200' }),
          salonPlatform.plans(),
          salonPlatform.invoices({ limit: '100' }),
        ])
        setSalonStats(stats)
        setSalonTenants(t.data)
        setSalonPlans(Array.isArray(p) ? p : [])
        setSalonInvoices(inv.invoices)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }, [product])

  useEffect(() => {
    reload()
  }, [reload])

  async function run(label: string, fn: () => Promise<unknown>, success = 'Saved') {
    setBusy(label)
    setError('')
    setMsg('')
    try {
      await fn()
      setMsg(success)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy('')
    }
  }

  const tenants = product === 'fashion' ? fashionTenants : salonTenants

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tenants.filter((t) => {
      const plan = String(t.plan || '')
      if (planFilter !== 'ALL' && plan.toUpperCase() !== planFilter.toUpperCase()) return false
      if (!q) return true
      const hay = [
        t.name,
        'subdomain' in t ? t.subdomain : '',
        'slug' in t ? t.slug : '',
        t.email,
        plan,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [tenants, search, planFilter])

  const fashionInvoices = billing?.recentInvoices ?? []

  const kpi =
    product === 'fashion'
      ? [
          { label: 'MRR', value: fmtMoney(billing?.mrr ?? 0), icon: DollarSign },
          { label: 'ARR', value: fmtMoney(billing?.arr ?? 0), icon: TrendingUp },
          { label: 'Active', value: billing?.activeTenants ?? 0, icon: CheckCircle },
          { label: 'Trials', value: billing?.trialTenants ?? 0, icon: Users },
        ]
      : [
          { label: 'Est. MRR', value: fmtMoney(salonStats?.estimatedMrr ?? 0), icon: DollarSign },
          { label: 'Tenants', value: salonStats?.totalTenants ?? salonTenants.length, icon: Users },
          { label: 'Paid', value: salonStats?.activePaid ?? 0, icon: CheckCircle },
          { label: 'Trials', value: salonStats?.activeTrials ?? 0, icon: Clock },
        ]

  const planFilters =
    product === 'fashion' ? (['ALL', ...FASHION_PLANS] as string[]) : (['ALL', ...SALON_PLANS] as string[])

  function openEdit(t: FashionTenantRow | SalonTenantRow) {
    setEditTenant(t)
    setDraftPlan(String(t.plan || (product === 'fashion' ? 'STARTER' : 'trial')))
    setDraftStatus(String(t.status || (product === 'fashion' ? 'ACTIVE' : 'active')))
    setTrialDays('14')
  }

  function openPlanEdit(p: FashionPlanRow | SalonPlanRow) {
    setEditPlan(p)
    if (product === 'fashion') {
      const fp = p as FashionPlanRow
      setPlanName(fp.name || fp.key)
      setPlanPrice(String(fp.price ?? 0))
      setPlanFeatures((fp.features || []).join('\n'))
    } else {
      const sp = p as SalonPlanRow
      setPlanName(sp.label || sp.key)
      setPlanPrice(sp.price_display || '')
      setPlanFeatures((sp.features || []).join('\n'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {product === 'fashion' ? 'Fashion' : 'Salon'} · Subscriptions & Billing
          </h2>
          <p className="text-sm text-gray-500">
            Manage plans, tenant billing status, and invoices
          </p>
        </div>
        <button type="button" onClick={reload} className="btn-secondary inline-flex items-center gap-1.5" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">{msg}</div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpi.map((k) => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                <Icon size={16} className="text-gray-400" />
              </div>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{k.value}</p>
            </div>
          )
        })}
      </div>

      <div className="flex gap-0 border-b border-gray-200">
        {([
          ['overview', 'Overview'],
          ['tenants', 'Tenants'],
          ['invoices', 'Invoices'],
          ['plans', 'Plans'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'overview' && (
            <div className="grid xl:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Revenue by plan</h3>
                {product === 'fashion' ? (
                  <div className="space-y-2">
                    {Object.entries(billing?.byPlan || {}).map(([plan, row]) => (
                      <div key={plan} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={badge(plan)}>{plan}</span>
                          <span className="text-xs text-gray-400">{row.count} tenants</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{fmtMoney(row.mrr)}</span>
                      </div>
                    ))}
                    {!Object.keys(billing?.byPlan || {}).length && (
                      <p className="text-sm text-gray-400 text-center py-6">No plan data</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(salonStats?.byPlan || {}).map(([plan, count]) => (
                      <div key={plan} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <span className={badge(plan)}>{plan}</span>
                        <span className="text-sm font-semibold text-gray-900">{count}</span>
                      </div>
                    ))}
                    {!Object.keys(salonStats?.byPlan || {}).length && (
                      <p className="text-sm text-gray-400 text-center py-6">No plan data</p>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick actions</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>· Open <strong>Tenants</strong> to change plan / suspend / activate</li>
                  <li>· Open <strong>Invoices</strong> to mark paid or email</li>
                  <li>· Open <strong>Plans</strong> to edit catalog prices & features</li>
                </ul>
                {product === 'fashion' && billing?.trialExpiringSoon != null && (
                  <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {billing.trialExpiringSoon} trial(s) expiring within 7 days
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === 'tenants' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="input pl-8 text-sm"
                    placeholder="Search shop…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {planFilters.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlanFilter(p)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium ${
                        planFilter === p ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'
                      }`}
                    >
                      {p === 'ALL' ? 'All' : p}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400 ml-auto">{filteredTenants.length} results</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Shop</th>
                      <th className="px-4 py-2.5 font-medium">Plan</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Trial / Period</th>
                      <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTenants.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                          No tenants
                        </td>
                      </tr>
                    )}
                    {filteredTenants.map((t) => {
                      const id = String(t.id)
                      const slug = 'subdomain' in t ? t.subdomain : 'slug' in t ? t.slug : ''
                      const trial =
                        'trialEndsAt' in t
                          ? t.trialEndsAt
                          : 'trial_ends_at' in t
                            ? t.trial_ends_at
                            : 'subscription' in t
                              ? t.subscription?.current_period_end
                              : null
                      return (
                        <tr key={id} className="hover:bg-gray-50/80 group">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900">{t.name}</p>
                            <p className="text-xs text-gray-400">
                              {slug}
                              {t.email ? ` · ${t.email}` : ''}
                            </p>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={badge(String(t.plan || ''))}>{t.plan || '—'}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={badge(String(t.status || ''))}>{t.status || '—'}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{fmtDate(trial as string | null)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="text-[11px] px-2 py-1 rounded-lg text-brand-600 hover:bg-brand-50 font-medium inline-flex items-center gap-1"
                                onClick={() => openEdit(t)}
                              >
                                <ArrowUpDown size={11} /> Plan
                              </button>
                              <button
                                type="button"
                                className="text-[11px] px-2 py-1 rounded-lg text-emerald-600 hover:bg-emerald-50 font-medium inline-flex items-center gap-1"
                                onClick={() => {
                                  setInvoiceTenant(t)
                                  setDraftMonths(1)
                                }}
                              >
                                <FileText size={11} /> Invoice
                              </button>
                              {product === 'fashion' ? (
                                String(t.status).toUpperCase() === 'SUSPENDED' ? (
                                  <button
                                    type="button"
                                    className="text-[11px] px-2 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50 font-medium"
                                    disabled={!!busy}
                                    onClick={() =>
                                      run(`act-${id}`, () => updateFashionTenant(id, { status: 'ACTIVE' }), 'Activated')
                                    }
                                  >
                                    Activate
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="text-[11px] px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 font-medium inline-flex items-center gap-1"
                                    disabled={!!busy}
                                    onClick={() => {
                                      if (!window.confirm(`Suspend ${t.name}?`)) return
                                      run(`sus-${id}`, () => updateFashionTenant(id, { status: 'SUSPENDED' }), 'Suspended')
                                    }}
                                  >
                                    <Ban size={11} /> Suspend
                                  </button>
                                )
                              ) : String(t.status) === 'suspended' ? (
                                <button
                                  type="button"
                                  className="text-[11px] px-2 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50 font-medium"
                                  disabled={!!busy}
                                  onClick={() =>
                                    run(`act-${id}`, () => salonPlatform.updateTenant(id, { status: 'active' }), 'Activated')
                                  }
                                >
                                  Activate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="text-[11px] px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 font-medium inline-flex items-center gap-1"
                                  disabled={!!busy}
                                  onClick={() => {
                                    if (!window.confirm(`Suspend ${t.name}?`)) return
                                    run(
                                      `sus-${id}`,
                                      () => salonPlatform.updateTenant(id, { status: 'suspended' }),
                                      'Suspended',
                                    )
                                  }}
                                >
                                  <Ban size={11} /> Suspend
                                </button>
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
          )}

          {tab === 'invoices' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Tenant</th>
                      <th className="px-4 py-2.5 font-medium">Plan</th>
                      <th className="px-4 py-2.5 font-medium">Amount</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Due</th>
                      {product === 'salon' && <th className="px-4 py-2.5 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {product === 'fashion' &&
                      fashionInvoices.map((inv, i) => (
                        <tr key={`${inv.tenantId}-${i}`} className="hover:bg-gray-50/80">
                          <td className="px-4 py-2.5 font-medium text-gray-900">{inv.tenantName}</td>
                          <td className="px-4 py-2.5">
                            <span className={badge(inv.plan)}>{inv.plan}</span>
                          </td>
                          <td className="px-4 py-2.5">{fmtMoney(inv.amount)}</td>
                          <td className="px-4 py-2.5">
                            <span className={badge(inv.status)}>{inv.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{fmtDate(inv.dueDate)}</td>
                        </tr>
                      ))}
                    {product === 'salon' &&
                      salonInvoices.map((inv) => (
                        <tr key={String(inv.id)} className="hover:bg-gray-50/80 group">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900">{inv.tenant?.name || inv.tenant_id}</p>
                            <p className="text-xs text-gray-400">{inv.invoice_number || `#${inv.id}`}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={badge(String(inv.plan || ''))}>{inv.plan || '—'}</span>
                          </td>
                          <td className="px-4 py-2.5">{fmtMoney(Number(inv.total ?? inv.amount ?? 0))}</td>
                          <td className="px-4 py-2.5">
                            <span className={badge(String(inv.status || ''))}>{inv.status || '—'}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{fmtDate(inv.due_at || inv.issued_at)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end gap-1">
                              {String(inv.status) !== 'paid' && (
                                <button
                                  type="button"
                                  className="text-[11px] px-2 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50 font-medium"
                                  disabled={!!busy}
                                  onClick={() =>
                                    run(
                                      `paid-${inv.id}`,
                                      () =>
                                        salonPlatform.updateInvoice(inv.id, {
                                          status: 'paid',
                                          paid_at: new Date().toISOString(),
                                        }),
                                      'Marked paid',
                                    )
                                  }
                                >
                                  Mark paid
                                </button>
                              )}
                              <button
                                type="button"
                                className="text-[11px] px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-50 font-medium inline-flex items-center gap-1"
                                disabled={!!busy}
                                onClick={() =>
                                  run(`email-${inv.id}`, () => salonPlatform.emailInvoice(inv.id), 'Invoice emailed')
                                }
                              >
                                <Mail size={11} /> Email
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {((product === 'fashion' && !fashionInvoices.length) ||
                      (product === 'salon' && !salonInvoices.length)) && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                          No invoices
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'plans' && (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {(product === 'fashion' ? fashionPlans : salonPlans).map((p) => {
                const key = product === 'fashion' ? (p as FashionPlanRow).key : (p as SalonPlanRow).key
                const title =
                  product === 'fashion'
                    ? (p as FashionPlanRow).name || key
                    : (p as SalonPlanRow).label || key
                const price =
                  product === 'fashion'
                    ? fmtMoney(Number((p as FashionPlanRow).price ?? 0))
                    : (p as SalonPlanRow).price_display || '—'
                const feats =
                  product === 'fashion'
                    ? (p as FashionPlanRow).features || []
                    : (p as SalonPlanRow).features || []
                return (
                  <div key={String((p as { id?: string }).id || key)} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{title}</p>
                        <p className="text-xs text-gray-400 font-mono">{key}</p>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary text-xs inline-flex items-center gap-1"
                        onClick={() => openPlanEdit(p)}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{price}</p>
                    <ul className="mt-3 space-y-1">
                      {feats.slice(0, 5).map((f) => (
                        <li key={f} className="text-xs text-gray-500 flex items-center gap-1">
                          <CheckCircle size={10} className="text-gray-400" /> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
              {!(product === 'fashion' ? fashionPlans : salonPlans).length && (
                <p className="text-sm text-gray-400 col-span-full text-center py-10">No plans configured</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Change plan / status modal */}
      {editTenant && (
        <ModalShell title={`Manage · ${editTenant.name}`} onClose={() => setEditTenant(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
              <select className="input" value={draftPlan} onChange={(e) => setDraftPlan(e.target.value)}>
                {(product === 'fashion' ? FASHION_PLANS : SALON_PLANS).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select className="input" value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
                {(product === 'fashion' ? FASHION_STATUSES : SALON_STATUSES).map((s) => (
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
              <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setEditTenant(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1 justify-center"
                disabled={!!busy}
                onClick={() =>
                  run(
                    'save-tenant',
                    async () => {
                      const id = editTenant.id
                      if (product === 'fashion') {
                        await updateFashionTenant(String(id), {
                          plan: draftPlan,
                          status: draftStatus,
                        })
                      } else {
                        await salonPlatform.updateTenant(id, {
                          plan: draftPlan,
                          status: draftStatus,
                        })
                        if (draftPlan === 'trial' && Number(trialDays) > 0) {
                          await salonPlatform.adjustTrial(id, { days: Number(trialDays) })
                        }
                      }
                    },
                    'Tenant updated',
                  ).then(() => setEditTenant(null))
                }
              >
                {busy === 'save-tenant' ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Invoice modal */}
      {invoiceTenant && (
        <ModalShell title={`Invoice · ${invoiceTenant.name}`} onClose={() => setInvoiceTenant(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Months</label>
              <div className="flex gap-2">
                {[1, 3, 6, 12].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDraftMonths(m)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${
                      draftMonths === m ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {m}mo
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {product === 'fashion'
                ? 'Emails the subscription invoice to the shop owner.'
                : 'Creates a platform invoice for this salon package.'}
            </p>
            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setInvoiceTenant(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1 justify-center"
                disabled={!!busy}
                onClick={() =>
                  run(
                    'invoice',
                    async () => {
                      if (product === 'fashion') {
                        await sendFashionInvoice(String(invoiceTenant.id), { months: draftMonths })
                      } else {
                        await salonPlatform.createInvoice({
                          tenant_id: invoiceTenant.id,
                          plan: invoiceTenant.plan || 'basic',
                        })
                      }
                    },
                    product === 'fashion' ? 'Invoice emailed' : 'Invoice created',
                  ).then(() => setInvoiceTenant(null))
                }
              >
                {busy === 'invoice' ? <Loader2 size={14} className="animate-spin" /> : 'Create / send'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Edit plan catalog */}
      {editPlan && (
        <ModalShell
          title={`Edit plan · ${product === 'fashion' ? (editPlan as FashionPlanRow).key : (editPlan as SalonPlanRow).key}`}
          onClose={() => setEditPlan(null)}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Display name</label>
              <input className="input" value={planName} onChange={(e) => setPlanName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {product === 'fashion' ? 'Price (number)' : 'Price display'}
              </label>
              <input className="input" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Features (one per line)</label>
              <textarea
                className="input min-h-[100px] text-xs"
                value={planFeatures}
                onChange={(e) => setPlanFeatures(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setEditPlan(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1 justify-center"
                disabled={!!busy}
                onClick={() =>
                  run(
                    'save-plan',
                    async () => {
                      const features = planFeatures
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean)
                      if (product === 'fashion') {
                        const fp = editPlan as FashionPlanRow
                        await updateFashionPlan(fp.key, {
                          name: planName,
                          price: Number(planPrice) || 0,
                          features,
                        })
                      } else {
                        const sp = editPlan as SalonPlanRow
                        await salonPlatform.updatePlan(sp.id, {
                          label: planName,
                          price_display: planPrice,
                          features,
                        })
                      }
                    },
                    'Plan updated',
                  ).then(() => setEditPlan(null))
                }
              >
                {busy === 'save-plan' ? <Loader2 size={14} className="animate-spin" /> : 'Save plan'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  )
}
