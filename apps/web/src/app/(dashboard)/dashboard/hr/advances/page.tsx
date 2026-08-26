'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreditCard, Loader2, Plus, Banknote, Landmark } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { useModuleAccess } from '@/lib/module-access'
import { cn } from '@/lib/utils'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { HrFeatureGate, HrPageShell, HrError, HrModal, HrModalCancel, HrModalSubmit, HrField, HrStatCard } from '@/components/hr/hr-ui'

type Advance = {
  id: string; amount: number; status: string; reason: string | null; recoveredAmount: number
  employee: { id: string; fullName: string; employeeCode: string }
}
type Loan = {
  id: string; principal: number; outstanding: number; status: string; installmentCount: number; installmentAmount: number
  employee: { id: string; fullName: string; employeeCode: string }
}
type Employee = { id: string; fullName: string; employeeCode: string }

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  APPROVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  REJECTED: 'bg-red-500/15 text-red-300 border-red-500/30',
  DISBURSED: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  ACTIVE: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  CLOSED: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  RECOVERING: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
}

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

  const advanceColumns = useMemo<ColumnDef<Advance>[]>(() => [
    {
      id: 'employee',
      accessorFn: r => r.employee.fullName,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => <span className="text-gray-900 dark:text-white">{row.original.employee.fullName}</span>,
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
      cell: ({ row }) => <span className="text-gray-900 dark:text-white">{row.original.amount.toLocaleString()}</span>,
    },
    {
      accessorKey: 'recoveredAmount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Recovered" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.recoveredAmount.toLocaleString()}</span>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_STYLE[row.original.status] ?? STATUS_STYLE.REQUESTED)}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const a = row.original
        return (
          <div className="flex flex-wrap gap-1 justify-end">
            {canEdit && a.status === 'REQUESTED' && (
              <>
                <button type="button" disabled={busyId === a.id} onClick={() => void advAct(a.id, 'approve')} className="px-2 py-1 rounded text-xs" style={{ color: '#6ee7b7' }}>Approve</button>
                <button type="button" disabled={busyId === a.id} onClick={() => void advAct(a.id, 'reject')} className="px-2 py-1 rounded text-xs" style={{ color: '#fca5a5' }}>Reject</button>
              </>
            )}
            {canEdit && a.status === 'APPROVED' && (
              <button type="button" disabled={busyId === a.id} onClick={() => void advAct(a.id, 'disburse')} className="px-2 py-1 rounded text-xs" style={{ color: '#93c5fd' }}>
                {busyId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Disburse'}
              </button>
            )}
          </div>
        )
      },
    },
  ], [canEdit, busyId])

  const loanColumns = useMemo<ColumnDef<Loan>[]>(() => [
    {
      id: 'employee',
      accessorFn: r => r.employee.fullName,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => <span className="text-gray-900 dark:text-white">{row.original.employee.fullName}</span>,
    },
    {
      accessorKey: 'principal',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Principal" />,
      cell: ({ row }) => <span className="text-gray-900 dark:text-white">{row.original.principal.toLocaleString()}</span>,
    },
    {
      accessorKey: 'outstanding',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Outstanding" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.outstanding.toLocaleString()}</span>,
    },
    {
      id: 'installments',
      accessorFn: r => r.installmentCount,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Installments" />,
      cell: ({ row }) => (
        <span className="text-gray-500 dark:text-slate-400">
          {row.original.installmentCount} × {row.original.installmentAmount.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_STYLE[row.original.status] ?? STATUS_STYLE.REQUESTED)}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const l = row.original
        return (
          <div className="flex flex-wrap gap-1 justify-end">
            {canEdit && l.status === 'REQUESTED' && (
              <>
                <button type="button" onClick={() => void loanAct(l.id, 'approve')} className="px-2 py-1 rounded text-xs" style={{ color: '#6ee7b7' }}>Approve</button>
                <button type="button" onClick={() => void loanAct(l.id, 'reject')} className="px-2 py-1 rounded text-xs" style={{ color: '#fca5a5' }}>Reject</button>
              </>
            )}
            {canEdit && (l.status === 'APPROVED' || l.status === 'REQUESTED') && (
              <button type="button" onClick={() => void loanAct(l.id, 'activate')} className="px-2 py-1 rounded text-xs" style={{ color: '#93c5fd' }}>Activate</button>
            )}
          </div>
        )
      },
    },
  ], [canEdit])

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HrStatCard label="Advances" value={advances.length} icon={Banknote} color="violet" />
          <HrStatCard label="Pending advances" value={advances.filter(a => a.status === 'REQUESTED').length} icon={CreditCard} color="amber" />
          <HrStatCard label="Loans" value={loans.length} icon={Landmark} color="blue" />
          <HrStatCard label="Active loans" value={loans.filter(l => l.status === 'ACTIVE' || l.status === 'APPROVED').length} icon={Landmark} color="emerald" />
        </div>

        <div className="flex gap-2">
          {(['advances', 'loans'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)} className="px-3 py-1.5 rounded-lg text-sm capitalize"
              style={{ background: tab === t ? 'var(--bg-subtle)' : 'transparent', color: 'var(--text-muted)' }}>{t}</button>
          ))}
        </div>
        {error && <HrError message={error} />}
        {!error && tab === 'advances' && (
          <ClientSideTable
            data={advances}
            columns={advanceColumns}
            isLoading={loading}
            pageCount={Math.ceil((advances.length || 1) / 20)}
            searchableColumns={[]}
          />
        )}
        {!error && tab === 'loans' && (
          <ClientSideTable
            data={loans}
            columns={loanColumns}
            isLoading={loading}
            pageCount={Math.ceil((loans.length || 1) / 20)}
            searchableColumns={[]}
          />
        )}
      </HrPageShell>

      {advOpen && (
        <HrModal
          title="Request advance"
          onClose={() => setAdvOpen(false)}
          footer={(
            <>
              <HrModalCancel onClick={() => setAdvOpen(false)} />
              <HrModalSubmit type="button" onClick={() => void requestAdvance()}>
                Submit
              </HrModalSubmit>
            </>
          )}
        >
          <div className="space-y-3">
            {canEdit && employees.length > 0 && (
              <HrField label="Employee">
                <select value={advForm.employeeId} onChange={e => setAdvForm(f => ({ ...f, employeeId: e.target.value }))} className="input-field h-11 w-full">
                  <option value="">My linked employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </HrField>
            )}
            <HrField label="Amount"><input type="number" value={advForm.amount} onChange={e => setAdvForm(f => ({ ...f, amount: e.target.value }))} className="input-field h-11 w-full" /></HrField>
            <HrField label="Reason"><input value={advForm.reason} onChange={e => setAdvForm(f => ({ ...f, reason: e.target.value }))} className="input-field h-11 w-full" /></HrField>
          </div>
        </HrModal>
      )}
      {loanOpen && (
        <HrModal
          title="Request loan"
          onClose={() => setLoanOpen(false)}
          footer={(
            <>
              <HrModalCancel onClick={() => setLoanOpen(false)} />
              <HrModalSubmit type="button" onClick={() => void requestLoan()}>
                Submit
              </HrModalSubmit>
            </>
          )}
        >
          <div className="space-y-3">
            {canEdit && employees.length > 0 && (
              <HrField label="Employee">
                <select value={loanForm.employeeId} onChange={e => setLoanForm(f => ({ ...f, employeeId: e.target.value }))} className="input-field h-11 w-full">
                  <option value="">My linked employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </HrField>
            )}
            <HrField label="Principal"><input type="number" value={loanForm.principal} onChange={e => setLoanForm(f => ({ ...f, principal: e.target.value }))} className="input-field h-11 w-full" /></HrField>
            <HrField label="Installments"><input type="number" value={loanForm.installmentCount} onChange={e => setLoanForm(f => ({ ...f, installmentCount: e.target.value }))} className="input-field h-11 w-full" /></HrField>
          </div>
        </HrModal>
      )}
    </HrFeatureGate>
  )
}
