'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, Loader2, Lock, RotateCcw, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { salesApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { ChequePaymentMeta } from '@/components/payments/ChequeDetailsFields'
import { salePaymentLabel, usePaymentMethods } from '@/lib/payment-methods'

type SalePayment = {
  id?: string
  method: string
  amount: number
  reference?: string | null
  methodLabel?: string | null
  methodConfigId?: string | null
  customerFeeAmount?: number | null
  clearanceStatus?: 'NOT_REQUIRED' | 'PENDING' | 'CLEARED' | null
}

type Clearance = {
  id: string
  salePaymentId: string
  grossAmount: number
  providerDeduction: number
  netAmount: number
  destinationType: 'CASH' | 'BANK'
  destinationName?: string
  clearedAt: string
  reference?: string | null
  status: 'ACTIVE' | 'REVERSED'
  createdBy: string
}

type Options = {
  accountingActive: boolean
  cashAccounts: { id: string; name: string }[]
  bankAccounts: { id: string; name: string; bankName?: string | null; accountNo?: string | null }[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
    >
      <div
        className="w-full max-w-md rounded-xl border shadow-2xl"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-sm font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  )
}

function MarkClearModal({
  saleId,
  payment,
  deductionHint,
  onClose,
  onDone,
}: {
  saleId: string
  payment: SalePayment
  deductionHint?: number
  onClose: () => void
  onDone: () => void
}) {
  const gross = round2(Number(payment.amount) + Number(payment.customerFeeAmount ?? 0))
  const [options, setOptions] = useState<Options | null>(null)
  const [deduction, setDeduction] = useState(() => (deductionHint ? String(round2((gross * deductionHint) / 100)) : '0'))
  const [destinationType, setDestinationType] = useState<'CASH' | 'BANK'>('BANK')
  const [destinationId, setDestinationId] = useState('')
  const [clearedAt, setClearedAt] = useState(businessToday())
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    salesApi.paymentClearanceOptions()
      .then((r: any) => setOptions((r?.data ?? r) as Options))
      .catch(() => setOptions({ accountingActive: false, cashAccounts: [], bankAccounts: [] }))
  }, [])

  const accounts = destinationType === 'CASH' ? options?.cashAccounts ?? [] : options?.bankAccounts ?? []
  useEffect(() => {
    if (!accounts.length) { setDestinationId(''); return }
    if (!accounts.some(a => a.id === destinationId)) {
      const main = accounts.find(a => /^main/i.test(a.name)) ?? accounts[0]
      setDestinationId(main.id)
    }
  }, [accounts, destinationId])

  const deductionNum = Number(deduction)
  const validDeduction = Number.isFinite(deductionNum) && deductionNum >= 0 && deductionNum <= gross
  const net = validDeduction ? round2(gross - deductionNum) : 0
  const needsAccount = !!options?.accountingActive

  const submit = async () => {
    if (!payment.id) return
    if (!validDeduction) { toast.error('Provider deduction must be between 0 and the gross amount'); return }
    if (needsAccount && !destinationId) { toast.error('Choose the account that received the money'); return }
    setSaving(true)
    try {
      await salesApi.clearPayment(saleId, payment.id, {
        providerDeduction: round2(deductionNum),
        destinationType,
        ...(destinationId ? { destinationId } : {}),
        clearedAt: `${clearedAt}T12:00:00+05:30`,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      })
      toast.success('Payment marked as cleared')
      onDone()
    } catch (e: any) {
      toast.error(e?.message || 'Could not mark as cleared')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`Mark as Clear — ${salePaymentLabel(payment)}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p style={{ color: 'var(--text-muted)' }}>Gross (held in clearing)</p>
          <p className="text-base font-semibold tabular-nums">{formatCurrency(gross)}</p>
        </div>
        <div>
          <p style={{ color: 'var(--text-muted)' }}>Actual settlement</p>
          <p className="text-base font-semibold tabular-nums">{formatCurrency(net)}</p>
        </div>
      </div>
      <label className="block text-xs space-y-1">
        <span style={{ color: 'var(--text-secondary)' }}>Provider deduction (commission / fee)</span>
        <input className="input-field h-9 text-sm w-full" inputMode="decimal" value={deduction} onChange={e => setDeduction(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs space-y-1">
          <span style={{ color: 'var(--text-secondary)' }}>Transfer to</span>
          <select className="input-field h-9 text-sm w-full" value={destinationType} onChange={e => setDestinationType(e.target.value === 'CASH' ? 'CASH' : 'BANK')}>
            <option value="BANK">Bank</option>
            <option value="CASH">Cash</option>
          </select>
        </label>
        <label className="block text-xs space-y-1">
          <span style={{ color: 'var(--text-secondary)' }}>Account</span>
          <select className="input-field h-9 text-sm w-full" value={destinationId} onChange={e => setDestinationId(e.target.value)} disabled={!accounts.length}>
            {!accounts.length && <option value="">{needsAccount ? 'No account found' : 'Not required'}</option>}
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs space-y-1">
          <span style={{ color: 'var(--text-secondary)' }}>Settlement date</span>
          <input type="date" className="input-field h-9 text-sm w-full" max={businessToday()} value={clearedAt} onChange={e => setClearedAt(e.target.value || businessToday())} />
        </label>
        <label className="block text-xs space-y-1">
          <span style={{ color: 'var(--text-secondary)' }}>Reference</span>
          <input className="input-field h-9 text-sm w-full" value={reference} maxLength={120} onChange={e => setReference(e.target.value)} placeholder="Settlement ref (optional)" />
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={saving || !options} className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Mark as Clear
        </button>
      </div>
    </ModalShell>
  )
}

function ReverseClearModal({ saleId, payment, onClose, onDone }: { saleId: string; payment: SalePayment; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!payment.id || !password.trim()) return
    setSaving(true)
    try {
      await salesApi.reverseClearance(saleId, payment.id, { adminPassword: password })
      toast.success('Clearance reversed')
      onDone()
    } catch (e: any) {
      toast.error(e?.message || 'Could not reverse clearance')
    } finally {
      setSaving(false)
    }
  }
  return (
    <ModalShell title={`Reverse clearance — ${salePaymentLabel(payment)}`} onClose={onClose}>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        The settlement entry is reversed and the payment goes back to pending clearance.
      </p>
      <label className="block text-xs space-y-1">
        <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}><Lock size={11} /> Owner / Admin password</span>
        <input
          type="password"
          autoFocus
          className="input-field h-9 text-sm w-full"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
        />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
        <button type="button" onClick={submit} disabled={saving || !password.trim()} className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          Reverse
        </button>
      </div>
    </ModalShell>
  )
}

/** Sale Details → Payments, with fee and clearance status per payment. */
export function SalePaymentsSection({
  sale,
  canManage,
  onUpdated,
  onModalChange,
}: {
  sale: { id: string; payments: SalePayment[] }
  canManage: boolean
  onUpdated: (sale: any) => void
  onModalChange?: (open: boolean) => void
}) {
  const methods = usePaymentMethods()
  const [clearances, setClearances] = useState<Clearance[]>([])
  const [clearTarget, setClearTarget] = useState<SalePayment | null>(null)
  const [reverseTarget, setReverseTarget] = useState<SalePayment | null>(null)
  const tracked = useMemo(
    () => sale.payments.some(p => p.clearanceStatus === 'PENDING' || p.clearanceStatus === 'CLEARED'),
    [sale.payments],
  )

  useEffect(() => {
    if (!tracked) { setClearances([]); return }
    let alive = true
    salesApi.clearances(sale.id)
      .then((r: any) => { if (alive) setClearances(Array.isArray(r?.data ?? r) ? (r?.data ?? r) : []) })
      .catch(() => {})
    return () => { alive = false }
  }, [sale.id, tracked, sale.payments])

  useEffect(() => { onModalChange?.(!!clearTarget || !!reverseTarget) }, [clearTarget, reverseTarget, onModalChange])

  const refresh = async () => {
    setClearTarget(null)
    setReverseTarget(null)
    try {
      const r: any = await salesApi.getById(sale.id)
      onUpdated(r?.data ?? r)
    } catch { /* list refresh via onUpdated caller */ }
  }

  if (!sale.payments.length) return null

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
        Payments
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {sale.payments.map(p => {
          const fee = Number(p.customerFeeAmount ?? 0)
          const active = clearances.find(c => c.salePaymentId === p.id && c.status === 'ACTIVE')
          return (
            <div key={p.id ?? `${p.method}-${p.amount}`} className="px-3 py-2.5 space-y-1.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-[12rem]">
                  <ChequePaymentMeta
                    method={p.methodLabel || p.method}
                    reference={p.reference}
                    amount={p.amount}
                    formatAmount={formatCurrency}
                  />
                </div>
                {p.clearanceStatus === 'PENDING' && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Clock size={11} /> Pending clearance
                    </span>
                    {canManage && p.id && (
                      <button type="button" onClick={() => setClearTarget(p)} className="btn-primary text-xs h-7 px-2.5">
                        Mark as Clear
                      </button>
                    )}
                  </div>
                )}
                {p.clearanceStatus === 'CLEARED' && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 size={11} /> Cleared
                    </span>
                    {canManage && p.id && (
                      <button type="button" onClick={() => setReverseTarget(p)} className="btn-secondary text-xs h-7 px-2.5 inline-flex items-center gap-1">
                        <RotateCcw size={11} /> Reverse
                      </button>
                    )}
                  </div>
                )}
              </div>
              {fee > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span>Sale value: <b className="tabular-nums">{formatCurrency(Number(p.amount))}</b></span>
                  <span>Customer fee: <b className="tabular-nums">{formatCurrency(fee)}</b></span>
                  <span>Customer paid: <b className="tabular-nums">{formatCurrency(round2(Number(p.amount) + fee))}</b></span>
                </div>
              )}
              {active && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span>Settled: <b className="tabular-nums">{formatCurrency(active.netAmount)}</b></span>
                  {active.providerDeduction > 0 && <span>Provider deduction: <b className="tabular-nums">{formatCurrency(active.providerDeduction)}</b></span>}
                  <span>To: <b>{active.destinationName}</b></span>
                  <span>On: <b>{new Date(active.clearedAt).toLocaleDateString()}</b></span>
                  {active.reference && <span>Ref: <b>{active.reference}</b></span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {clearTarget && (
        <MarkClearModal
          saleId={sale.id}
          payment={clearTarget}
          deductionHint={methods.find(m => m.id === clearTarget.methodConfigId)?.clearance?.expectedDeductionRate}
          onClose={() => setClearTarget(null)}
          onDone={refresh}
        />
      )}
      {reverseTarget && (
        <ReverseClearModal saleId={sale.id} payment={reverseTarget} onClose={() => setReverseTarget(null)} onDone={refresh} />
      )}
    </div>
  )
}
