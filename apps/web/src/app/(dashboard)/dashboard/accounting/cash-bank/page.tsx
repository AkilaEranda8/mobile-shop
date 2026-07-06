'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRightLeft, Loader2, Plus, RefreshCw, Landmark } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'

type Register = {
  kind: 'CASH' | 'BANK'
  id: string
  name: string
  branchName: string | null
  code: string
  glName: string
  balance: number
}

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

  if (!hasAccess) {
    return <div className="p-6 text-center text-slate-400"><Link href="/settings" className="text-violet-400">Enable Accounting</Link></div>
  }

  const clearing = registers.filter(r => r.code === '1110' || r.code === '1120')

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/accounting" className="text-slate-400 hover:text-white"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Landmark className="text-violet-400" size={26} /> Cash & Bank
          </h1>
        </div>
        <button type="button" onClick={load} className="p-2 rounded-lg border border-white/10 text-slate-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {registers.map(r => (
              <div key={`${r.kind}-${r.id}`} className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
                <p className="text-xs text-slate-500">{r.kind} · {r.code}</p>
                <p className="text-sm font-semibold text-white mt-1">{r.name}</p>
                <p className="text-lg font-bold text-violet-300 mt-2">{formatCurrency(r.balance)}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Panel title="Settle clearing">
              <div className="grid grid-cols-2 gap-2">
                <select value={clearingType} onChange={e => setClearingType(e.target.value as 'CARD' | 'UPI')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm">
                  <option value="CARD">CARD</option><option value="UPI">UPI</option>
                </select>
                <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
              </div>
              <button type="button" onClick={handleSettle} disabled={submitting}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white disabled:opacity-50">Post settlement</button>
              <p className="text-xs text-slate-500">Card: {formatCurrency(clearing.find(c => c.code === '1110')?.balance ?? 0)}</p>
            </Panel>

            <Panel title="Transfer">
              <div className="grid grid-cols-2 gap-2">
                <select value={fromType} onChange={e => setFromType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm">
                  {['CASH', 'BANK', 'CARD_CLEARING', 'UPI_CLEARING'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={toType} onChange={e => setToType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm">
                  {['CASH', 'BANK', 'CARD_CLEARING', 'UPI_CLEARING'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <input type="number" placeholder="Amount" value={transferAmount} onChange={e => setTransferAmount(e.target.value)}
                  className="col-span-2 w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
              </div>
              <button type="button" onClick={handleTransfer} disabled={submitting}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white disabled:opacity-50">Post transfer</button>
            </Panel>

            <Panel title="Bank reconciliation">
              <input type="number" placeholder="Statement balance" value={stmtBalance} onChange={e => setStmtBalance(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
              <button type="button" onClick={handleReconcile} disabled={submitting}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white disabled:opacity-50">Reconcile</button>
            </Panel>

            <Panel title="Add bank account">
              <input type="text" placeholder="Account name" value={newBankName} onChange={e => setNewBankName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
              <button type="button" onClick={handleAddBank} disabled={submitting}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white disabled:opacity-50 flex items-center gap-2">
                <Plus size={14} /> Add
              </button>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 p-4 space-y-2">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2"><ArrowRightLeft size={14} className="text-violet-400" /> {title}</h2>
      {children}
    </div>
  )
}
