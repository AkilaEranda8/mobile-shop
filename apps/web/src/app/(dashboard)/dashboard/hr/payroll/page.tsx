'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Wallet, Loader2, Plus, FileText, CheckCircle2 } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { getActiveBranchId } from '@/lib/active-branch'
import { useModuleAccess } from '@/lib/module-access'
import { cn } from '@/lib/utils'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { HrFeatureGate, HrPageShell, HrError, HrModal, HrModalCancel, HrModalSubmit, HrField, HrStatCard } from '@/components/hr/hr-ui'

type Period = { id: string; label: string; startDate: string; endDate: string; status: string }
type Run = {
  id: string; status: string
  period: { id: string; label: string }
  _count?: { lines: number; payslips: number }
  resultSnapshot?: { totalNet?: number; payslipCount?: number } | null
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  REVIEW: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  APPROVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  PAID: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  CANCELLED: 'bg-red-500/15 text-red-300 border-red-500/30',
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

  const paidCount = runs.filter(r => r.status === 'PAID').length
  const draftCount = runs.filter(r => r.status === 'DRAFT' || r.status === 'REVIEW').length

  const columns = useMemo<ColumnDef<Run>[]>(() => [
    {
      id: 'period',
      accessorFn: r => r.period.label,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Period" />,
      cell: ({ row }) => <span className="text-gray-900 dark:text-white">{row.original.period.label}</span>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_STYLE[row.original.status] ?? STATUS_STYLE.DRAFT)}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'payslips',
      accessorFn: r => r._count?.payslips ?? 0,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Payslips" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original._count?.payslips ?? 0}</span>,
    },
    {
      id: 'net',
      accessorFn: r => r.resultSnapshot?.totalNet ?? 0,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Net" />,
      cell: ({ row }) => (
        <span className="text-gray-900 dark:text-white">
          {(row.original.resultSnapshot?.totalNet ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className="flex flex-wrap gap-1 justify-end">
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
        )
      },
    },
  ], [canEdit, busyId])

  return (
    <HrFeatureGate>
      <HrPageShell title="Payroll" subtitle="Periods → draft → process → approve → pay (GL via accounting)" icon={Wallet}
        actions={canEdit ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setPeriodOpen(true)} className="btn-secondary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Period
            </button>
            <button type="button" onClick={() => setRunOpen(true)} className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Draft run
            </button>
          </div>
        ) : undefined}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HrStatCard label="Runs" value={runs.length} icon={Wallet} color="violet" />
          <HrStatCard label="In progress" value={draftCount} icon={FileText} color="amber" />
          <HrStatCard label="Paid" value={paidCount} icon={CheckCircle2} color="emerald" />
          <HrStatCard label="Periods" value={periods.length} icon={FileText} color="blue" />
        </div>

        {error && <HrError message={error} />}
        {!error && (
          <ClientSideTable
            data={runs}
            columns={columns}
            isLoading={loading}
            pageCount={Math.ceil((runs.length || 1) / 20)}
            searchableColumns={[]}
          />
        )}
      </HrPageShell>

      {periodOpen && (
        <HrModal
          title="New payroll period"
          onClose={() => setPeriodOpen(false)}
          footer={(
            <>
              <HrModalCancel onClick={() => setPeriodOpen(false)} />
              <HrModalSubmit type="button" onClick={() => void createPeriod()}>
                Create
              </HrModalSubmit>
            </>
          )}
        >
          <div className="space-y-3">
            <HrField label="Label"><input value={periodForm.label} onChange={e => setPeriodForm(f => ({ ...f, label: e.target.value }))} className="input-field h-11 w-full" /></HrField>
            <HrField label="Start"><input type="date" value={periodForm.startDate} onChange={e => setPeriodForm(f => ({ ...f, startDate: e.target.value }))} className="input-field h-11 w-full" /></HrField>
            <HrField label="End"><input type="date" value={periodForm.endDate} onChange={e => setPeriodForm(f => ({ ...f, endDate: e.target.value }))} className="input-field h-11 w-full" /></HrField>
          </div>
        </HrModal>
      )}
      {runOpen && (
        <HrModal
          title="Draft payroll run"
          onClose={() => setRunOpen(false)}
          footer={(
            <>
              <HrModalCancel onClick={() => setRunOpen(false)} />
              <HrModalSubmit type="button" onClick={() => void createRun()}>
                Create draft
              </HrModalSubmit>
            </>
          )}
        >
          <div className="space-y-3">
            <HrField label="Period">
              <select value={periodId} onChange={e => setPeriodId(e.target.value)} className="input-field h-11 w-full">
                {periods.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </HrField>
          </div>
        </HrModal>
      )}
    </HrFeatureGate>
  )
}
