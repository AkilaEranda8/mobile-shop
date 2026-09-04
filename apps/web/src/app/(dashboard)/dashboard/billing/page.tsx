'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileText,
  Loader2,
  QrCode,
  Search,
  Upload,
  Wallet,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { billingApi } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { calculateHelaposCustomerPayable } from '@/lib/helapos-fees'
import SubscriptionInvoiceViewer, { type BillingInvoiceViewModel } from '@/components/billing/SubscriptionInvoiceViewer'
import HelaposQrModal, { type HelaposQrSession } from '@/components/billing/HelaposQrModal'
import BillingLottie from '@/components/billing/BillingLottie'

type InvoiceRow = {
  id: string
  invoiceNumber: string
  billingPeriodStart: string
  billingPeriodEnd: string
  issueDate: string
  dueDate: string
  total: number
  status: string
  effectiveStatus?: string
  paidAt?: string | null
  paidByName?: string | null
  paidByEmail?: string | null
  approvedByName?: string | null
  daysOverdue?: number
  graceDaysRemaining?: number
  inGracePeriod?: boolean
  payments?: Array<{
    id: string
    status: string
    transactionRef?: string | null
    rejectionReason?: string | null
    paymentDate: string
    amount: number
    channel: string
    slipUrl?: string | null
    paidByName?: string | null
    paidByEmail?: string | null
    approvedByName?: string | null
    submittedBy?: { id: string; name: string; email: string } | null
  }>
}

type StatusFilter = 'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'

function fmtDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function periodLabel(start?: string) {
  if (!start) return '—'
  return new Date(start).toLocaleDateString('en-LK', { month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300',
    PENDING: 'bg-amber-500/10 text-amber-800 border-amber-500/25 dark:text-amber-300',
    OVERDUE: 'bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-300',
    ACTIVE: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300',
    SUSPENDED: 'bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-300',
    TRIAL: 'bg-sky-500/10 text-sky-800 border-sky-500/25 dark:text-sky-300',
    DRAFT: 'bg-black/5 text-gray-600 border-black/10 dark:text-slate-300',
    CANCELLED: 'bg-black/5 text-gray-500 border-black/10 dark:text-slate-400',
  }
  return (
    <span className={cn('inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border', styles[status] ?? styles.PENDING)}>
      {status}
    </span>
  )
}

function copyText(label: string, value?: string | null) {
  if (!value) return
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error('Copy failed'),
  )
}

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<any>(null)
  const [filter, setFilter] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')
  const [payInvoice, setPayInvoice] = useState<InvoiceRow | null>(null)
  const [viewInvoice, setViewInvoice] = useState<BillingInvoiceViewModel | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    amount: '',
    channel: 'MANUAL_BANK_TRANSFER',
    paymentDate: new Date().toISOString().slice(0, 10),
    bankName: '',
    accountRef: '',
    transactionRef: '',
    notes: '',
    slipUrl: '',
    slipFilename: '',
  })
  const [uploading, setUploading] = useState(false)
  const [qrInvoice, setQrInvoice] = useState<InvoiceRow | null>(null)
  const [qrSession, setQrSession] = useState<HelaposQrSession | null>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrPaid, setQrPaid] = useState(false)

  const load = useCallback(async () => {
    try {
      const res: any = await billingApi.overview()
      setOverview(res?.data ?? res)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load billing')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const invoices: InvoiceRow[] = overview?.invoices ?? []
  const current: InvoiceRow | null = overview?.currentInvoice ?? null
  const bank = overview?.config?.bank
  const summary = overview?.summary
  const subscription = overview?.subscription
  const grace = overview?.graceWarning
  const tenantStatus = overview?.tenant?.status as string | undefined
  const helaposEnabled = !!overview?.config?.helapos?.enabled
  const needsPay = !!current && current.effectiveStatus !== 'PAID' && current.status !== 'PAID' && current.status !== 'CANCELLED'
  const currentStatus = current?.effectiveStatus || current?.status
  const lankaQrFeePreview = needsPay && helaposEnabled && current
    ? calculateHelaposCustomerPayable(current.total)
    : null

  const closeQr = () => {
    setQrInvoice(null)
    setQrSession(null)
    setQrImage(null)
    setQrPaid(false)
    setQrLoading(false)
  }

  const openQrPay = async (inv: InvoiceRow) => {
    setPayInvoice(null)
    setQrInvoice(inv)
    setQrSession(null)
    setQrImage(null)
    setQrPaid(false)
    setQrLoading(true)
    try {
      const res: any = await billingApi.createHelaposQr(inv.id)
      const data = res?.data ?? res
      setQrSession({
        paymentId: data.paymentId,
        amount: data.customerPayableAmount ?? data.amount,
        reference: data.reference,
        qrPayload: data.qrPayload,
        mock: !!data.mock,
        invoiceNumber: data.invoiceNumber || inv.invoiceNumber,
        expiresAt: data.expiresAt || null,
        subscriptionAmount: data.subscriptionAmount ?? inv.total,
        processingFee: data.processingFee ?? 0,
        customerPayableAmount: data.customerPayableAmount ?? data.amount,
        feeApplies: !!data.feeApplies,
      })
      const QRCode = (await import('qrcode')).default
      const url = await QRCode.toDataURL(String(data.qrPayload), {
        margin: 2,
        width: 280,
        color: { dark: '#06281c', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      })
      setQrImage(url)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create LankaQR')
      closeQr()
    } finally {
      setQrLoading(false)
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
          toast.success('Payment received — subscription updated')
          await load()
        }
      } catch { /* keep polling */ }
    }
    void tick()
    const id = window.setInterval(() => { void tick() }, 3000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [qrSession?.paymentId, qrPaid, load])

  useEffect(() => {
    if (!qrInvoice && !payInvoice && !viewInvoice) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (qrInvoice) closeQr()
      else if (payInvoice) setPayInvoice(null)
      else if (viewInvoice) setViewInvoice(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [qrInvoice, payInvoice, viewInvoice])

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const st = inv.effectiveStatus || inv.status
      if (filter !== 'ALL' && st !== filter) return false
      if (search.trim() && !inv.invoiceNumber.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [invoices, filter, search])

  const openPay = (inv: InvoiceRow) => {
    setQrInvoice(null)
    setPayInvoice(inv)
    setForm({
      amount: String(inv.total),
      channel: 'MANUAL_BANK_TRANSFER',
      paymentDate: new Date().toISOString().slice(0, 10),
      bankName: bank?.bankName || '',
      accountRef: '',
      transactionRef: '',
      notes: '',
      slipUrl: '',
      slipFilename: '',
    })
  }

  useEffect(() => {
    const payId = searchParams.get('pay')
    if (!payId || loading || !overview) return
    const list = (overview.invoices as InvoiceRow[] | undefined) ?? []
    const inv = list.find((i) => i.id === payId)
      || (overview.currentInvoice?.id === payId ? overview.currentInvoice as InvoiceRow : null)
    if (!inv) return
    if (inv.status === 'PAID' || inv.effectiveStatus === 'PAID') {
      toast.success('This invoice is already paid')
    } else {
      openPay(inv)
    }
    router.replace('/dashboard/billing', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, overview])

  const downloadInvoice = async (inv: { id: string; invoiceNumber: string }) => {
    setDownloadingId(inv.id)
    try {
      await billingApi.downloadPdf(inv.id, inv.invoiceNumber)
      toast.success('Invoice PDF downloaded')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to download invoice')
    } finally {
      setDownloadingId(null)
    }
  }

  const openView = async (inv: InvoiceRow) => {
    setViewInvoice({
      ...inv,
      tenantName: overview?.tenant?.name,
      ownerName: overview?.tenant?.ownerName,
      ownerEmail: overview?.tenant?.ownerEmail,
      plan: overview?.subscription?.plan || overview?.tenant?.plan,
      months: (inv as any).months ?? 1,
      mrrSnapshot: (inv as any).mrrSnapshot ?? inv.total,
      subtotal: (inv as any).subtotal ?? inv.total,
      discount: (inv as any).discount ?? 0,
      tax: (inv as any).tax ?? 0,
      paidByName: inv.paidByName,
      paidByEmail: inv.paidByEmail,
      approvedByName: inv.approvedByName,
      bank,
    })
    try {
      const res: any = await billingApi.invoice(inv.id)
      const full = res?.data ?? res
      if (!full?.id) return
      setViewInvoice({
        id: full.id,
        invoiceNumber: full.invoiceNumber,
        billingPeriodStart: full.billingPeriodStart,
        billingPeriodEnd: full.billingPeriodEnd,
        issueDate: full.issueDate,
        dueDate: full.dueDate,
        total: full.total,
        subtotal: full.subtotal,
        discount: full.discount,
        tax: full.tax,
        status: full.status,
        effectiveStatus: inv.effectiveStatus || full.status,
        paidAt: full.paidAt,
        paidByName: full.paidByName,
        paidByEmail: full.paidByEmail,
        approvedByName: full.approvedByName,
        plan: full.plan,
        months: full.months,
        mrrSnapshot: full.mrrSnapshot,
        tenantName: full.tenant?.name ?? overview?.tenant?.name,
        ownerName: full.tenant?.ownerName,
        ownerEmail: full.tenant?.ownerEmail,
        bank,
        payments: full.payments,
      })
    } catch { /* keep snapshot */ }
  }

  const onUploadSlip = async (file: File | null) => {
    if (!file) return
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      toast.error('Only JPG, PNG, or PDF allowed')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('File must be under 8MB')
      return
    }
    setUploading(true)
    try {
      const data = await billingApi.uploadSlip(file)
      setForm((f) => ({ ...f, slipUrl: data.url, slipFilename: data.filename || file.name }))
      toast.success('Payment slip uploaded')
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const submitPayment = async () => {
    if (!payInvoice) return
    if (!form.slipUrl) {
      toast.error('Please upload a payment slip')
      return
    }
    setSubmitting(true)
    try {
      await billingApi.submitPayment({
        invoiceId: payInvoice.id,
        amount: Number(form.amount),
        channel: form.channel,
        paymentDate: new Date(form.paymentDate).toISOString(),
        bankName: form.bankName || undefined,
        accountRef: form.accountRef || undefined,
        transactionRef: form.transactionRef || undefined,
        slipUrl: form.slipUrl,
        slipFilename: form.slipFilename || undefined,
        notes: form.notes || undefined,
      })
      toast.success('Payment submitted for admin approval')
      setPayInvoice(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit payment')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3" style={{ color: 'var(--text-muted)' }}>
        <Loader2 className="animate-spin text-emerald-500" size={26} />
        <p className="text-sm">Loading billing…</p>
      </div>
    )
  }

  const metrics = [
    {
      key: 'balance',
      label: 'Balance',
      value: formatCurrency(summary?.currentBalance ?? 0),
      onClick: () => {
        setFilter(summary?.currentBalance > 0 ? 'OVERDUE' : 'ALL')
        document.getElementById('invoice-history')?.scrollIntoView({ behavior: 'smooth' })
      },
    },
    {
      key: 'invoice',
      label: 'Invoice',
      value: summary?.currentInvoice?.invoiceNumber ?? '—',
      sub: summary?.currentInvoice ? formatCurrency(summary.currentInvoice.total) : undefined,
      onClick: () => document.getElementById('current-invoice')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      key: 'year',
      label: 'Paid YTD',
      value: formatCurrency(summary?.paidThisYear ?? 0),
      onClick: () => {
        setFilter('PAID')
        document.getElementById('invoice-history')?.scrollIntoView({ behavior: 'smooth' })
      },
    },
    {
      key: 'out',
      label: 'Outstanding',
      value: String(summary?.outstandingCount ?? 0),
      onClick: () => {
        setFilter((summary?.outstandingCount ?? 0) > 0 ? 'OVERDUE' : 'PENDING')
        document.getElementById('invoice-history')?.scrollIntoView({ behavior: 'smooth' })
      },
    },
  ]

  const bankRows = bank
    ? [
        { label: 'Bank', value: bank.bankName },
        { label: 'Account name', value: bank.accountName },
        { label: 'Account number', value: bank.accountNumber },
        { label: 'Branch', value: bank.branch },
        { label: 'SWIFT', value: bank.swift },
      ].filter((r) => r.value)
    : []

  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-6">
      {/* ── Hero: one composition ── */}
      <section
        className="card relative overflow-hidden !p-0"
        style={{
          backgroundImage:
            'radial-gradient(720px 280px at 100% -10%, rgba(16,185,129,0.14), transparent 55%), radial-gradient(520px 240px at 0% 100%, rgba(59,130,246,0.08), transparent 50%)',
        }}
      >
        <div className="relative grid lg:grid-cols-[1fr_220px] gap-2 lg:gap-0">
          <div className="p-5 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 py-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <Wallet size={11} /> Billing & Invoices
              </span>
              <StatusBadge status={tenantStatus || 'ACTIVE'} />
            </div>

            <div>
              <h1
                className="text-3xl sm:text-4xl font-black tracking-tight leading-none"
                style={{ color: 'var(--text-primary)' }}
              >
                {subscription?.plan ?? 'Subscription'}
                <span className="ml-2 text-lg font-semibold" style={{ color: 'var(--text-muted)' }}>
                  plan
                </span>
              </h1>
              <p className="mt-2 text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>
                {formatCurrency(subscription?.monthlyPrice ?? 0)}
                <span className="mx-1.5 opacity-50">/</span>
                month
                {subscription?.nextBillingDate ? (
                  <>
                    <span className="mx-2 opacity-40">·</span>
                    Next invoice {fmtDate(subscription.nextBillingDate)}
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/settings?tab=billing"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl border transition hover:bg-black/[0.03] dark:hover:bg-white/5"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                Plan details <ArrowRight size={13} />
              </Link>
              {needsPay && current && (
                <>
                  {helaposEnabled && (
                    <button
                      type="button"
                      onClick={() => void openQrPay(current)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm"
                    >
                      <QrCode size={14} /> Pay LankaQR
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openPay(current)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl bg-[var(--brand-primary,#6366f1)] text-white hover:opacity-90 shadow-sm"
                  >
                    <CreditCard size={14} /> Bank transfer
                  </button>
                </>
              )}
            </div>

            {tenantStatus === 'SUSPENDED' && (
              <div className="rounded-xl border border-red-300/70 bg-red-50 dark:bg-red-500/10 p-3.5 flex gap-3">
                <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-red-800 dark:text-red-300">Account suspended — payment required</p>
                  <p className="text-xs text-red-700/90 dark:text-red-200/80 mt-0.5">
                    Business modules stay locked until this invoice is paid. LankaQR and bank transfer still work here.
                  </p>
                </div>
              </div>
            )}

            {grace && tenantStatus !== 'SUSPENDED' && (
              <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-500/10 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-300">Grace period active</p>
                    <p className="text-xs text-amber-800/90 dark:text-amber-100/70 mt-0.5">
                      <strong>{grace.daysRemaining}</strong> day{grace.daysRemaining === 1 ? '' : 's'} left ·{' '}
                      {formatCurrency(grace.amount)} outstanding
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-end justify-center lg:justify-end px-4 pb-4 lg:pr-6 lg:pb-6">
            <div className="w-[160px] h-[160px] sm:w-[200px] sm:h-[200px]" aria-hidden>
              <BillingLottie
                src="/lottie/revenue.json"
                loop
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Integrated metrics strip — same card, not separate tiles */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 border-t"
          style={{ borderColor: 'var(--border-subtle)', background: 'color-mix(in srgb, var(--bg-subtle) 70%, transparent)' }}
        >
          {metrics.map((m, i) => (
            <button
              key={m.key}
              type="button"
              onClick={m.onClick}
              className={cn(
                'text-left px-4 sm:px-5 py-3.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.03]',
                i % 2 === 1 && 'border-l lg:border-l',
                i >= 2 && 'border-t lg:border-t-0',
                i > 0 && 'lg:border-l',
              )}
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <p className="text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--text-muted)' }}>
                {m.label}
              </p>
              <p className="text-base sm:text-lg font-black mt-0.5 truncate" style={{ color: 'var(--text-primary)' }}>
                {m.value}
              </p>
              {m.sub && (
                <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{m.sub}</p>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── Main: invoice + bank ── */}
      <div className="grid lg:grid-cols-5 gap-5 items-start">
        <section id="current-invoice" className="card !p-0 overflow-hidden lg:col-span-3 scroll-mt-4">
          <div
            className="px-5 py-4 border-b flex flex-wrap items-center justify-between gap-2"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <FileText size={16} className="text-emerald-600 dark:text-emerald-300" />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Current invoice</h2>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>View, download, or pay</p>
              </div>
            </div>
            {currentStatus && <StatusBadge status={currentStatus} />}
          </div>

          {!current ? (
            <div className="p-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No invoices yet. They appear when your subscription billing period starts.
            </div>
          ) : (
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => void openView(current)}
                    className="text-2xl sm:text-[1.75rem] font-black tracking-tight hover:text-emerald-600 dark:hover:text-emerald-300 transition"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {current.invoiceNumber}
                  </button>
                  <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Calendar size={13} />
                    {periodLabel(current.billingPeriodStart)} · Due {fmtDate(current.dueDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--text-muted)' }}>
                    Subscription
                  </p>
                  <p className="text-2xl sm:text-3xl font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(current.total)}
                  </p>
                </div>
              </div>

              {lankaQrFeePreview?.feeApplies && (
                <div
                  className="rounded-xl border px-3.5 py-3 space-y-2 text-sm"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
                >
                  <div className="flex justify-between gap-3" style={{ color: 'var(--text-muted)' }}>
                    <span>Subscription plan</span>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(lankaQrFeePreview.subscriptionAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-amber-700 dark:text-amber-300">
                    <span>Payment processing fee (LankaQR)</span>
                    <span className="font-semibold">{formatCurrency(lankaQrFeePreview.processingFee)}</span>
                  </div>
                  <div className="h-px" style={{ background: 'var(--border-subtle)' }} />
                  <div className="flex justify-between gap-3 font-bold" style={{ color: 'var(--text-primary)' }}>
                    <span>Total payable via LankaQR</span>
                    <span>{formatCurrency(lankaQrFeePreview.customerPayableAmount)}</span>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Bank transfer has no processing fee. HelaPOS fee applies only on QR amounts above LKR 5,000.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Issue date', value: fmtDate(current.issueDate) },
                  { label: 'Due date', value: fmtDate(current.dueDate) },
                  { label: 'Period', value: periodLabel(current.billingPeriodStart) },
                  {
                    label: currentStatus === 'PAID' ? 'Paid by' : 'Days overdue',
                    value: currentStatus === 'PAID'
                      ? (current.paidByName || current.payments?.find((p) => p.status === 'APPROVED')?.paidByName || '—')
                      : (currentStatus === 'OVERDUE' ? String(current.daysOverdue ?? 0) : '—'),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border px-3 py-2.5"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
                  >
                    <p className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      {item.label}
                    </p>
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                  </div>
                ))}
              </div>

              {currentStatus === 'PAID' && (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0" aria-hidden>
                      <BillingLottie
                        src="/lottie/payment-successful.json"
                        loop={false}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                    <div className="min-w-0 py-2">
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                        Paid {fmtDate(current.paidAt)}
                      </p>
                      {current.payments?.[0]?.transactionRef && (
                        <p className="text-[11px] text-emerald-700/80 dark:text-emerald-200/70 mt-0.5 truncate">
                          Ref {current.payments[0].transactionRef}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void openView(current)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl border hover:bg-black/[0.03] dark:hover:bg-white/5"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  <Eye size={13} /> View
                </button>
                <button
                  type="button"
                  disabled={downloadingId === current.id}
                  onClick={() => void downloadInvoice(current)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl border hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-60"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  <Download size={13} /> {downloadingId === current.id ? 'Downloading…' : 'Download PDF'}
                </button>

                {needsPay && (
                  <>
                    {helaposEnabled && (
                      <button
                        type="button"
                        onClick={() => void openQrPay(current)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm"
                      >
                        <QrCode size={14} /> Pay with LankaQR
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openPay(current)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl text-white shadow-sm hover:opacity-90"
                      style={{ background: 'var(--brand-primary, #6366f1)' }}
                    >
                      <CreditCard size={14} /> Bank Transfer
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="lg:col-span-2 space-y-5">
          {bankRows.length > 0 && (
            <section className="card !p-0 overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                  <Building2 size={15} className="text-sky-600 dark:text-sky-300" />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Bank transfer</h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Copy details · upload slip when paying</p>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {bankRows.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-xl border px-3 py-2.5 flex items-start justify-between gap-2"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {row.label}
                      </p>
                      <p className="text-sm font-semibold mt-0.5 break-all" style={{ color: 'var(--text-primary)' }}>
                        {row.value}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(row.label, row.value)}
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex-shrink-0"
                      title="Copy"
                    >
                      <Copy size={12} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  </div>
                ))}
                {bank?.instructions && (
                  <p className="text-[11px] leading-relaxed pt-1 px-0.5" style={{ color: 'var(--text-muted)' }}>
                    {bank.instructions}
                  </p>
                )}
              </div>
            </section>
          )}

          <section className="card p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold mb-2" style={{ color: 'var(--text-muted)' }}>
              How to pay
            </p>
            <ul className="space-y-2.5 text-sm" style={{ color: 'var(--text-secondary, var(--text-muted))' }}>
              <li className="flex gap-2">
                <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                <span>LankaQR settles instantly after bank verification.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                <span>Bank transfer needs a slip — Hexalyte approves usually same day.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                <span>Manage plan upgrades under Settings → Billing.</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      {/* ── History ── */}
      <section id="invoice-history" className="card !p-0 overflow-hidden scroll-mt-4">
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Invoice history</h2>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {filtered.length} invoice{filtered.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['ALL', 'PAID', 'PENDING', 'OVERDUE'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    'text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition',
                    filter === f
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'hover:bg-black/[0.03] dark:hover:bg-white/5',
                  )}
                  style={filter !== f ? { borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' } : undefined}
                >
                  {f}
                </button>
              ))}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search invoice #"
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border w-40 sm:w-48"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </div>

          <div className="sm:hidden space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No invoices found</p>
            ) : filtered.map((inv) => {
              const st = inv.effectiveStatus || inv.status
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => void openView(inv)}
                  className="w-full text-left rounded-xl border p-3 space-y-2"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{inv.invoiceNumber}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {periodLabel(inv.billingPeriodStart)} · Due {fmtDate(inv.dueDate)}
                      </p>
                    </div>
                    <StatusBadge status={st} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(inv.total)}</span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {st === 'PAID' ? `Paid ${fmtDate(inv.paidAt)}` : 'Tap to view'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="hidden sm:block overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  {['Invoice', 'Period', 'Due', 'Amount', 'Status', 'Paid', 'Paid by', ''].map((h) => (
                    <th key={h || 'actions'} className="p-3 text-left text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No invoices found</td>
                  </tr>
                ) : filtered.map((inv) => {
                  const st = inv.effectiveStatus || inv.status
                  const paidBy = inv.paidByName
                    || inv.payments?.find((p) => p.status === 'APPROVED')?.paidByName
                    || inv.payments?.find((p) => p.status === 'APPROVED')?.submittedBy?.name
                    || '—'
                  return (
                    <tr key={inv.id} className="border-t hover:bg-black/[0.015] dark:hover:bg-white/[0.02]" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="p-3">
                        <button type="button" onClick={() => void openView(inv)} className="font-semibold text-emerald-700 dark:text-emerald-300 hover:underline">
                          {inv.invoiceNumber}
                        </button>
                      </td>
                      <td className="p-3" style={{ color: 'var(--text-primary)' }}>{periodLabel(inv.billingPeriodStart)}</td>
                      <td className="p-3" style={{ color: 'var(--text-primary)' }}>{fmtDate(inv.dueDate)}</td>
                      <td className="p-3 font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(inv.total)}</td>
                      <td className="p-3"><StatusBadge status={st} /></td>
                      <td className="p-3" style={{ color: 'var(--text-muted)' }}>{fmtDate(inv.paidAt)}</td>
                      <td className="p-3 text-xs" style={{ color: 'var(--text-muted)' }}>{st === 'PAID' ? paidBy : '—'}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void openView(inv)}
                            className="p-1.5 rounded-lg border hover:bg-black/[0.03] dark:hover:bg-white/5"
                            style={{ borderColor: 'var(--border-subtle)' }}
                            title="View"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={downloadingId === inv.id}
                            onClick={() => void downloadInvoice(inv)}
                            className="p-1.5 rounded-lg border hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-50"
                            style={{ borderColor: 'var(--border-subtle)' }}
                            title="Download PDF"
                          >
                            <Download size={13} />
                          </button>
                          {st !== 'PAID' && st !== 'CANCELLED' && helaposEnabled && (
                            <button
                              type="button"
                              onClick={() => void openQrPay(inv)}
                              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                              title="Pay with LankaQR"
                            >
                              <QrCode size={13} />
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
      </section>

      {viewInvoice && (
        <SubscriptionInvoiceViewer
          invoice={viewInvoice}
          downloading={downloadingId === viewInvoice.id}
          onClose={() => setViewInvoice(null)}
          onDownload={() => void downloadInvoice(viewInvoice)}
        />
      )}

      {payInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-[2px]" onClick={() => setPayInvoice(null)}>
          <div
            className="bg-white dark:bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-3 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Bank transfer</p>
                <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{payInvoice.invoiceNumber}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatCurrency(payInvoice.total)}</p>
              </div>
              <button type="button" onClick={() => setPayInvoice(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X size={16} /></button>
            </div>

            {helaposEnabled && (
              <button
                type="button"
                onClick={() => void openQrPay(payInvoice)}
                className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
              >
                <QrCode size={15} /> Prefer LankaQR? Pay instantly
              </button>
            )}

            <div className="h-px bg-black/5 dark:bg-white/10" />

            <label className="block text-xs space-y-1">
              <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Amount</span>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }} />
            </label>
            <label className="block text-xs space-y-1">
              <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Payment method</span>
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}>
                <option value="MANUAL_BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs space-y-1">
                <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Payment date</span>
                <input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }} />
              </label>
              <label className="block text-xs space-y-1">
                <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Bank</span>
                <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="w-full border rounded-xl px-3 py-2.5 text-sm" placeholder="Bank name" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }} />
              </label>
            </div>
            <label className="block text-xs space-y-1">
              <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Transaction reference</span>
              <input value={form.transactionRef} onChange={(e) => setForm({ ...form, transactionRef: e.target.value })} className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }} />
            </label>
            <label className="block text-xs space-y-1">
              <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Payment slip</span>
              <label className="flex items-center justify-between gap-2 border rounded-xl px-3 py-2.5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/5" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  <Upload size={13} /> {uploading ? 'Uploading…' : (form.slipFilename || 'JPG / PNG / PDF')}
                </span>
                <input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => onUploadSlip(e.target.files?.[0] ?? null)} />
              </label>
            </label>
            <label className="block text-xs space-y-1">
              <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Notes</span>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[70px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }} />
            </label>

            <button
              type="button"
              disabled={submitting || uploading}
              onClick={() => void submitPayment()}
              className="w-full text-sm font-bold py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit for approval'}
            </button>
          </div>
        </div>
      )}

      {qrInvoice && (
        <HelaposQrModal
          invoiceNumber={qrSession?.invoiceNumber || qrInvoice.invoiceNumber}
          session={qrSession}
          qrImage={qrImage}
          loading={qrLoading}
          paid={qrPaid}
          onClose={closeQr}
          onPaid={async () => {
            setQrPaid(true)
            await load()
          }}
          onRefresh={() => {
            if (qrInvoice) void openQrPay(qrInvoice)
          }}
          onSwitchBank={() => {
            const inv = qrInvoice
            closeQr()
            if (inv) openPay(inv)
          }}
        />
      )}
    </div>
  )
}
