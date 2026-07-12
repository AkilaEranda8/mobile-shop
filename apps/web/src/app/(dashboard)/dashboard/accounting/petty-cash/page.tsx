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
      <div className="space-y-5 pb-4 min-h-[calc(100vh-8rem)] -m-4 lg:-m-6 p-4 lg:p-6 dash-bg">
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
          <div className="dash-card dash-alert p-4 text-sm text-amber-400 border-amber-500/20 bg-amber-500/5">
            Select an active branch to manage petty cash.
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="dash-card dash-kpi p-4 flex flex-col dash-fade-1" style={{ ['--kpi-accent' as any]: 'var(--kpi-accent)' }}>
              <div className="flex items-start gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand-glow)' }}>
                  <Wallet size={16} className="text-violet-500 dark:text-violet-400" />
                </div>
                <span className="text-xs font-medium dash-text-secondary leading-tight mt-0.5">Current Balance</span>
              </div>
              <p className={`text-[22px] font-black tabular-nums leading-tight ${balance < 0 ? 'text-rose-500 dark:text-rose-400' : 'dash-text-primary'}`}>
                {formatCurrency(balance)}
              </p>
              <p className="text-[11px] dash-text-muted mt-0.5 font-medium">{balanceLabel}</p>
            </div>

            <button
              type="button"
              onClick={() => setShowExpense(true)}
              className="dash-card dash-action p-4 flex flex-col items-start text-left dash-fade-2"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(225,29,72,0.10)' }}>
                <Coins size={16} className="text-rose-500 dark:text-rose-400" />
              </div>
              <p className="text-xs font-bold dash-text-primary mt-2">Record Expense</p>
              <p className="text-[11px] dash-text-secondary mt-0.5">Post petty cash spend</p>
            </button>

            <button
              type="button"
              onClick={() => setShowReplenish(true)}
              className="dash-card dash-action p-4 flex flex-col items-start text-left dash-fade-3"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.10)' }}>
                <Wallet size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-xs font-bold dash-text-primary mt-2">Replenish Float</p>
              <p className="text-[11px] dash-text-secondary mt-0.5">Restore from main cash</p>
            </button>

            <div className="dash-card p-4 flex items-start gap-3 dash-fade-4 col-span-2 sm:col-span-1 xl:col-span-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(6,182,212,0.10)' }}>
                <Coins size={16} className="text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold dash-text-primary">Imprest tip</p>
                <p className="text-[11px] dash-text-secondary mt-0.5">
                  Record daily expenses, then replenish periodically to restore the agreed float amount.
                </p>
              </div>
              <button
                type="button"
                onClick={load}
                className="ml-auto btn-secondary px-3 py-2 text-xs rounded-xl"
                disabled={loading}
              >
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </span>
              </button>
            </div>
          </div>
        )}

        {!branchId || loading ? null : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="dash-card lg:col-span-12 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold dash-text-primary">Recent activity</h3>
                <span className="text-[11px] dash-text-muted">Last {Math.min(20, recent.length)} entries</span>
              </div>
              {recent.length === 0 ? (
                <div className="py-10 text-center text-sm dash-text-secondary">No recent petty cash entries.</div>
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
            </div>
          </div>
        )}
      </div>

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
