'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileText,
  LayoutGrid,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  QrCode,
  Shield,
  Sparkles,
  Table2,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Tenant } from '@/types'
import { billingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { calculateHelaposCustomerPayable } from '@/lib/helapos-fees'
import BillingLottie from '@/components/billing/BillingLottie'

export type BillingPlan = {
  key: string
  label: string
  price: string
  period: string
  color: string
  bg: string
  border: string
  features: string[]
  popular?: boolean
  mrr?: number | null
}

type Props = {
  tenant: Tenant | null
  plans: BillingPlan[]
  teamCount: number
  loading?: boolean
  onUpgraded?: () => void
}

const FALLBACK_PLANS: BillingPlan[] = [
  {
    key: 'TRIAL',
    label: 'Trial',
    price: 'Free',
    period: '14 days',
    color: '#eab308',
    bg: 'rgba(234,179,8,0.08)',
    border: 'rgba(234,179,8,0.25)',
    features: ['1 Branch', '2 Users', 'POS & Billing', 'Inventory + IMEI', 'Repairs', 'Basic Reports'],
  },
  {
    key: 'STARTER',
    label: 'Starter',
    price: 'Rs. 2,999',
    period: '/month',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    features: [
      '1 Branch',
      'Up to 5 Users',
      'POS & Billing',
      'Inventory + IMEI',
      'Customers & Credit',
      'Repairs & Warranty',
      'Daily Closing',
      'Basic Reports',
      'WhatsApp Receipts',
    ],
  },
  {
    key: 'PRO',
    label: 'Pro',
    price: 'Rs. 4,999',
    period: '/month',
    color: '#0d9488',
    bg: 'rgba(13,148,136,0.08)',
    border: 'rgba(13,148,136,0.30)',
    features: [
      'Up to 5 Branches',
      'Up to 15 Users',
      'Everything in Starter',
      'Stock Transfer',
      'Suppliers & Purchase Orders',
      'Delivery & Exchanges',
      'P&L / Cash-Flow Reports',
      'Daily Reload',
      'Profit Allocation',
      'Priority Support',
    ],
    popular: true,
  },
  {
    key: 'ENTERPRISE',
    label: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
    features: [
      'Unlimited Branches & Users',
      'Everything in Pro',
      'Full Accounting (GL / AR / AP)',
      'Hire Purchase',
      'Product Traceability',
      'API Access',
      'White-Label',
      'Dedicated Support',
      'Custom Integrations',
    ],
  },
]

const PLAN_LIMITS: Record<string, { branches: number | null; users: number | null }> = {
  TRIAL: { branches: 1, users: 2 },
  STARTER: { branches: 1, users: 5 },
  PRO: { branches: 5, users: 15 },
  ENTERPRISE: { branches: null, users: null },
}

const PLAN_ORDER = ['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE'] as const

function planRank(key: string) {
  const i = PLAN_ORDER.indexOf(key as (typeof PLAN_ORDER)[number])
  return i === -1 ? 0 : i
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  TRIAL: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
}

const SUPPORT_PHONE = '+94703130100'
const SUPPORT_WA = '94703130100'
const SUPPORT_EMAIL = 'support@hexalyte.com'

function fmtDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function daysUntil(value?: string | null) {
  if (!value) return null
  const ms = new Date(value).getTime() - Date.now()
  return Math.ceil(ms / 86400000)
}

function UsageMeter({
  label,
  used,
  limit,
  icon: Icon,
}: {
  label: string
  used: number
  limit: number | null
  icon: typeof Building2
}) {
  const unlimited = limit == null
  const pct = unlimited ? 12 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))
  const over = !unlimited && used > limit
  return (
    <div
      className="rounded-2xl p-4 border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[var(--bg-subtle)] dark:shadow-none"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-50 border border-gray-200 dark:bg-[var(--bg-card)] dark:border-white/10"
          >
            <Icon size={16} className="text-gray-600 dark:text-slate-300" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-slate-400">
              {label}
            </p>
            <p className="text-lg font-bold leading-tight text-gray-900 dark:text-white">
              {used}
              <span className="text-sm font-medium ml-1 text-gray-400 dark:text-slate-500">
                / {unlimited ? '∞' : limit}
              </span>
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            over
              ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'
              : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10'
          }`}
        >
          {unlimited ? 'Unlimited' : over ? 'Over limit' : `${pct}%`}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-white/[0.08]"
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${unlimited ? 18 : pct}%`,
            background: over
              ? '#ef4444'
              : 'linear-gradient(90deg, #10b981, #0d9488)',
          }}
        />
      </div>
    </div>
  )
}

export default function BillingSubscriptionPanel({ tenant, plans, teamCount, loading, onUpgraded }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'cards' | 'compare'>('cards')
  const [upgradePlan, setUpgradePlan] = useState<BillingPlan | null>(null)
  const [helaposEnabled, setHelaposEnabled] = useState(false)
  const [upgradeBusy, setUpgradeBusy] = useState(false)
  const [invoices, setInvoices] = useState<Array<{
    id: string
    invoiceNumber: string
    billingPeriodStart: string
    total: number
    status: string
    effectiveStatus?: string
    paidAt?: string | null
  }>>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [qrSession, setQrSession] = useState<{
    paymentId: string
    amount: number
    reference: string
    mock: boolean
    invoiceNumber: string
    invoiceId: string
    subscriptionAmount?: number
    processingFee?: number
    customerPayableAmount?: number
    feeApplies?: boolean
  } | null>(null)
  const [qrPaid, setQrPaid] = useState(false)

  useEffect(() => {
    billingApi.config()
      .then((r: any) => setHelaposEnabled(!!(r?.data?.helapos?.enabled ?? r?.helapos?.enabled)))
      .catch(() => setHelaposEnabled(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    setInvoicesLoading(true)
    billingApi.overview()
      .then((r: any) => {
        if (cancelled) return
        const data = r?.data ?? r
        const list = Array.isArray(data?.invoices) ? data.invoices : []
        setInvoices(list)
      })
      .catch(() => {
        if (!cancelled) setInvoices([])
      })
      .finally(() => {
        if (!cancelled) setInvoicesLoading(false)
      })
    return () => { cancelled = true }
  }, [tenant?.id, tenant?.mrr, tenant?.plan])

  const downloadInvoice = async (inv: { id: string; invoiceNumber: string }) => {
    setDownloadingId(inv.id)
    try {
      await billingApi.downloadPdf(inv.id, inv.invoiceNumber)
      toast.success('Invoice downloaded')
    } catch (e: any) {
      toast.error(e?.message || 'Download failed')
    } finally {
      setDownloadingId(null)
    }
  }

  useEffect(() => {
    if (!qrSession?.paymentId || qrPaid) return
    let cancelled = false
    const tick = async () => {
      try {
        const res: any = await billingApi.helaposPaymentStatus(qrSession.paymentId)
        const data = res?.data ?? res
        if (cancelled) return
        if (data?.paid || data?.status === 'APPROVED') {
          setQrPaid(true)
          toast.success(`Upgraded to ${upgradePlan?.label ?? 'new plan'}`)
          onUpgraded?.()
        }
      } catch { /* keep polling */ }
    }
    void tick()
    const id = window.setInterval(() => { void tick() }, 3000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [qrSession?.paymentId, qrPaid, upgradePlan?.label, onUpgraded])

  const closeUpgrade = () => {
    setUpgradePlan(null)
    setQrSession(null)
    setQrImage(null)
    setQrPaid(false)
    setUpgradeBusy(false)
  }

  const startUpgradeInvoice = async (targetKey: string) => {
    if (targetKey !== 'STARTER' && targetKey !== 'PRO') {
      throw new Error('Self-serve upgrades support Starter and Pro only')
    }
    const res: any = await billingApi.requestUpgrade(targetKey)
    return res?.data ?? res
  }

  const payUpgradeWithQr = async () => {
    if (!upgradePlan) return
    setUpgradeBusy(true)
    setQrPaid(false)
    setQrSession(null)
    setQrImage(null)
    try {
      const data = await startUpgradeInvoice(upgradePlan.key)
      const inv = data.invoice
      const qrRes: any = await billingApi.createHelaposQr(inv.id)
      const qr = qrRes?.data ?? qrRes
      setQrSession({
        paymentId: qr.paymentId,
        amount: qr.customerPayableAmount ?? qr.amount,
        reference: qr.reference,
        mock: !!qr.mock,
        invoiceNumber: qr.invoiceNumber || inv.invoiceNumber,
        invoiceId: inv.id,
        subscriptionAmount: qr.subscriptionAmount ?? inv.total,
        processingFee: qr.processingFee ?? 0,
        customerPayableAmount: qr.customerPayableAmount ?? qr.amount,
        feeApplies: !!qr.feeApplies,
      })
      const QRCode = (await import('qrcode')).default
      const url = await QRCode.toDataURL(String(qr.qrPayload), { margin: 2, width: 260 })
      setQrImage(url)
      toast.success(data.reused ? 'Continue with existing upgrade invoice' : 'LankaQR ready — scan to pay')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start LankaQR upgrade')
    } finally {
      setUpgradeBusy(false)
    }
  }

  const payUpgradeWithBank = async () => {
    if (!upgradePlan) return
    setUpgradeBusy(true)
    try {
      const data = await startUpgradeInvoice(upgradePlan.key)
      const inv = data.invoice
      toast.success('Upgrade invoice created — complete bank transfer on Billing')
      closeUpgrade()
      router.push(`/dashboard/billing?pay=${encodeURIComponent(inv.id)}`)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create upgrade invoice')
      setUpgradeBusy(false)
    }
  }

  const catalog = plans.length ? plans : FALLBACK_PLANS
  const currentKey = tenant?.plan ?? 'TRIAL'
  const currentPlan = catalog.find((p) => p.key === currentKey) ?? catalog[0]
  const limits = PLAN_LIMITS[currentKey] ?? { branches: null, users: null }
  const branchCount = tenant?.branches?.length ?? 0
  const renewIn = daysUntil(tenant?.subscriptionEndsAt)
  const trialIn = daysUntil(tenant?.trialEndsAt)

  const renewProgress = useMemo(() => {
    if (!tenant?.subscriptionEndsAt || !tenant?.createdAt) return null
    const end = new Date(tenant.subscriptionEndsAt).getTime()
    const start = tenant.trialEndsAt
      ? new Date(tenant.trialEndsAt).getTime()
      : new Date(tenant.createdAt).getTime()
    const now = Date.now()
    if (end <= start) return null
    return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)))
  }, [tenant])

  const allFeatures = useMemo(() => {
    const set = new Set<string>()
    for (const p of catalog) for (const f of p.features) set.add(f)
    return [...set]
  }, [catalog])

  const waUpgrade = (plan: BillingPlan) => {
    const text = encodeURIComponent(
      `Hi Hexalyte, I want to upgrade to the ${plan.label} plan (${plan.price}${plan.period}).\nShop: ${tenant?.name ?? ''}\nEmail: ${tenant?.ownerEmail ?? ''}`,
    )
    return `https://wa.me/${SUPPORT_WA}?text=${text}`
  }

  const canSelfServeUpgrade = (plan: BillingPlan) =>
    plan.key === 'STARTER' || plan.key === 'PRO'

  const upgradeAmountHint = (plan: BillingPlan) => {
    const target = plan.mrr ?? (plan.key === 'PRO' ? 4999 : plan.key === 'STARTER' ? 2999 : null)
    if (target == null) return null
    const current = currentKey === 'TRIAL' ? 0 : (tenant?.mrr ?? currentPlan?.mrr ?? 0)
    const delta = Math.max(0, target - current)
    return delta
  }

  if (loading || !tenant) {
    return (
      <div className="card p-10 flex justify-center">
        <Loader2 size={22} className="animate-spin text-emerald-400" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Hero — matches Settings card language + Revenue Lottie */}
      <section className="card relative overflow-hidden !p-0">
        <div
          className="pointer-events-none absolute -right-6 -top-10 h-44 w-44 rounded-full opacity-40 blur-2xl dark:opacity-25"
          style={{ background: 'rgba(16,185,129,0.22)' }}
        />
        <div className="relative p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25">
                  <CreditCard size={11} /> Billing & Subscription
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md border ${STATUS_STYLE[tenant.status] ?? STATUS_STYLE.ACTIVE}`}>
                  {tenant.status}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                {currentPlan?.label ?? tenant.plan}
                <span className="text-base font-semibold ml-2 text-gray-500 dark:text-slate-400">
                  plan
                </span>
              </h2>
              <p className="text-sm mt-1 text-gray-500 dark:text-slate-400">
                {tenant.name}
                {tenant.ownerEmail ? ` · ${tenant.ownerEmail}` : ''}
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-slate-400">
                    Monthly rate
                  </p>
                  <p className="text-2xl font-black" style={{ color: currentPlan?.color ?? undefined }}>
                    <span className={!currentPlan?.color ? 'text-gray-900 dark:text-white' : undefined}>
                      {tenant.mrr
                        ? formatCurrency(tenant.mrr)
                        : currentPlan?.price ?? '—'}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {currentPlan?.period === 'contact us' ? 'Custom billing' : 'Billed monthly'}
                  </p>
                </div>
              </div>
            </div>

            <div className="w-[100px] h-[100px] sm:w-[140px] sm:h-[140px] shrink-0 mx-auto sm:mx-0" aria-hidden>
              <BillingLottie
                src="/lottie/revenue.json"
                loop
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>

          {/* Renewal timeline */}
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/90 dark:bg-black/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Calendar size={14} className="text-emerald-600 dark:text-emerald-300" />
                {tenant.subscriptionEndsAt
                  ? `Renews ${fmtDate(tenant.subscriptionEndsAt)}`
                  : 'No renewal date set'}
              </div>
              <div className="text-xs font-medium text-gray-500 dark:text-slate-400">
                {renewIn != null
                  ? renewIn < 0
                    ? `${Math.abs(renewIn)} days overdue`
                    : renewIn === 0
                      ? 'Renews today'
                      : `${renewIn} days left`
                  : tenant.trialEndsAt
                    ? `Trial ends ${fmtDate(tenant.trialEndsAt)}`
                    : '—'}
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-white/[0.08]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${renewProgress ?? (renewIn != null && renewIn <= 0 ? 100 : 35)}%`,
                  background:
                    renewIn != null && renewIn <= 7
                      ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
                      : 'linear-gradient(90deg,#10b981,#0d9488,#06b6d4)',
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-slate-400">
              <span>Member since {fmtDate(tenant.createdAt)}</span>
              {tenant.trialEndsAt && <span>Trial {fmtDate(tenant.trialEndsAt)}{trialIn != null && trialIn > 0 ? ` (${trialIn}d left)` : ''}</span>}
            </div>
          </div>

          {tenant.paymentDue && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-500/35 dark:bg-amber-500/10 p-4 flex flex-wrap items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Payment due</p>
                <p className="text-xs mt-0.5 text-slate-600 dark:text-slate-400">
                  {tenant.paymentDueAmount != null
                    ? `Amount ${formatCurrency(tenant.paymentDueAmount)}`
                    : 'Outstanding subscription payment'}
                  {tenant.paymentDueInvoiceNo ? ` · Invoice ${tenant.paymentDueInvoiceNo}` : ''}
                </p>
              </div>
              <a
                href="/dashboard/billing"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500"
                style={{ color: '#ffffff' }}
              >
                <CreditCard size={12} color="#ffffff" /> Open Billing
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Usage */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <UsageMeter label="Branches" used={branchCount} limit={limits.branches} icon={Building2} />
        <UsageMeter label="Team members" used={teamCount} limit={limits.users} icon={Users} />
        <div
          className="rounded-2xl p-4 border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[var(--bg-subtle)] dark:shadow-none"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-50 border border-gray-200 dark:bg-[var(--bg-card)] dark:border-white/10"
            >
              <Zap size={16} className="text-emerald-600 dark:text-emerald-300" />
            </div>
            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-slate-400">
              Plan power
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {(currentPlan?.features?.length ?? 0)} included features
          </p>
          <p className="text-[11px] mt-1 text-gray-500 dark:text-slate-400">
            Compare plans below to unlock more modules
          </p>
        </div>
        <div
          className="rounded-2xl p-4 border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[var(--bg-subtle)] dark:shadow-none"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-50 border border-gray-200 dark:bg-[var(--bg-card)] dark:border-white/10"
            >
              <Shield size={16} className="text-emerald-600 dark:text-emerald-300" />
            </div>
            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-slate-400">
              Support
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Hexalyte billing desk
          </p>
          <p className="text-[11px] mt-1 text-gray-500 dark:text-slate-400">
            WhatsApp / phone · {SUPPORT_PHONE.replace('+94', '+94 ')}
          </p>
        </div>
      </section>

      {/* Invoice history */}
      <section className="card overflow-hidden !p-0">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <FileText size={16} className="text-emerald-600 dark:text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Invoice history</h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                Past months from when your paid plan started
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/billing')}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500"
            style={{ color: '#ffffff' }}
          >
            <CreditCard size={13} color="#ffffff" /> Open Billing & pay
          </button>
        </div>

        {invoicesLoading ? (
          <div className="p-8 flex justify-center text-gray-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 dark:text-slate-400 space-y-2">
            <p>No invoices yet.</p>
            <p className="text-xs">
              They appear after your paid plan starts (trial months are not billed). Open Billing to pay the current period when due.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400 bg-gray-50/80 dark:bg-white/[0.03]">
                  <th className="px-5 py-2.5 font-semibold">Invoice</th>
                  <th className="px-3 py-2.5 font-semibold">Period</th>
                  <th className="px-3 py-2.5 font-semibold">Amount</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 12).map((inv) => {
                  const st = inv.effectiveStatus || inv.status
                  const period = inv.billingPeriodStart
                    ? new Date(inv.billingPeriodStart).toLocaleDateString('en-LK', { month: 'short', year: 'numeric' })
                    : '—'
                  return (
                    <tr key={inv.id} className="border-t border-gray-100 dark:border-white/5">
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-slate-300">{period}</td>
                      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${
                            st === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                              : st === 'OVERDUE'
                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30'
                                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                          }`}
                        >
                          {st}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => router.push('/dashboard/billing')}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                            title="View in Billing"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={downloadingId === inv.id}
                            onClick={() => void downloadInvoice(inv)}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 disabled:opacity-50"
                            title="Download PDF"
                          >
                            {downloadingId === inv.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Download size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {invoices.length > 12 && (
              <div className="px-5 py-3 border-t border-gray-100 dark:border-white/5 text-xs text-gray-500">
                Showing latest 12 of {invoices.length}.{' '}
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/billing')}
                  className="font-semibold text-emerald-600 dark:text-emerald-300 hover:underline"
                >
                  See all on Billing
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Plans */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Plans</p>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Choose what fits your shop
            </h3>
            <p className="text-xs mt-0.5 text-gray-500 dark:text-slate-400">
              Upgrade anytime — we activate after payment confirmation
            </p>
          </div>
          <div
            className="inline-flex p-1 rounded-xl border"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
          >
            <button
              type="button"
              onClick={() => setView('cards')}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                view === 'cards' ? 'bg-emerald-600 text-white' : ''
              }`}
              style={view !== 'cards' ? { color: 'var(--text-muted)' } : undefined}
            >
              <LayoutGrid size={12} /> Cards
            </button>
            <button
              type="button"
              onClick={() => setView('compare')}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                view === 'compare' ? 'bg-emerald-600 text-white' : ''
              }`}
              style={view !== 'compare' ? { color: 'var(--text-muted)' } : undefined}
            >
              <Table2 size={12} /> Compare
            </button>
          </div>
        </div>

        {view === 'cards' ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {catalog.map((plan) => {
              const isCurrent = plan.key === currentKey
              const isDowngrade = planRank(plan.key) < planRank(currentKey)
              return (
                <div
                  key={plan.key}
                  className={`relative rounded-2xl p-4 flex flex-col gap-3 transition-all hover:-translate-y-0.5 border shadow-sm dark:shadow-none ${
                    isCurrent
                      ? ''
                      : 'bg-white border-gray-200 dark:bg-[var(--bg-subtle)] dark:border-white/10'
                  }`}
                  style={
                    isCurrent
                      ? {
                          background: plan.bg,
                          borderColor: plan.border,
                          boxShadow: `0 0 0 1px ${plan.border}, 0 14px 28px -20px ${plan.color}`,
                        }
                      : undefined
                  }
                >
                  {plan.popular && !isCurrent && (
                    <span
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 tracking-wide inline-flex items-center gap-1"
                      style={{ color: '#ffffff' }}
                    >
                      <Sparkles size={9} color="#ffffff" /> Popular
                    </span>
                  )}
                  {isCurrent && (
                    <span
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2.5 py-0.5 rounded-full tracking-wide inline-flex items-center gap-1"
                      style={{ background: plan.color, color: '#ffffff' }}
                    >
                      <CheckCircle2 size={9} color="#ffffff" /> Current
                    </span>
                  )}

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: plan.color }}>
                      {plan.label}
                    </p>
                    <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
                      {plan.price}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">
                      {plan.period}
                    </p>
                  </div>

                  <ul className="space-y-1.5 flex-1">
                    {plan.features.slice(0, 7).map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-slate-300">
                        <Check size={12} className="mt-0.5 flex-shrink-0" style={{ color: plan.color }} />
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.features.length > 7 && (
                      <li className="text-[11px] pl-4 text-gray-400 dark:text-slate-500">
                        +{plan.features.length - 7} more
                      </li>
                    )}
                  </ul>

                  {isCurrent ? (
                    <div
                      className="text-center text-xs font-bold py-2 rounded-xl border"
                      style={{ color: plan.color, borderColor: plan.border, background: plan.bg }}
                    >
                      Active plan
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setUpgradePlan(plan)}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl border border-gray-200 text-gray-800 hover:bg-gray-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5 transition"
                    >
                      {plan.key === 'ENTERPRISE'
                        ? 'Contact sales'
                        : isDowngrade
                          ? 'Talk to us'
                          : 'Upgrade'}
                      <ArrowUpRight size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th className="text-left p-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    Feature
                  </th>
                  {catalog.map((p) => (
                    <th key={p.key} className="p-3 text-center">
                      <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: p.color }}>
                        {p.label}
                      </div>
                      <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        {p.price}
                      </div>
                      {p.key === currentKey && (
                        <span
                          className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600"
                          style={{ color: '#ffffff' }}
                        >
                          YOU
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allFeatures.map((feature, idx) => (
                  <tr
                    key={feature}
                    className={idx % 2 === 0 ? 'bg-transparent' : 'bg-gray-50/80 dark:bg-white/[0.02]'}
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                  >
                    <td className="p-3 text-xs text-gray-700 dark:text-slate-300">
                      {feature}
                    </td>
                    {catalog.map((p) => {
                      const has = p.features.includes(feature)
                      return (
                        <td key={p.key} className="p-3 text-center">
                          {has ? (
                            <Check size={14} className="inline" style={{ color: p.color }} />
                          ) : (
                            <span className="text-gray-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td className="p-3" />
                  {catalog.map((p) => (
                    <td key={p.key} className="p-3 text-center">
                      {p.key === currentKey ? (
                        <span className="text-[11px] font-bold" style={{ color: p.color }}>
                          Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setUpgradePlan(p)}
                          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-800 hover:bg-gray-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                        >
                          {p.key === 'ENTERPRISE' ? 'Contact' : 'Upgrade'}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Help */}
      <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--bg-card)] p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            Need help with billing?
          </p>
          <p className="text-xs mt-0.5 text-gray-500 dark:text-slate-400">
            View and download invoices above, or open Billing for LankaQR / bank payment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://wa.me/${SUPPORT_WA}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <MessageCircle size={13} /> WhatsApp
          </a>
          <a
            href={`tel:${SUPPORT_PHONE}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <Phone size={13} /> Call
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Billing · ${tenant.name}`)}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <Mail size={13} /> Email
          </a>
        </div>
      </section>

      {/* Upgrade modal */}
      {upgradePlan && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm"
          onClick={closeUpgrade}
        >
          <div
            className="rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-5 border-b flex items-start justify-between gap-3"
              style={{
                borderColor: 'var(--border-subtle)',
                background: `linear-gradient(135deg, ${upgradePlan.bg}, transparent)`,
              }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: upgradePlan.color }}>
                  {upgradePlan.key === 'ENTERPRISE'
                    ? 'Talk to sales'
                    : planRank(upgradePlan.key) < planRank(currentKey)
                      ? 'Plan change'
                      : 'Upgrade & pay'}
                </p>
                <p className="text-xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
                  {upgradePlan.label}
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {upgradePlan.price}
                  <span className="ml-1">{upgradePlan.period}</span>
                  {canSelfServeUpgrade(upgradePlan) && upgradeAmountHint(upgradePlan) != null && (
                    <span className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">
                      · pay {formatCurrency(upgradeAmountHint(upgradePlan)!)}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closeUpgrade}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-slate-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <ul className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {upgradePlan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: upgradePlan.color }} />
                    {f}
                  </li>
                ))}
              </ul>

              {canSelfServeUpgrade(upgradePlan) && planRank(upgradePlan.key) > planRank(currentKey) ? (
                <>
                  {qrPaid ? (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 p-4 text-center space-y-2">
                      <div className="mx-auto w-[120px] h-[120px]">
                        <BillingLottie
                          src="/lottie/payment-successful.json"
                          loop={false}
                          style={{ width: 120, height: 120 }}
                        />
                      </div>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                        Payment received — {upgradePlan.label} is active
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          closeUpgrade()
                          onUpgraded?.()
                          router.refresh()
                        }}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white"
                      >
                        Done
                      </button>
                    </div>
                  ) : qrSession ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 flex flex-col items-center gap-2 bg-white dark:bg-black/20">
                        {qrImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={qrImage} alt="LankaQR" className="w-[220px] h-[220px] rounded-lg" />
                        ) : (
                          <Loader2 className="animate-spin text-emerald-500" size={28} />
                        )}
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatCurrency(qrSession.customerPayableAmount ?? qrSession.amount)}
                        </p>
                        {(qrSession.feeApplies || (qrSession.processingFee != null && qrSession.processingFee > 0)) && (
                          <div className="w-full text-xs space-y-1 rounded-lg border border-gray-100 dark:border-white/10 p-2.5 bg-gray-50 dark:bg-white/[0.03]">
                            <div className="flex justify-between gap-2 text-gray-600 dark:text-slate-400">
                              <span>Subscription</span>
                              <span>{formatCurrency(qrSession.subscriptionAmount ?? 0)}</span>
                            </div>
                            <div className="flex justify-between gap-2 text-amber-700 dark:text-amber-300">
                              <span>Processing fee</span>
                              <span>{formatCurrency(qrSession.processingFee ?? 0)}</span>
                            </div>
                            <div className="flex justify-between gap-2 font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-white/10">
                              <span>Total payable</span>
                              <span>{formatCurrency(qrSession.customerPayableAmount ?? qrSession.amount)}</span>
                            </div>
                          </div>
                        )}
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 text-center">
                          Scan with your banking app · {qrSession.invoiceNumber}
                          <br />
                          Ref: {qrSession.reference}
                        </p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" /> Waiting for payment…
                        </p>
                      </div>
                      {qrSession.mock && (
                        <button
                          type="button"
                          disabled={upgradeBusy}
                          onClick={async () => {
                            setUpgradeBusy(true)
                            try {
                              await billingApi.helaposMockPay(qrSession.paymentId)
                              setQrPaid(true)
                              toast.success('Mock payment applied')
                              onUpgraded?.()
                            } catch (e: any) {
                              toast.error(e?.message || 'Mock pay failed')
                            } finally {
                              setUpgradeBusy(false)
                            }
                          }}
                          className="w-full text-xs font-bold py-2.5 rounded-xl border border-dashed border-amber-400 text-amber-700 dark:text-amber-300"
                        >
                          Simulate payment (mock)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setQrSession(null)
                          setQrImage(null)
                        }}
                        className="w-full text-xs font-semibold py-2 text-gray-500"
                      >
                        Back
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Pay the upgrade difference and{' '}
                        <strong className="text-gray-900 dark:text-white">{upgradePlan.label}</strong>{' '}
                        activates automatically (LankaQR) or after slip approval (bank).
                      </p>
                      {helaposEnabled && (() => {
                        const net = upgradeAmountHint(upgradePlan)
                        if (net == null) return null
                        const fee = calculateHelaposCustomerPayable(net)
                        if (!fee.feeApplies) return null
                        return (
                          <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/80 dark:bg-emerald-500/10 px-3 py-2.5 text-xs space-y-1.5">
                            <div className="flex justify-between gap-2 text-gray-600 dark:text-slate-300">
                              <span>Subscription</span>
                              <span className="font-semibold">{formatCurrency(fee.subscriptionAmount)}</span>
                            </div>
                            <div className="flex justify-between gap-2 text-amber-700 dark:text-amber-300">
                              <span>Payment processing fee</span>
                              <span className="font-semibold">{formatCurrency(fee.processingFee)}</span>
                            </div>
                            <div className="flex justify-between gap-2 font-bold text-gray-900 dark:text-white">
                              <span>Total payable (LankaQR)</span>
                              <span>{formatCurrency(fee.customerPayableAmount)}</span>
                            </div>
                          </div>
                        )
                      })()}
                      <div className="grid gap-2">
                        {helaposEnabled && (
                          <button
                            type="button"
                            disabled={upgradeBusy}
                            onClick={() => void payUpgradeWithQr()}
                            className="inline-flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
                          >
                            {upgradeBusy ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
                            Pay with LankaQR
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={upgradeBusy}
                          onClick={() => void payUpgradeWithBank()}
                          className="inline-flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl border border-gray-200 text-gray-800 hover:bg-gray-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5 disabled:opacity-60"
                        >
                          {upgradeBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          Bank transfer + slip
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <a
                          href={waUpgrade(upgradePlan)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white"
                        >
                          <MessageCircle size={13} /> WhatsApp
                        </a>
                        <a
                          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Upgrade to ${upgradePlan.label} · ${tenant.name}`)}&body=${encodeURIComponent(`Shop: ${tenant.name}\nPlan: ${upgradePlan.label} (${upgradePlan.price}${upgradePlan.period})\nEmail: ${tenant.ownerEmail ?? ''}`)}`}
                          className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                        >
                          <Mail size={13} /> Email
                        </a>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {upgradePlan.key === 'ENTERPRISE'
                      ? 'Enterprise plans are custom — Hexalyte will confirm pricing and activate your account.'
                      : 'Send a request and Hexalyte will confirm the plan change on your account.'}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href={waUpgrade(upgradePlan)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      <MessageCircle size={15} /> WhatsApp
                    </a>
                    <a
                      href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Upgrade to ${upgradePlan.label} · ${tenant.name}`)}&body=${encodeURIComponent(`Shop: ${tenant.name}\nPlan: ${upgradePlan.label} (${upgradePlan.price}${upgradePlan.period})\nEmail: ${tenant.ownerEmail ?? ''}`)}`}
                      className="inline-flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      <Mail size={14} /> Email
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
