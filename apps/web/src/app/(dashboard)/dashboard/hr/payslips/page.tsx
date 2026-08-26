'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Receipt, Wallet, Minus, Banknote } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { hrApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { HrFeatureGate, HrPageShell, HrError, HrStatCard } from '@/components/hr/hr-ui'

type Slip = {
  id: string; gross: number; deductions: number; net: number; issuedAt: string
  employee: { fullName: string; employeeCode: string }
  run: { status: string; period: { label: string } }
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  REVIEW: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  APPROVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  PAID: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  CANCELLED: 'bg-red-500/15 text-red-300 border-red-500/30',
}

export default function HrPayslipsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Slip[]>([])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await hrApi.listPayslips() as { data: Slip[] }
      setRows(res.data ?? [])
    } catch (e: unknown) { setError((e as Error)?.message ?? 'Failed to load payslips') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const totalGross = rows.reduce((s, r) => s + r.gross, 0)
  const totalDed = rows.reduce((s, r) => s + r.deductions, 0)
  const totalNet = rows.reduce((s, r) => s + r.net, 0)

  const columns = useMemo<ColumnDef<Slip>[]>(() => [
    {
      id: 'employee',
      accessorFn: r => r.employee.fullName,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.original.employee.fullName}</p>
          <p className="text-xs font-mono text-gray-500 dark:text-slate-500">{row.original.employee.employeeCode}</p>
        </div>
      ),
    },
    {
      id: 'period',
      accessorFn: r => r.run.period.label,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Period" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.run.period.label}</span>,
    },
    {
      accessorKey: 'gross',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Gross" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.gross.toLocaleString()}</span>,
    },
    {
      accessorKey: 'deductions',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Deductions" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.deductions.toLocaleString()}</span>,
    },
    {
      accessorKey: 'net',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Net" />,
      cell: ({ row }) => <span className="font-semibold text-gray-900 dark:text-white">{row.original.net.toLocaleString()}</span>,
    },
    {
      id: 'runStatus',
      accessorFn: r => r.run.status,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Run" />,
      cell: ({ row }) => (
        <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_STYLE[row.original.run.status] ?? STATUS_STYLE.DRAFT)}>
          {row.original.run.status}
        </span>
      ),
    },
  ], [])

  return (
    <HrFeatureGate>
      <HrPageShell title="Payslips" subtitle="Snapshots from processed payroll runs" icon={Receipt}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HrStatCard label="Payslips" value={rows.length} icon={Receipt} color="violet" />
          <HrStatCard label="Gross" value={totalGross.toLocaleString()} icon={Wallet} color="blue" />
          <HrStatCard label="Deductions" value={totalDed.toLocaleString()} icon={Minus} color="amber" />
          <HrStatCard label="Net" value={totalNet.toLocaleString()} icon={Banknote} color="emerald" />
        </div>

        {error && <HrError message={error} />}
        {!error && (
          <ClientSideTable
            data={rows}
            columns={columns}
            isLoading={loading}
            pageCount={Math.ceil((rows.length || 1) / 20)}
            searchableColumns={[]}
          />
        )}
      </HrPageShell>
    </HrFeatureGate>
  )
}
