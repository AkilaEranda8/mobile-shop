'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '@/lib/hooks'
import { accountingApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import { getActiveBranchId } from '@/lib/active-branch'
import {
  AccountingPageShell,
  AccountingFeatureGate,
  AccountingModal,
  AccountingPageHeader,
  AccountingPanel,
  AccountingStatusBadge,
  AccountingTable,
  AccountingTd,
  AccountingTh,
} from '@/components/accounting/accounting-ui'

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
  const [remitType, setRemitType] = useState<'EPF' | 'ETF'>('EPF')
  const [remitAmount, setRemitAmount] = useState('')
  const [remitDate, setRemitDate] = useState(businessToday())

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

  async function handleRemittance() {
    if (!branchId) { toast.error('Select a branch'); return }
    const amount = Number(remitAmount)
    if (!amount || amount <= 0) { toast.error('Enter remittance amount'); return }
    setSubmitting(true)
    try {
      await accountingApi.postStatutoryRemittance({
        type: remitType,
        amount,
        branchId,
        entryDate: remitDate,
        paymentMethod: 'BANK_TRANSFER',
      })
      toast.success(`${remitType} remittance posted`)
      setRemitAmount('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remittance failed')
    } finally { setSubmitting(false) }
  }

  if (!hasAccess) return <AccountingFeatureGate />

  return (
    <AccountingPageShell>
      <AccountingPageHeader
        title="Payroll"
        subtitle="Monthly accrual and salary payment journals"
        icon={Users}
        actions={
          <button type="button" onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> New Run
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" /></div>
      ) : (
        <AccountingPanel title="Payroll runs">
          {runs.length === 0 ? (
            <p className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No payroll runs yet</p>
          ) : (
            <AccountingTable>
              <thead>
                <tr>
                  <AccountingTh>Entry</AccountingTh>
                  <AccountingTh>Period</AccountingTh>
                  <AccountingTh>Amount</AccountingTh>
                  <AccountingTh>Staff</AccountingTh>
                  <AccountingTh>Status</AccountingTh>
                  <AccountingTh />
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id}>
                    <AccountingTd mono className="text-violet-400">{r.entryNo}</AccountingTd>
                    <AccountingTd>{r.entryDate}</AccountingTd>
                    <AccountingTd className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(r.totalAmount)}</AccountingTd>
                    <AccountingTd>{r.employeeCount}</AccountingTd>
                    <AccountingTd>
                      <AccountingStatusBadge tone={r.status === 'PAID' ? 'success' : 'warning'}>{r.status}</AccountingStatusBadge>
                    </AccountingTd>
                    <AccountingTd align="right">
                      {r.status === 'ACCRUED' && (
                        <button type="button" onClick={() => handlePay(r.id)} disabled={submitting}
                          className="text-xs text-violet-400 hover:text-violet-300">Pay</button>
                      )}
                      {r.paymentEntryNo && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.paymentEntryNo}</span>}
                    </AccountingTd>
                  </tr>
                ))}
              </tbody>
            </AccountingTable>
          )}
        </AccountingPanel>
      )}

      <AccountingPanel title="EPF / ETF remittance">
        <div className="p-5 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Type</span>
            <select value={remitType} onChange={e => setRemitType(e.target.value as 'EPF' | 'ETF')} className="input-field text-sm w-32">
              <option value="EPF">EPF</option>
              <option value="ETF">ETF</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Amount (LKR)</span>
            <input type="number" value={remitAmount} onChange={e => setRemitAmount(e.target.value)} className="input-field text-sm w-36" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Date</span>
            <input type="date" value={remitDate} onChange={e => setRemitDate(e.target.value)} className="input-field text-sm" />
          </label>
          <button type="button" onClick={handleRemittance} disabled={submitting} className="btn-primary text-sm">
            Post remittance
          </button>
        </div>
      </AccountingPanel>

      {showCreate && (
        <AccountingModal title="New payroll accrual" icon={Users} onClose={() => setShowCreate(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Period</span>
                <input type="text" value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} placeholder="2026-07" className="input-field text-sm" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Entry date</span>
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="input-field text-sm" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={applyStatutory} onChange={e => setApplyStatutory(e.target.checked)} />
              Apply EPF (8%+12%) & ETF (3%) — Sri Lanka statutory
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {employees.map(e => (
                <div key={e.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{e.name}</span>
                  <input type="number" placeholder="Salary" value={lines[e.id] ?? ''}
                    onChange={ev => setLines(prev => ({ ...prev, [e.id]: ev.target.value }))}
                    className="input-field w-28 text-sm text-right" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button type="button" onClick={handleAccrue} disabled={submitting} className="btn-primary flex-1 text-sm">
                {submitting ? 'Posting…' : 'Accrue Payroll'}
              </button>
            </div>
          </div>
        </AccountingModal>
      )}
    </AccountingPageShell>
  )
}
