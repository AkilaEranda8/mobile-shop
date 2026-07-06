'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'
import {
  AccountingPageShell,
  AccountingFeatureGate,
  AccountingKpiCard,
  AccountingPageHeader,
  AccountingPanel,
  AccountingTable,
  AccountingTd,
  AccountingTh,
  VIOLET_ACCENT,
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
          <button type="button" onClick={load} className="btn-secondary p-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {!branchId ? (
        <div className="card p-4 text-sm text-amber-400 border-amber-500/20 bg-amber-500/5">
          Select an active branch to manage petty cash.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : (
        <>
          <AccountingKpiCard label="Current balance" value={formatCurrency(status?.balance ?? 0)} accent={VIOLET_ACCENT} />

          <div className="grid lg:grid-cols-2 gap-4 w-full">
            <AccountingPanel title="Record expense">
              <div className="p-5 space-y-3">
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="input-field text-sm" />
                <input type="number" placeholder="Amount" value={expAmount} onChange={e => setExpAmount(e.target.value)} className="input-field text-sm" />
                <input type="text" placeholder="Description" value={expDesc} onChange={e => setExpDesc(e.target.value)} className="input-field text-sm" />
                <button type="button" onClick={postExpense} disabled={submitting} className="btn-primary w-full text-sm">
                  Post Expense
                </button>
              </div>
            </AccountingPanel>
            <AccountingPanel title="Replenish from main cash">
              <div className="p-5 space-y-3">
                <input type="number" placeholder="Amount" value={repAmount} onChange={e => setRepAmount(e.target.value)} className="input-field text-sm" />
                <button type="button" onClick={postReplenish} disabled={submitting} className="btn-secondary w-full text-sm">
                  Replenish
                </button>
              </div>
            </AccountingPanel>
          </div>

          {(status?.recent?.length ?? 0) > 0 && (
            <AccountingPanel title="Recent activity">
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
                  {status!.recent.map((r, i) => (
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
            </AccountingPanel>
          )}
        </>
      )}
    </AccountingPageShell>
  )
}
