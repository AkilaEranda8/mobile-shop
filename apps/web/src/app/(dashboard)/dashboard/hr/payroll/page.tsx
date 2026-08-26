'use client'

import { useCallback, useEffect, useState } from 'react'
import { Wallet, Loader2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { getActiveBranchId } from '@/lib/active-branch'
import { useModuleAccess } from '@/lib/module-access'
import { HrFeatureGate, HrPageShell, HrLoading, HrError, HrModal, HrField } from '@/components/hr/hr-ui'

type Period = { id: string; label: string; startDate: string; endDate: string; status: string }
type Run = {
  id: string; status: string
  period: { id: string; label: string }
  _count?: { lines: number; payslips: number }
  resultSnapshot?: { totalNet?: number; payslipCount?: number } | null
}

function monthDefaults() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const last = new Date(y, now.getMonth() + 1, 0).getDate()
  return {
    label: `${y}-${m}`,
    startDate: `${y}-${m}-01`,
    endDate: `${y}-${m}-${String(last).padStart(2, '0')}`,
  }
}

export default function HrPayrollPage() {
  const { canEdit } = useModuleAccess()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [periods, setPeriods] = useState<Period[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const [periodForm, setPeriodForm] = useState(monthDefaults)
  const [periodId, setPeriodId] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [p, r] = await Promise.all([
        hrApi.listPayrollPeriods() as Promise<{ data: Period[] }>,
        hrApi.listPayrollRuns() as Promise<{ data: Run[] }>,
      ])
      setPeriods(p.data ?? [])
      setRuns(r.data ?? [])
      if (!periodId && p.data?.[0]) setPeriodId(p.data[0].id)
    } catch (e: unknown) { setError((e as Error)?.message ?? 'Failed to load payroll') }
    finally { setLoading(false) }
  }, [periodId])

  useEffect(() => { void load() }, [load])

  const createPeriod = async () => {
    try {
      await hrApi.createPayrollPeriod(periodForm)
      toast.success('Period created'); setPeriodOpen(false); await load()
    } catch (e: unknown) { toast.error((e as Error)?.message ?? 'Failed') }
  }

  const createRun = async () => {
    if (!periodId) { toast.error('Select a period'); return }
    try {
      await hrApi.createPayrollRun({ periodId })
      toast.success('Draft run created'); setRunOpen(false); await load()
    } catch (e: unknown) { toast.error((e as Error)?.message ?? 'Failed') }
  }

  const act = async (id: string, action: 'process' | 'approve' | 'pay' | 'cancel') => {
    setBusyId(id)
    try {
      if (action === 'process') await hrApi.processPayrollRun(id)
      else if (action === 'approve') await hrApi.approvePayrollRun(id)
      else if (action === 'pay') {
        const branchId = getActiveBranchId()
        if (!branchId) { toast.error('Select an active branch before paying'); return }
        await hrApi.payPayrollRun(id, { paymentMethod: 'CASH', branchId })
      }
      else await hrApi.cancelPayrollRun(id)
      toast.success(action)
      await load()
    } catch (e: unknown) { toast.error((e as Error)?.message ?? 'Failed') }
    finally { setBusyId(null) }
  }

  return (
    <HrFeatureGate>
      <HrPageShell title="Payroll" subtitle="Periods → draft → process → approve → pay (GL via accounting)" icon={Wallet}
        actions={canEdit ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setPeriodOpen(true)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}>
              <Plus className="w-4 h-4 inline mr-1" /> Period
            </button>
            <button type="button" onClick={() => setRunOpen(true)} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
              <Plus className="w-4 h-4 inline mr-1" /> Draft run
            </button>
          </div>
        ) : undefined}
      >
        {loading && <HrLoading />}
        {!loading && error && <HrError message={error} />}
        {!loading && !error && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Payslips</th>
                  <th className="px-3 py-2">Net</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{r.period.label}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r.status}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r._count?.payslips ?? 0}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                      {(r.resultSnapshot?.totalNet ?? 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {canEdit && (r.status === 'DRAFT' || r.status === 'REVIEW') && (
                          <button type="button" disabled={busyId === r.id} onClick={() => void act(r.id, 'process')} className="px-2 py-1 rounded text-xs" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}>
                            {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Process'}
                          </button>
                        )}
                        {canEdit && r.status === 'REVIEW' && (
                          <button type="button" disabled={busyId === r.id} onClick={() => void act(r.id, 'approve')} className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }}>Approve</button>
                        )}
                        {canEdit && r.status === 'APPROVED' && (
                          <button type="button" disabled={busyId === r.id} onClick={() => void act(r.id, 'pay')} className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd' }}>Pay</button>
                        )}
                        {canEdit && r.status !== 'PAID' && r.status !== 'CANCELLED' && (
                          <button type="button" disabled={busyId === r.id} onClick={() => void act(r.id, 'cancel')} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!runs.length && <tr><td colSpan={5} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No payroll runs yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </HrPageShell>

      {periodOpen && (
        <HrModal title="New payroll period" onClose={() => setPeriodOpen(false)}>
          <div className="space-y-3">
            <HrField label="Label"><input value={periodForm.label} onChange={e => setPeriodForm(f => ({ ...f, label: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} /></HrField>
            <HrField label="Start"><input type="date" value={periodForm.startDate} onChange={e => setPeriodForm(f => ({ ...f, startDate: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} /></HrField>
            <HrField label="End"><input type="date" value={periodForm.endDate} onChange={e => setPeriodForm(f => ({ ...f, endDate: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} /></HrField>
            <button type="button" onClick={() => void createPeriod()} className="w-full py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>Create</button>
          </div>
        </HrModal>
      )}
      {runOpen && (
        <HrModal title="Draft payroll run" onClose={() => setRunOpen(false)}>
          <div className="space-y-3">
            <HrField label="Period">
              <select value={periodId} onChange={e => setPeriodId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                {periods.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </HrField>
            <button type="button" onClick={() => void createRun()} className="w-full py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>Create draft</button>
          </div>
        </HrModal>
      )}
    </HrFeatureGate>
  )
}
