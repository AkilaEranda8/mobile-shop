'use client'

import { useCallback, useEffect, useState } from 'react'
import { CreditCard, Loader2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { useModuleAccess } from '@/lib/module-access'
import { HrFeatureGate, HrPageShell, HrLoading, HrError, HrModal, HrField } from '@/components/hr/hr-ui'

type Advance = {
  id: string; amount: number; status: string; reason: string | null; recoveredAmount: number
  employee: { id: string; fullName: string; employeeCode: string }
}
type Loan = {
  id: string; principal: number; outstanding: number; status: string; installmentCount: number; installmentAmount: number
  employee: { id: string; fullName: string; employeeCode: string }
}
type Employee = { id: string; fullName: string; employeeCode: string }

export default function HrAdvancesPage() {
  const { canEdit } = useModuleAccess()
  const [tab, setTab] = useState<'advances' | 'loans'>('advances')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [advances, setAdvances] = useState<Advance[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [advOpen, setAdvOpen] = useState(false)
  const [loanOpen, setLoanOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [advForm, setAdvForm] = useState({ employeeId: '', amount: '', reason: '' })
  const [loanForm, setLoanForm] = useState({ employeeId: '', principal: '', installmentCount: '6', interestRate: '0' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [a, l, e] = await Promise.all([
        hrApi.listAdvances() as Promise<{ data: Advance[] }>,
        hrApi.listLoans() as Promise<{ data: Loan[] }>,
        canEdit ? (hrApi.listEmployees({ limit: '200' }) as Promise<{ data: { data: Employee[] } }>) : Promise.resolve({ data: { data: [] as Employee[] } }),
      ])
      setAdvances(a.data ?? [])
      setLoans(l.data ?? [])
      setEmployees(e.data?.data ?? [])
    } catch (err: unknown) { setError((err as Error)?.message ?? 'Failed to load') }
    finally { setLoading(false) }
  }, [canEdit])

  useEffect(() => { void load() }, [load])

  const requestAdvance = async () => {
    try {
      await hrApi.requestAdvance({
        employeeId: advForm.employeeId || undefined,
        amount: Number(advForm.amount),
        reason: advForm.reason || null,
      })
      toast.success('Advance requested'); setAdvOpen(false); await load()
    } catch (e: unknown) { toast.error((e as Error)?.message ?? 'Failed') }
  }

  const requestLoan = async () => {
    try {
      await hrApi.requestLoan({
        employeeId: loanForm.employeeId || undefined,
        principal: Number(loanForm.principal),
        installmentCount: Number(loanForm.installmentCount) || 1,
        interestRate: Number(loanForm.interestRate) || 0,
      })
      toast.success('Loan requested'); setLoanOpen(false); await load()
    } catch (e: unknown) { toast.error((e as Error)?.message ?? 'Failed') }
  }

  const advAct = async (id: string, action: 'approve' | 'reject' | 'disburse') => {
    setBusyId(id)
    try {
      if (action === 'approve') await hrApi.approveAdvance(id)
      else if (action === 'reject') await hrApi.rejectAdvance(id)
      else await hrApi.disburseAdvance(id)
      toast.success(action); await load()
    } catch (e: unknown) { toast.error((e as Error)?.message ?? 'Failed') }
    finally { setBusyId(null) }
  }

  const loanAct = async (id: string, action: 'approve' | 'reject' | 'activate') => {
    setBusyId(id)
    try {
      if (action === 'approve') await hrApi.approveLoan(id)
      else if (action === 'reject') await hrApi.rejectLoan(id)
      else {
        const firstDueDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
        await hrApi.activateLoan(id, { firstDueDate })
      }
      toast.success(action); await load()
    } catch (e: unknown) { toast.error((e as Error)?.message ?? 'Failed') }
    finally { setBusyId(null) }
  }

  return (
    <HrFeatureGate>
      <HrPageShell title="Advances & Loans" subtitle="Request, approve, disburse — recoveries hit payroll" icon={CreditCard}
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdvOpen(true)} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
              <Plus className="w-4 h-4 inline mr-1" /> Advance
            </button>
            <button type="button" onClick={() => setLoanOpen(true)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}>
              <Plus className="w-4 h-4 inline mr-1" /> Loan
            </button>
          </div>
        }
      >
        <div className="flex gap-2">
          {(['advances', 'loans'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)} className="px-3 py-1.5 rounded-lg text-sm capitalize"
              style={{ background: tab === t ? 'var(--bg-subtle)' : 'transparent', color: 'var(--text-muted)' }}>{t}</button>
          ))}
        </div>
        {loading && <HrLoading />}
        {!loading && error && <HrError message={error} />}
        {!loading && !error && tab === 'advances' && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Recovered</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {advances.map(a => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{a.employee.fullName}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{a.amount.toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{a.recoveredAmount.toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{a.status}</td>
                    <td className="px-3 py-2">
                      {canEdit && a.status === 'REQUESTED' && (
                        <>
                          <button type="button" disabled={busyId === a.id} onClick={() => void advAct(a.id, 'approve')} className="px-2 py-1 rounded text-xs mr-1" style={{ color: '#6ee7b7' }}>Approve</button>
                          <button type="button" disabled={busyId === a.id} onClick={() => void advAct(a.id, 'reject')} className="px-2 py-1 rounded text-xs" style={{ color: '#fca5a5' }}>Reject</button>
                        </>
                      )}
                      {canEdit && a.status === 'APPROVED' && (
                        <button type="button" disabled={busyId === a.id} onClick={() => void advAct(a.id, 'disburse')} className="px-2 py-1 rounded text-xs" style={{ color: '#93c5fd' }}>
                          {busyId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Disburse'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!advances.length && <tr><td colSpan={5} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No advances</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && tab === 'loans' && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Principal</th>
                  <th className="px-3 py-2">Outstanding</th>
                  <th className="px-3 py-2">Installments</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map(l => (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{l.employee.fullName}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{l.principal.toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{l.outstanding.toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{l.installmentCount} × {l.installmentAmount.toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{l.status}</td>
                    <td className="px-3 py-2">
                      {canEdit && l.status === 'REQUESTED' && (
                        <>
                          <button type="button" onClick={() => void loanAct(l.id, 'approve')} className="px-2 py-1 rounded text-xs mr-1" style={{ color: '#6ee7b7' }}>Approve</button>
                          <button type="button" onClick={() => void loanAct(l.id, 'reject')} className="px-2 py-1 rounded text-xs" style={{ color: '#fca5a5' }}>Reject</button>
                        </>
                      )}
                      {canEdit && (l.status === 'APPROVED' || l.status === 'REQUESTED') && (
                        <button type="button" onClick={() => void loanAct(l.id, 'activate')} className="px-2 py-1 rounded text-xs" style={{ color: '#93c5fd' }}>Activate</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loans.length && <tr><td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No loans</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </HrPageShell>

      {advOpen && (
        <HrModal title="Request advance" onClose={() => setAdvOpen(false)}>
          <div className="space-y-3">
            {canEdit && employees.length > 0 && (
              <HrField label="Employee">
                <select value={advForm.employeeId} onChange={e => setAdvForm(f => ({ ...f, employeeId: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                  <option value="">My linked employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </HrField>
            )}
            <HrField label="Amount"><input type="number" value={advForm.amount} onChange={e => setAdvForm(f => ({ ...f, amount: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} /></HrField>
            <HrField label="Reason"><input value={advForm.reason} onChange={e => setAdvForm(f => ({ ...f, reason: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} /></HrField>
            <button type="button" onClick={() => void requestAdvance()} className="w-full py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>Submit</button>
          </div>
        </HrModal>
      )}
      {loanOpen && (
        <HrModal title="Request loan" onClose={() => setLoanOpen(false)}>
          <div className="space-y-3">
            {canEdit && employees.length > 0 && (
              <HrField label="Employee">
                <select value={loanForm.employeeId} onChange={e => setLoanForm(f => ({ ...f, employeeId: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                  <option value="">My linked employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </HrField>
            )}
            <HrField label="Principal"><input type="number" value={loanForm.principal} onChange={e => setLoanForm(f => ({ ...f, principal: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} /></HrField>
            <HrField label="Installments"><input type="number" value={loanForm.installmentCount} onChange={e => setLoanForm(f => ({ ...f, installmentCount: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} /></HrField>
            <button type="button" onClick={() => void requestLoan()} className="w-full py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>Submit</button>
          </div>
        </HrModal>
      )}
    </HrFeatureGate>
  )
}
