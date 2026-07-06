'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, RefreshCw, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'

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

  if (!hasAccess) {
    return <div className="p-6 text-center text-slate-400"><Link href="/settings" className="text-violet-400">Enable Accounting</Link></div>
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/accounting" className="text-slate-400 hover:text-white"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="text-violet-400" size={26} /> Petty Cash
          </h1>
          <p className="text-sm text-slate-400 mt-1">Imprest float — expenses and replenishment</p>
        </div>
        <button type="button" onClick={load} className="p-2 rounded-lg border border-white/10 text-slate-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {!branchId ? (
        <p className="text-sm text-amber-400">Select an active branch to manage petty cash.</p>
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : (
        <>
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5">
            <p className="text-xs text-slate-500">Current balance</p>
            <p className="text-3xl font-bold text-violet-300">{formatCurrency(status?.balance ?? 0)}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-white">Record expense</h2>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
              <input type="number" placeholder="Amount" value={expAmount} onChange={e => setExpAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
              <input type="text" placeholder="Description" value={expDesc} onChange={e => setExpDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
              <button type="button" onClick={postExpense} disabled={submitting}
                className="w-full py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white disabled:opacity-50">Post Expense</button>
            </div>
            <div className="rounded-xl border border-white/10 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-white">Replenish from main cash</h2>
              <input type="number" placeholder="Amount" value={repAmount} onChange={e => setRepAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
              <button type="button" onClick={postReplenish} disabled={submitting}
                className="w-full py-2 rounded-lg text-sm font-semibold border border-violet-500/30 text-violet-300 disabled:opacity-50">Replenish</button>
            </div>
          </div>

          {(status?.recent?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold text-white">Recent activity</div>
              <table className="w-full text-sm">
                <tbody>
                  {status!.recent.map((r, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-4 py-2 font-mono text-violet-300">{r.entryNo}</td>
                      <td className="px-4 py-2 text-slate-400">{r.entryDate}</td>
                      <td className="px-4 py-2 text-slate-300">{r.description ?? r.memo}</td>
                      <td className="px-4 py-2 text-right text-slate-200">
                        {r.debit > 0 ? formatCurrency(r.debit) : formatCurrency(-r.credit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
