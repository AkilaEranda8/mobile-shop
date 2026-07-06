'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRightLeft, Loader2, Plus, RefreshCw, Landmark } from 'lucide-react'
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
  CYAN_ACCENT,
  GREEN_ACCENT,
  VIOLET_ACCENT,
} from '@/components/accounting/accounting-ui'

type Register = {
  kind: 'CASH' | 'BANK'
  id: string
  name: string
  branchName: string | null
  code: string
  glName: string
  balance: number
}

const REGISTER_ACCENTS = [VIOLET_ACCENT, CYAN_ACCENT, GREEN_ACCENT]

export default function CashBankPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const branchId = getActiveBranchId() ?? ''
  const [registers, setRegisters] = useState<Register[]>([])
  const [loading, setLoading] = useState(true)
  const [entryDate, setEntryDate] = useState(businessToday())
  const [amount, setAmount] = useState('')
  const [clearingType, setClearingType] = useState<'CARD' | 'UPI'>('CARD')
  const [submitting, setSubmitting] = useState(false)
  const [fromType, setFromType] = useState('CASH')
  const [toType, setToType] = useState('BANK')
  const [transferAmount, setTransferAmount] = useState('')
  const [stmtBalance, setStmtBalance] = useState('')
  const [newBankName, setNewBankName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await accountingApi.cashBankRegisters() as { data: Register[] }
      setRegisters(res.data ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load registers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  async function handleSettle() {
    const amt = Number(amount)
    if (!amt || amt <= 0 || !branchId) { toast.error('Enter amount and select branch'); return }
    setSubmitting(true)
    try {
      await accountingApi.settleClearing({ branchId, entryDate, clearingType, amount: amt })
      toast.success('Clearing settlement posted')
      setAmount('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Settlement failed')
    } finally { setSubmitting(false) }
  }

  async function handleTransfer() {
    const amt = Number(transferAmount)
    if (!amt || !branchId) { toast.error('Enter amount'); return }
    setSubmitting(true)
    try {
      await accountingApi.cashBankTransfer({ branchId, entryDate, amount: amt, fromType, toType })
      toast.success('Transfer posted')
      setTransferAmount('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed')
    } finally { setSubmitting(false) }
  }

  async function handleReconcile() {
    const bal = Number(stmtBalance)
    if (!branchId || Number.isNaN(bal)) { toast.error('Enter statement balance'); return }
    setSubmitting(true)
    try {
      const res = await accountingApi.reconcileBank({ branchId, entryDate, statementBalance: bal }) as { data: { balanced: boolean; adjustment: number } }
      toast.success(res.data.balanced ? 'Already balanced' : `Adjustment posted: ${formatCurrency(res.data.adjustment)}`)
      setStmtBalance('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reconciliation failed')
    } finally { setSubmitting(false) }
  }

  async function handleAddBank() {
    if (!newBankName.trim()) { toast.error('Enter bank name'); return }
    setSubmitting(true)
    try {
      await accountingApi.createBankAccount({ name: newBankName, ...(branchId ? { branchId } : {}) })
      toast.success('Bank account added')
      setNewBankName('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setSubmitting(false) }
  }

  if (!hasAccess) return <AccountingFeatureGate />

  const clearing = registers.filter(r => r.code === '1110' || r.code === '1120')

  return (
    <AccountingPageShell>
      <AccountingPageHeader
        title="Cash & Bank"
        subtitle="Registers, clearing settlement, transfers and reconciliation"
        icon={Landmark}
        actions={
          <button type="button" onClick={load} className="btn-secondary p-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
            {registers.map((r, i) => (
              <AccountingKpiCard
                key={`${r.kind}-${r.id}`}
                label={`${r.kind} · ${r.code}`}
                value={formatCurrency(r.balance)}
                sub={r.name}
                accent={REGISTER_ACCENTS[i % REGISTER_ACCENTS.length]}
              />
            ))}
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
            <AccountingPanel title="Settle clearing" icon={ArrowRightLeft}>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <select value={clearingType} onChange={e => setClearingType(e.target.value as 'CARD' | 'UPI')} className="input-field text-sm">
                    <option value="CARD">CARD</option>
                    <option value="UPI">UPI</option>
                  </select>
                  <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} className="input-field text-sm" />
                </div>
                <button type="button" onClick={handleSettle} disabled={submitting} className="btn-primary text-sm">
                  Post settlement
                </button>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Card clearing: {formatCurrency(clearing.find(c => c.code === '1110')?.balance ?? 0)}
                </p>
              </div>
            </AccountingPanel>

            <AccountingPanel title="Transfer" icon={ArrowRightLeft}>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <select value={fromType} onChange={e => setFromType(e.target.value)} className="input-field text-sm">
                    {['CASH', 'BANK', 'CARD_CLEARING', 'UPI_CLEARING'].map(v => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
                  </select>
                  <select value={toType} onChange={e => setToType(e.target.value)} className="input-field text-sm">
                    {['CASH', 'BANK', 'CARD_CLEARING', 'UPI_CLEARING'].map(v => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
                  </select>
                  <input type="number" placeholder="Amount" value={transferAmount} onChange={e => setTransferAmount(e.target.value)}
                    className="col-span-2 input-field text-sm" />
                </div>
                <button type="button" onClick={handleTransfer} disabled={submitting} className="btn-primary text-sm">
                  Post transfer
                </button>
              </div>
            </AccountingPanel>

            <AccountingPanel title="Bank reconciliation">
              <div className="p-5 space-y-3">
                <input type="number" placeholder="Statement balance" value={stmtBalance} onChange={e => setStmtBalance(e.target.value)} className="input-field text-sm" />
                <button type="button" onClick={handleReconcile} disabled={submitting} className="btn-primary text-sm">
                  Reconcile
                </button>
              </div>
            </AccountingPanel>

            <AccountingPanel title="Add bank account">
              <div className="p-5 space-y-3">
                <input type="text" placeholder="Account name" value={newBankName} onChange={e => setNewBankName(e.target.value)} className="input-field text-sm" />
                <button type="button" onClick={handleAddBank} disabled={submitting} className="btn-primary flex items-center gap-2 text-sm">
                  <Plus size={14} /> Add
                </button>
              </div>
            </AccountingPanel>
          </div>
        </>
      )}
    </AccountingPageShell>
  )
}
