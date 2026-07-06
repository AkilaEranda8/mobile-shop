'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Receipt, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'

type VatSummary = { from: string; to: string; outputVat: number; inputVat: number; netPayable: number }

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD'] as const

export default function TaxPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const branchId = getActiveBranchId() ?? ''
  const [summary, setSummary] = useState<VatSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => businessToday().slice(0, 8) + '01')
  const [to, setTo] = useState(businessToday())
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<string>('BANK_TRANSFER')
  const [payLoading, setPayLoading] = useState(false)
  const [taxCodes, setTaxCodes] = useState<Array<{ code: string; name: string; rate: number; type: string; glAccount: { code: string } }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, codesRes] = await Promise.all([
        accountingApi.vatSummary({ from, to }) as Promise<{ data: VatSummary }>,
        accountingApi.taxCodes() as Promise<{ data: typeof taxCodes }>,
      ])
      setSummary(sumRes.data)
      setTaxCodes(codesRes.data ?? [])
      setPayAmount(String(Math.max(0, sumRes.data.netPayable)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load VAT summary')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  async function handleVatPayment() {
    const amount = Number(payAmount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!branchId) { toast.error('Select a branch'); return }
    setPayLoading(true)
    try {
      await accountingApi.vatPayment({ branchId, entryDate: to, amount, paymentMethod: payMethod, from, to })
      toast.success('VAT payment posted')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'VAT payment failed')
    } finally {
      setPayLoading(false)
    }
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
            <Receipt className="text-violet-400" size={26} /> VAT / Tax
          </h1>
          <p className="text-sm text-slate-400 mt-1">Output vs input VAT and remittance</p>
        </div>
        <button type="button" onClick={load} className="p-2 rounded-lg border border-white/10 text-slate-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : summary && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Stat label="Output VAT" value={summary.outputVat} />
            <Stat label="Input VAT" value={summary.inputVat} />
            <Stat label="Net Payable" value={summary.netPayable} highlight />
          </div>

          <div className="rounded-xl border border-white/10 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Record VAT Payment</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button type="button" onClick={handleVatPayment} disabled={payLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50">
                {payLoading ? 'Posting…' : 'Post VAT Payment'}
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold text-white">Tax codes</div>
            <table className="w-full text-sm">
              <tbody>
                {taxCodes.map(t => (
                  <tr key={t.code} className="border-t border-white/5">
                    <td className="px-4 py-2 font-mono text-violet-300">{t.code}</td>
                    <td className="px-4 py-2 text-slate-300">{t.name}</td>
                    <td className="px-4 py-2 text-slate-400">{t.type} · {t.rate}%</td>
                    <td className="px-4 py-2 text-slate-500">{t.glAccount.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/10 bg-white/[0.02]'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? 'text-violet-300' : 'text-white'}`}>{formatCurrency(value)}</p>
    </div>
  )
}
