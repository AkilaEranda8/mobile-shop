'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus, RefreshCw, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'

type Run = {
  id: string
  entryNo: string
  entryDate: string
  memo: string | null
  totalAmount: number
  employeeCount: number
  status: 'ACCRUED' | 'PAID'
  paymentEntryNo: string | null
}

type Employee = { id: string; name: string; email: string; role: string }

export default function PayrollPage() {
  const hasAccess = useFeatureFlag('ACCOUNTING')
  const branchId = getActiveBranchId() ?? ''
  const [runs, setRuns] = useState<Run[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [periodLabel, setPeriodLabel] = useState(() => businessToday().slice(0, 7))
  const [entryDate, setEntryDate] = useState(businessToday())
  const [lines, setLines] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [applyStatutory, setApplyStatutory] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rRes, eRes] = await Promise.all([
        accountingApi.payrollRuns() as Promise<{ data: Run[] }>,
        accountingApi.payrollEmployees() as Promise<{ data: Employee[] }>,
      ])
      setRuns(rRes.data ?? [])
      setEmployees(eRes.data ?? [])
      const init: Record<string, string> = {}
      for (const e of eRes.data ?? []) init[e.id] = ''
      setLines(init)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load payroll')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  async function handleAccrue() {
    const payrollLines = employees
      .map(e => ({ employeeName: e.name, userId: e.id, amount: Number(lines[e.id]) || 0 }))
      .filter(l => l.amount > 0)
    if (!payrollLines.length) { toast.error('Enter at least one salary amount'); return }
    setSubmitting(true)
    try {
      await accountingApi.createPayrollRun({
        entryDate,
        periodLabel,
        applyStatutory,
        lines: payrollLines,
        ...(branchId ? { branchId } : {}),
      })
      toast.success('Payroll accrued')
      setShowCreate(false)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Accrual failed')
    } finally { setSubmitting(false) }
  }

  async function handlePay(runId: string) {
    if (!branchId) { toast.error('Select a branch'); return }
    setSubmitting(true)
    try {
      await accountingApi.payPayrollRun(runId, { branchId, entryDate: businessToday(), paymentMethod: 'BANK_TRANSFER' })
      toast.success('Payroll payment posted')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed')
    } finally { setSubmitting(false) }
  }

  if (!hasAccess) {
    return <div className="p-6 text-center text-slate-400"><Link href="/settings" className="text-violet-400">Enable Accounting</Link></div>
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/accounting" className="text-slate-400 hover:text-white"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-violet-400" size={26} /> Payroll
          </h1>
          <p className="text-sm text-slate-400 mt-1">Monthly accrual and salary payment journals</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white">
          <Plus size={14} /> New Run
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500 border-b border-white/10">
              <tr>
                <th className="px-4 py-2">Entry</th>
                <th className="px-4 py-2">Period</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Staff</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No payroll runs yet</td></tr>
              ) : runs.map(r => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-4 py-2 font-mono text-violet-300">{r.entryNo}</td>
                  <td className="px-4 py-2 text-slate-400">{r.entryDate}</td>
                  <td className="px-4 py-2 text-white">{formatCurrency(r.totalAmount)}</td>
                  <td className="px-4 py-2 text-slate-400">{r.employeeCount}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.status === 'ACCRUED' && (
                      <button type="button" onClick={() => handlePay(r.id)} disabled={submitting}
                        className="text-xs text-violet-400 hover:text-violet-300">Pay</button>
                    )}
                    {r.paymentEntryNo && <span className="text-xs text-slate-600">{r.paymentEntryNo}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-slate-900 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white">New payroll accrual</h2>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} placeholder="2026-07"
                className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={applyStatutory} onChange={e => setApplyStatutory(e.target.checked)} />
              Apply EPF (8%+12%) & ETF (3%) — Sri Lanka statutory
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {employees.map(e => (
                <div key={e.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-slate-300 truncate">{e.name}</span>
                  <input type="number" placeholder="Salary" value={lines[e.id] ?? ''}
                    onChange={ev => setLines(prev => ({ ...prev, [e.id]: ev.target.value }))}
                    className="w-28 px-2 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-white text-sm text-right" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-400">Cancel</button>
              <button type="button" onClick={handleAccrue} disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white disabled:opacity-50">
                {submitting ? 'Posting…' : 'Accrue Payroll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
