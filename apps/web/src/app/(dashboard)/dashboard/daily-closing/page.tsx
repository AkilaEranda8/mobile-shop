'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Calendar, Loader2, Lock, Unlock, ChevronRight, ChevronLeft, CheckCircle2,
  AlertTriangle, TrendingUp, Wallet, Receipt, Smartphone, Download, Sparkles,
  ExternalLink, RefreshCw, ShoppingCart, DollarSign, Building2, RotateCcw,
  BarChart3, PhoneCall, Wrench,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { useFeatureFlag, useBranches, useDailyClosingPreview } from '@/lib/hooks'
import { dailyClosingApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'

const STEPS = [
  { id: 1, title: 'Sales',     icon: ShoppingCart },
  { id: 2, title: 'Expenses',  icon: Receipt },
  { id: 3, title: 'Cash',      icon: Wallet },
  { id: 4, title: 'Profit',    icon: TrendingUp },
  { id: 5, title: 'Close Day', icon: Lock },
]

const DENOMS: Array<{ key: string; label: string; value: number }> = [
  { key: 'd5000', label: 'Rs 5000', value: 5000 },
  { key: 'd2000', label: 'Rs 2000', value: 2000 },
  { key: 'd1000', label: 'Rs 1000', value: 1000 },
  { key: 'd500',  label: 'Rs 500',  value: 500 },
  { key: 'd100',  label: 'Rs 100',  value: 100 },
  { key: 'd50',   label: 'Rs 50',   value: 50 },
  { key: 'd20',   label: 'Rs 20',   value: 20 },
  { key: 'd10',   label: 'Rs 10',   value: 10 },
]

const emptyCash = () => ({ d5000: 0, d2000: 0, d1000: 0, d500: 0, d100: 0, d50: 0, d20: 0, d10: 0, coins: 0 })

function KpiCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: typeof ShoppingCart; label: string; value: string; sub?: string; color: string; bg: string
}) {
  return (
    <div className="card rounded-2xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <Icon size={17} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {sub && <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'green' | 'red' | 'amber' | 'default' }) {
  const colors = {
    green:  { border: 'rgba(21,128,61,0.20)',  bg: 'rgba(21,128,61,0.06)',  val: '#16a34a' },
    red:    { border: 'rgba(185,28,28,0.20)',  bg: 'rgba(185,28,28,0.06)',  val: '#dc2626' },
    amber:  { border: 'rgba(245,158,11,0.25)', bg: 'rgba(245,158,11,0.06)', val: '#d97706' },
    default:{ border: 'var(--border-subtle)',  bg: 'var(--bg-subtle)',      val: 'var(--text-primary)' },
  }[tone ?? 'default']
  return (
    <div className="rounded-xl p-3 border" style={{ borderColor: colors.border, background: colors.bg }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: colors.val }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 rounded-full bg-violet-500" />
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        {sub && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  )
}

export default function DailyClosingPage() {
  const hasAccess = useFeatureFlag('DAILY_CLOSING')
  const user = authStorage.getUser()
  const role = user?.role ?? 'CASHIER'
  const canClose = role === 'OWNER' || role === 'MANAGER'
  const canDraft = canClose
  const cashOnly = role === 'CASHIER'

  const { data: branchesRaw } = useBranches()
  const branches = (branchesRaw as any[]) ?? []
  const [branchId, setBranchId] = useState('')
  const [date, setDate] = useState(businessToday)
  const [step, setStep] = useState(cashOnly ? 3 : 1)
  const [cashCount, setCashCount] = useState(emptyCash())
  const [openingCash, setOpeningCash] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const { data: raw, loading, refetch } = useDailyClosingPreview(branchId, date, hasAccess && !!branchId)
  const d = raw as any

  useEffect(() => {
    const userBranch = user?.branchIds?.[0]
    if (userBranch && branches.some((b: any) => b.id === userBranch)) {
      setBranchId(userBranch)
    } else if (branches.length && !branchId) {
      setBranchId(branches[0]?.id ?? '')
    }
  }, [branches, user?.branchIds, branchId])

  useEffect(() => {
    const onSale = () => { refetch() }
    window.addEventListener('pos:sale-complete', onSale)
    return () => window.removeEventListener('pos:sale-complete', onSale)
  }, [refetch])

  useEffect(() => {
    if (d?.cashCount) {
      setCashCount({
        d5000: d.cashCount.d5000 ?? 0,
        d2000: d.cashCount.d2000 ?? 0,
        d1000: d.cashCount.d1000 ?? 0,
        d500:  d.cashCount.d500  ?? 0,
        d100:  d.cashCount.d100  ?? 0,
        d50:   d.cashCount.d50   ?? 0,
        d20:   d.cashCount.d20   ?? 0,
        d10:   d.cashCount.d10   ?? 0,
        coins: d.cashCount.coins ?? 0,
      })
    }
    if (d?.openingCash != null && openingCash === '') setOpeningCash(d.openingCash)
    if (d?.notes) setNotes(d.notes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.closingId, d?.cashCount])

  const cashTotal = useMemo(() => {
    let t = Number(cashCount.coins || 0)
    for (const den of DENOMS) t += Number((cashCount as any)[den.key] || 0) * den.value
    return Math.round(t * 100) / 100
  }, [cashCount])

  const expectedCash = useMemo(() => {
    if (!d?.cash) return 0
    const open = typeof openingCash === 'number' ? openingCash : (d.openingCash ?? 0)
    const refunds = d.cash.cashRefunds ?? 0
    return Math.round((open + d.cash.cashSales - d.expenses.totalExpenses - d.cash.bankDeposits - refunds) * 100) / 100
  }, [d, openingCash])

  const variance = Math.round((expectedCash - cashTotal) * 100) / 100
  const varianceTone = variance === 0 ? 'green' : Math.abs(variance) <= 100 ? 'amber' : 'red'

  const exportPdf = useCallback(async () => {
    if (!printRef.current) return
    try {
      const { jsPDF } = await import('jspdf')
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' })
      const pdf = new jsPDF('p', 'mm', 'a4')
      const img = canvas.toDataURL('image/png')
      const w = pdf.internal.pageSize.getWidth()
      const h = (canvas.height * w) / canvas.width
      pdf.addImage(img, 'PNG', 0, 0, w, Math.min(h, 280))
      pdf.save(`DailyClosing_${date}.pdf`)
      toast.success('PDF downloaded')
    } catch {
      toast.error('PDF export failed')
    }
  }, [date])

  const saveCashCount = async () => {
    if (!branchId) return
    setSaving(true)
    try {
      await dailyClosingApi.saveCashCount({
        branchId, date,
        cashCount,
        openingCash: typeof openingCash === 'number' ? openingCash : undefined,
        notes,
      })
      toast.success('Cash count saved')
      refetch()
    } catch (e: any) {
      toast.error(e?.message ?? 'Save failed')
    } finally { setSaving(false) }
  }

  const saveDraft = async () => {
    if (!canDraft) return
    setSaving(true)
    try {
      await dailyClosingApi.saveDraft({ branchId, date, openingCash, cashCount, notes })
      toast.success('Draft saved')
      refetch()
    } catch (e: any) {
      toast.error(e?.message ?? 'Save failed')
    } finally { setSaving(false) }
  }

  const closeDay = async () => {
    if (!canClose) return
    if (!confirm('Close business day? New sales will be blocked until reopened.')) return
    setSaving(true)
    try {
      await dailyClosingApi.close({
        branchId, date,
        openingCash: typeof openingCash === 'number' ? openingCash : d?.openingCash,
        cashCount,
        notes,
      })
      toast.success('Business day closed')
      refetch()
    } catch (e: any) {
      toast.error(e?.message ?? 'Close failed')
    } finally { setSaving(false) }
  }

  const reopenDay = async () => {
    if (!canClose) return
    setSaving(true)
    try {
      await dailyClosingApi.reopen({ branchId, date })
      toast.success('Day reopened')
      refetch()
    } catch (e: any) {
      toast.error(e?.message ?? 'Reopen failed')
    } finally { setSaving(false) }
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(109,40,217,0.1)' }}>
          <Lock size={26} style={{ color: '#7c3aed' }} />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Daily Closing</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>This feature is not enabled for your account.</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Enable it in Settings → Shop Features → Daily Closing.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Daily Closing</h1>
            {d?.isClosed && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                Closed
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {d?.branchName ? `${d.branchName} · ` : ''}End-of-day summary from POS, Finance, Reload &amp; Repairs
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
            <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="bg-transparent outline-none text-sm max-w-[140px]"
              style={{ color: 'var(--text-primary)' }}
            >
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
            <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-transparent outline-none text-sm"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <button
            onClick={() => setDate(businessToday())}
            className="px-3 py-2 rounded-xl border text-xs font-medium transition-colors hover:bg-white/5"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
          >
            Today
          </button>
          <button onClick={() => refetch()} disabled={loading} title="Refresh"
            className="p-2 rounded-xl border transition-colors hover:bg-white/5"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {d?.isClosed && canClose && (
            <button onClick={reopenDay} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors"
              style={{ borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b', background: 'rgba(245,158,11,0.08)' }}>
              <Unlock size={13} /> Reopen
            </button>
          )}
          <button onClick={exportPdf}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Download size={13} /> Export PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card rounded-2xl p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 size={28} className="animate-spin text-violet-500" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading closing data…</p>
        </div>
      ) : (
        <>
          {/* ── Top KPI row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={ShoppingCart} label="Total Sales" value={formatCurrency(d?.sales?.totalSales ?? 0)}
              sub={`${d?.sales?.salesCount ?? 0} orders`} color="#8b5cf6" bg="rgba(139,92,246,0.1)" />
            <KpiCard icon={TrendingUp} label="Net Profit" value={formatCurrency(d?.profit?.netProfit ?? 0)}
              sub={`Commission ${formatCurrency(d?.profit?.reloadCommission ?? 0)}`} color="#10b981" bg="rgba(16,185,129,0.1)" />
            <KpiCard icon={Wallet} label="Expected Cash" value={formatCurrency(expectedCash)}
              sub="Opening + cash in − out" color="#3b82f6" bg="rgba(59,130,246,0.1)" />
            <KpiCard icon={variance === 0 ? CheckCircle2 : AlertTriangle} label="Cash Difference" value={formatCurrency(variance)}
              sub={variance > 0 ? 'Shortage' : variance < 0 ? 'Overage' : 'Balanced'}
              color={varianceTone === 'green' ? '#10b981' : varianceTone === 'amber' ? '#f59e0b' : '#ef4444'}
              bg={varianceTone === 'green' ? 'rgba(16,185,129,0.1)' : varianceTone === 'amber' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'} />
          </div>

          {/* ── Insights ── */}
          {(d?.insights?.length ?? 0) > 0 && (
            <div className="card rounded-2xl p-4 border-violet-500/20" style={{ background: 'rgba(109,40,217,0.04)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-violet-500" />
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400">Today&apos;s Insights</span>
              </div>
              <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                {d.insights.map((ins: string, i: number) => <li key={i}>• {ins}</li>)}
              </ul>
            </div>
          )}

          {/* ── Main card with wizard tabs ── */}
          <div className="card rounded-2xl overflow-hidden">
            {!cashOnly && (
              <div className="flex border-b overflow-x-auto" style={{ borderColor: 'var(--border-subtle)' }}>
                {STEPS.map(s => {
                  const Icon = s.icon
                  const active = step === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setStep(s.id)}
                      className="flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0"
                      style={{
                        borderColor: active ? 'var(--accent)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      <Icon size={14} />
                      {s.title}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="p-5 space-y-5">

              {/* Step 1: Sales */}
              {(step === 1 && !cashOnly) && (
                <>
                  <SectionTitle title="Sales Summary" sub="Auto-loaded from POS sales &amp; services" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    <MetricCard label="Mobile Sales" value={formatCurrency(d?.sales?.mobileSales ?? 0)} />
                    <MetricCard label="Accessory Sales" value={formatCurrency(d?.sales?.accessorySales ?? 0)} />
                    <MetricCard label="Service Income" value={formatCurrency(d?.sales?.serviceIncome ?? 0)} />
                    <MetricCard label="Repair Income" value={formatCurrency(d?.sales?.repairIncome ?? 0)} />
                    <MetricCard label="Bill Payments" value={formatCurrency(d?.sales?.billPaymentIncome ?? 0)} />
                    <MetricCard label="Reload Sales" value={formatCurrency(d?.sales?.reloadSales ?? 0)} />
                    <MetricCard label="Other Income" value={formatCurrency(d?.sales?.otherIncome ?? 0)} />
                    {(d?.sales?.creditPayments ?? 0) > 0 && (
                      <MetricCard label="Credit Payments" value={formatCurrency(d?.sales?.creditPayments ?? 0)} tone="green" />
                    )}
                    {(d?.sales?.refundsTotal ?? 0) > 0 && (
                      <MetricCard label="Refunds" value={formatCurrency(d?.sales?.refundsTotal ?? 0)} tone="red" sub="Returns module" />
                    )}
                  </div>
                </>
              )}

              {/* Step 2: Expenses */}
              {step === 2 && (
                <>
                  <SectionTitle title="Expense Summary" sub="From Finance → Expenses &amp; transactions" />
                  <MetricCard label="Total Expenses" value={formatCurrency(d?.expenses?.totalExpenses ?? 0)} tone="red" />
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                          <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Category</th>
                          <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(d?.expenses?.breakdown ?? []).map((r: any) => (
                          <tr key={r.category} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{r.category}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-red-500">{formatCurrency(r.amount)}</td>
                          </tr>
                        ))}
                        {(d?.expenses?.breakdown ?? []).length === 0 && (
                          <tr>
                            <td colSpan={2} className="text-center py-10 text-xs" style={{ color: 'var(--text-muted)' }}>No expenses recorded for this date</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Step 3: Cash */}
              {(step === 3 || cashOnly) && (
                <>
                  <SectionTitle title="Cash Reconciliation" sub="Count physical cash and compare with system expected balance" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <MetricCard label="Opening Cash" value={formatCurrency(typeof openingCash === 'number' ? openingCash : (d?.openingCash ?? 0))} />
                    <MetricCard label="Cash Sales" value={formatCurrency(d?.cash?.cashSales ?? 0)} tone="green" />
                    <MetricCard label="Bank Deposits" value={formatCurrency(d?.cash?.bankDeposits ?? 0)} />
                    <MetricCard label="QR / Wallet" value={formatCurrency(d?.cash?.qrPayments ?? 0)} />
                    <MetricCard label="Card Payments" value={formatCurrency(d?.cash?.cardPayments ?? 0)} />
                    <MetricCard label="Cash In Bank" value={formatCurrency(d?.cash?.cashInBank ?? 0)} />
                  </div>

                  {canDraft && !d?.isClosed && (
                    <label className="block max-w-xs">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Opening Cash (override)</span>
                      <input type="number" className="input-field mt-1.5" value={openingCash}
                        onChange={e => setOpeningCash(e.target.value === '' ? '' : parseFloat(e.target.value))} />
                    </label>
                  )}

                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Denomination Count</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                      {DENOMS.map(den => (
                        <label key={den.key}>
                          <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{den.label}</span>
                          <input type="number" min="0" className="input-field mt-1" value={(cashCount as any)[den.key]}
                            onChange={e => setCashCount(p => ({ ...p, [den.key]: parseInt(e.target.value) || 0 }))}
                            disabled={d?.isClosed} />
                        </label>
                      ))}
                      <label>
                        <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Coins</span>
                        <input type="number" min="0" step="0.01" className="input-field mt-1" value={cashCount.coins}
                          onChange={e => setCashCount(p => ({ ...p, coins: parseFloat(e.target.value) || 0 }))}
                          disabled={d?.isClosed} />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                      <MetricCard label="Expected Cash" value={formatCurrency(expectedCash)} />
                      <MetricCard label="Actual Counted" value={formatCurrency(cashTotal)} tone="green" />
                      <MetricCard label="Difference" value={formatCurrency(variance)} tone={varianceTone as 'green' | 'amber' | 'red'}
                        sub={variance > 0 ? 'Shortage' : variance < 0 ? 'Overage' : 'Balanced'} />
                    </div>

                    {variance !== 0 && (
                      <div className="mt-3 flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl"
                        style={{
                          background: varianceTone === 'red' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                          color: varianceTone === 'red' ? '#ef4444' : '#f59e0b',
                          border: `1px solid ${varianceTone === 'red' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
                        }}>
                        <AlertTriangle size={14} />
                        {variance > 0 ? `Cash shortage of ${formatCurrency(variance)}` : `Cash overage of ${formatCurrency(Math.abs(variance))}`}
                      </div>
                    )}

                    {!d?.isClosed && (
                      <button onClick={saveCashCount} disabled={saving}
                        className="btn-primary mt-4 text-sm flex items-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Save Cash Count
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Step 4: Profit */}
              {step === 4 && (
                <>
                  <SectionTitle title="Profit Summary" sub="Gross profit, COGS, reload commission &amp; net profit" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <MetricCard label="Gross Sales" value={formatCurrency(d?.profit?.grossSales ?? 0)} />
                    <MetricCard label="Cost of Goods" value={formatCurrency(d?.profit?.cogs ?? 0)} tone="amber" />
                    <MetricCard label="Gross Profit" value={formatCurrency(d?.profit?.grossProfit ?? 0)} tone="green" />
                    <MetricCard label="Reload Commission" value={formatCurrency(d?.profit?.reloadCommission ?? 0)} tone="green" />
                    <MetricCard label="Total Expenses" value={formatCurrency(d?.expenses?.totalExpenses ?? 0)} tone="red" />
                    <MetricCard label="Net Profit" value={formatCurrency(d?.profit?.netProfit ?? 0)}
                      tone={(d?.profit?.netProfit ?? 0) >= 0 ? 'green' : 'red'} />
                  </div>

                  <SectionTitle title="Reload by Network" />
                  <div className="grid sm:grid-cols-2 gap-2">
                    {(d?.reload?.breakdown ?? []).map((r: any) => (
                      <div key={r.provider} className="flex items-center justify-between rounded-xl px-3 py-2.5 border"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.provider}</span>
                        <span className="text-sm">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(r.commission)}</span>
                          <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>/ {formatCurrency(r.amount)}</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <SectionTitle title="IMEI &amp; Warranty" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MetricCard label="Mobiles Sold" value={String(d?.imei?.mobilesSold ?? 0)} />
                    <MetricCard label="IMEIs Registered" value={String(d?.imei?.imeisRegistered ?? 0)} />
                    <MetricCard label="Pending IMEIs" value={String(d?.imei?.pendingImeis ?? 0)} tone="amber" />
                    <MetricCard label="Warranties Active" value={String(d?.imei?.warrantiesActivated ?? 0)} tone="green" />
                  </div>
                </>
              )}

              {/* Step 5: Close */}
              {step === 5 && canClose && (
                <>
                  <SectionTitle title="Close Business Day" sub="Snapshot saved to Daily Summary · new transactions locked until reopened" />
                  {d?.isClosed ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl border"
                      style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)' }}>
                      <CheckCircle2 size={22} className="text-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Day closed successfully</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          By {d.closedByName} · {d.closedAt ? new Date(d.closedAt).toLocaleString('en-LK') : ''}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Review all steps complete? Closing will lock POS sales, finance entries and repair payments for this date.
                      </p>
                      <textarea className="input-field min-h-[88px]" placeholder="Closing notes (optional)"
                        value={notes} onChange={e => setNotes(e.target.value)} />
                      <div className="flex flex-wrap gap-2">
                        <button onClick={saveDraft} disabled={saving} className="btn-secondary text-sm">Save Draft</button>
                        <button onClick={closeDay} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                          Close Business Day
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Wizard navigation */}
              {!cashOnly && !d?.isClosed && (
                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
                    className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-40">
                    <ChevronLeft size={14} /> Back
                  </button>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Step {step} of 5</span>
                  <button onClick={() => setStep(s => Math.min(5, s + 1))} disabled={step === 5}
                    className="btn-primary text-sm flex items-center gap-1 disabled:opacity-40">
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Linked modules ── */}
          {d?.dataSources && (
            <div className="card rounded-2xl p-5">
              <SectionTitle title="Linked System Modules" sub="Data pulled automatically — no manual re-entry" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <KpiCard icon={ShoppingCart} label="POS Orders" value={String(d.dataSources.salesOrders ?? 0)}
                  sub={formatCurrency(d.dataSources.posSalesTotal ?? 0)} color="#8b5cf6" bg="rgba(139,92,246,0.1)" />
                <KpiCard icon={BarChart3} label="Finance Tx" value={String(d.dataSources.financeTransactions ?? 0)} color="#3b82f6" bg="rgba(59,130,246,0.1)" />
                <KpiCard icon={PhoneCall} label="Reloads" value={String(d.dataSources.reloadRecords ?? 0)} color="#10b981" bg="rgba(16,185,129,0.1)" />
                <KpiCard icon={RotateCcw} label="Returns" value={String(d.dataSources.returnsProcessed ?? 0)} color="#f59e0b" bg="rgba(245,158,11,0.1)" />
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: '/dashboard/sales', label: 'Sales', icon: ShoppingCart },
                  { href: '/dashboard/finance', label: 'Finance', icon: DollarSign },
                  { href: '/dashboard/daily-reload', label: 'Reload', icon: PhoneCall },
                  { href: '/dashboard/repairs', label: 'Repairs', icon: Wrench },
                  { href: '/dashboard/imei', label: 'IMEI', icon: Smartphone },
                ].map(link => (
                  <Link key={link.href} href={link.href}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-colors hover:bg-white/5"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                    <link.icon size={12} /> {link.label} <ExternalLink size={10} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Hidden PDF */}
      <div className="fixed left-[-9999px] top-0">
        <div ref={printRef} className="w-[800px] p-8 bg-white text-black text-sm">
          <h1 className="text-xl font-bold mb-1">Daily Closing Report</h1>
          <p className="text-gray-600 mb-4">{date} · {d?.branchName ?? branchId}</p>
          <p><strong>Total Sales:</strong> {formatCurrency(d?.sales?.totalSales ?? 0)}</p>
          <p><strong>Net Profit:</strong> {formatCurrency(d?.profit?.netProfit ?? 0)}</p>
          <p><strong>Expected Cash:</strong> {formatCurrency(expectedCash)}</p>
          <p><strong>Actual Cash:</strong> {formatCurrency(cashTotal)}</p>
          <p><strong>Variance:</strong> {formatCurrency(variance)}</p>
        </div>
      </div>
    </div>
  )
}
