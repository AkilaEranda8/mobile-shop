'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Coins, Loader2, RefreshCw, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'
import {
  AccountingPageShell,
  AccountingFeatureGate,
  AccountingPageHeader,
  AccountingPanel,
  AccountingTable,
  AccountingTd,
  AccountingTh,
  AccountingModal,
} from '@/components/accounting/accounting-ui'

type PettyStatus = {
  balance: number
  recent: Array<{ entryNo: string; entryDate: string; memo: string | null; description: string | null; debit: number; credit: number }>
}

export default function PettyCashPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const branchId = getActiveBranchId() ?? ''
  const [status, setStatus] = useState<PettyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [entryDate, setEntryDate] = useState(businessToday())
  const [expAmount, setExpAmount] = useState('')
  const [expDesc, setExpDesc] = useState('')
  const [repAmount, setRepAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showExpense, setShowExpense] = useState(false)
  const [showReplenish, setShowReplenish] = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const res = await accountingApi.pettyCash() as { data: PettyStatus }
      setStatus(res.data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load petty cash')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => { if (hasAccess && branchId) load() }, [hasAccess, load, branchId])

  const balance = status?.balance ?? 0
  const recent = status?.recent ?? []
  const balanceLabel = useMemo(() => {
    if (Math.abs(balance) < 0.005) return 'Float available'
    return balance < 0 ? 'Overdrawn (needs replenish)' : 'Float available'
  }, [balance])

  async function postExpense() {
    const amount = Number(expAmount)
    if (!amount || !expDesc.trim()) { toast.error('Amount and description required'); return }
    setSubmitting(true)
    try {
      await accountingApi.pettyCashExpense({ branchId, entryDate, amount, description: expDesc })
      toast.success('Expense posted')
      setExpAmount(''); setExpDesc('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setSubmitting(false) }
  }

  async function postReplenish() {
    const amount = Number(repAmount)
    if (!amount) { toast.error('Enter amount'); return }
    setSubmitting(true)
    try {
      await accountingApi.replenishPettyCash({ branchId, entryDate, amount })
      toast.success('Petty cash replenished')
      setRepAmount('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setSubmitting(false) }
  }

  if (!hasAccess) return <AccountingFeatureGate />

  return (
    <AccountingPageShell>
      <AccountingPageHeader
        title="Petty Cash"
        subtitle="Imprest float — expenses and replenishment"
        icon={Wallet}
        actions={
          <div className="flex items-center gap-2 lg:hidden">
            <button type="button" onClick={() => setShowExpense(true)} className="btn-primary text-sm">
              Record expense
            </button>
            <button type="button" onClick={() => setShowReplenish(true)} className="btn-secondary text-sm">
              Replenish
            </button>
            <button type="button" onClick={load} className="btn-secondary p-2.5 rounded-lg" aria-label="Refresh">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      {!branchId ? (
        <div className="card p-4 text-sm text-amber-400 border-amber-500/20 bg-amber-500/5">
          Select an active branch to manage petty cash.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(260px,280px)_1fr] gap-5 items-start w-full">
          <aside
            className="rounded-2xl border overflow-hidden sticky top-4"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
          >
            <div
              className="px-4 py-5 border-b"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.16) 0%, rgba(124,58,237,0.03) 100%)',
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Petty cash balance</p>
              <p className={`text-2xl font-extrabold tabular-nums mt-1 ${balance < 0 ? 'text-rose-400' : 'text-violet-300'}`}>
                {formatCurrency(balance)}
              </p>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{balanceLabel}</p>
            </div>

            <div className="p-3 space-y-3">
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Posting date
                </span>
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="input-field text-sm w-full" />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpense(true)}
                  className="py-2 rounded-lg text-xs font-bold text-white transition-all active:scale-[0.98] shadow-sm hover:shadow"
                  style={{ background: 'linear-gradient(180deg, #fb7185 0%, #e11d48 100%)' }}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setShowReplenish(true)}
                  className="py-2 rounded-lg text-xs font-bold text-white transition-all active:scale-[0.98] shadow-sm hover:shadow"
                  style={{ background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)' }}
                >
                  Replenish
                </button>
              </div>

              <button
                type="button"
                onClick={load}
                className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>

              <div className="rounded-xl border px-3 py-2.5 flex items-start gap-2.5" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-violet-500/10 border border-violet-500/20">
                  <Coins size={16} className="text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Imprest tip</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Record day-to-day spend as expenses. Replenish periodically from main cash to restore the float.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-5 min-w-0">
            <AccountingPanel title="Recent activity">
              {recent.length === 0 ? (
                <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>No recent petty cash entries.</p>
              ) : (
                <AccountingTable>
                  <thead>
                    <tr>
                      <AccountingTh>Entry</AccountingTh>
                      <AccountingTh>Date</AccountingTh>
                      <AccountingTh>Description</AccountingTh>
                      <AccountingTh align="right">Amount</AccountingTh>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r, i) => (
                      <tr key={i}>
                        <AccountingTd mono className="text-violet-400">{r.entryNo}</AccountingTd>
                        <AccountingTd>{r.entryDate}</AccountingTd>
                        <AccountingTd>{r.description ?? r.memo}</AccountingTd>
                        <AccountingTd align="right">
                          {r.debit > 0 ? formatCurrency(r.debit) : formatCurrency(-r.credit)}
                        </AccountingTd>
                      </tr>
                    ))}
                  </tbody>
                </AccountingTable>
              )}
            </AccountingPanel>
          </div>
        </div>
      )}

      {showExpense && (
        <AccountingModal title="Record petty cash expense" icon={Wallet} onClose={() => setShowExpense(false)}>
          <div className="space-y-4">
            <div
              className="rounded-xl px-4 py-3 border"
              style={{ background: 'rgba(225,29,72,0.08)', borderColor: 'rgba(225,29,72,0.25)' }}
            >
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Expense</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Balance: <span className={`font-semibold ${balance < 0 ? 'text-rose-500' : ''}`} style={balance >= 0 ? { color: 'var(--text-primary)' } : undefined}>{formatCurrency(balance)}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Date</span>
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="input-field text-sm w-full" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Amount (LKR)</span>
                <input type="number" min="0" step="0.01" value={expAmount} onChange={e => setExpAmount(e.target.value)} className="input-field text-sm w-full" autoFocus />
              </label>
            </div>

            <label className="block">
              <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Description</span>
              <input type="text" placeholder="e.g. Taxi, stationery, lunch" value={expDesc} onChange={e => setExpDesc(e.target.value)} className="input-field text-sm w-full" />
            </label>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowExpense(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button
                type="button"
                onClick={async () => { await postExpense(); setShowExpense(false) }}
                disabled={submitting}
                className="flex-1 text-sm text-white font-medium py-2 rounded-lg transition-colors bg-rose-600 hover:bg-rose-500"
              >
                {submitting ? 'Posting…' : 'Post expense'}
              </button>
            </div>
          </div>
        </AccountingModal>
      )}

      {showReplenish && (
        <AccountingModal title="Replenish petty cash" icon={Wallet} onClose={() => setShowReplenish(false)}>
          <div className="space-y-4">
            <div
              className="rounded-xl px-4 py-3 border"
              style={{ background: 'rgba(22,163,74,0.08)', borderColor: 'rgba(22,163,74,0.25)' }}
            >
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Replenish</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Transfer from main cash to restore the float.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Date</span>
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="input-field text-sm w-full" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Amount (LKR)</span>
                <input type="number" min="0" step="0.01" value={repAmount} onChange={e => setRepAmount(e.target.value)} className="input-field text-sm w-full" autoFocus />
              </label>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowReplenish(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button
                type="button"
                onClick={async () => { await postReplenish(); setShowReplenish(false) }}
                disabled={submitting}
                className="flex-1 text-sm text-white font-medium py-2 rounded-lg transition-colors bg-emerald-600 hover:bg-emerald-500"
              >
                {submitting ? 'Posting…' : 'Replenish'}
              </button>
            </div>
          </div>
        </AccountingModal>
      )}
    </AccountingPageShell>
  )
}
