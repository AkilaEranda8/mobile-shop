'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DollarSign, Plus, Package as PackageIcon, Layers } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { useModuleAccess } from '@/lib/module-access'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import {
  HrFeatureGate, HrPageShell, HrError, HrModal, HrModalCancel, HrModalSubmit, HrField, HrStatCard,
} from '@/components/hr/hr-ui'

type Component = {
  id: string; name: string; code: string; kind: string; calcType: string
  defaultAmount: number; isActive: boolean
}
type SalaryPackage = {
  id: string; basicSalary: number; effectiveFrom: string; effectiveTo: string | null
  employee: { id: string; fullName: string; employeeCode: string }
  lines: Array<{ componentId: string; amount: number; component: Component }>
}
type Employee = { id: string; fullName: string; employeeCode: string }

export default function HrSalaryPage() {
  const { canEdit } = useModuleAccess()
  const [tab, setTab] = useState<'packages' | 'components'>('packages')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [components, setComponents] = useState<Component[]>([])
  const [packages, setPackages] = useState<SalaryPackage[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [pkgOpen, setPkgOpen] = useState(false)
  const [compOpen, setCompOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pkgForm, setPkgForm] = useState({
    employeeId: '', basicSalary: '', effectiveFrom: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' }),
  })
  const [compForm, setCompForm] = useState({
    name: '', code: '', kind: 'EARNING', calcType: 'FIXED', defaultAmount: '0',
  })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [c, p, e] = await Promise.all([
        hrApi.listSalaryComponents() as Promise<{ data: Component[] }>,
        hrApi.listSalaryPackages() as Promise<{ data: SalaryPackage[] }>,
        hrApi.listEmployees({ limit: '200' }) as Promise<{ data: { data: Employee[] } }>,
      ])
      setComponents(c.data ?? [])
      setPackages(p.data ?? [])
      setEmployees(e.data?.data ?? [])
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load salary')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const savePackage = async () => {
    if (!pkgForm.employeeId || !pkgForm.basicSalary) { toast.error('Employee and basic required'); return }
    setSaving(true)
    try {
      await hrApi.upsertSalaryPackage({
        employeeId: pkgForm.employeeId,
        basicSalary: Number(pkgForm.basicSalary),
        effectiveFrom: pkgForm.effectiveFrom,
        lines: components.filter(c => c.isActive).map(c => ({
          componentId: c.id, amount: c.defaultAmount,
        })),
      })
      toast.success('Package saved'); setPkgOpen(false); await load()
    } catch (err: unknown) { toast.error((err as Error)?.message ?? 'Save failed') }
    finally { setSaving(false) }
  }

  const saveComponent = async () => {
    if (!compForm.name || !compForm.code) { toast.error('Name and code required'); return }
    setSaving(true)
    try {
      await hrApi.createSalaryComponent({
        ...compForm, defaultAmount: Number(compForm.defaultAmount) || 0,
      })
      toast.success('Component created'); setCompOpen(false); await load()
    } catch (err: unknown) { toast.error((err as Error)?.message ?? 'Save failed') }
    finally { setSaving(false) }
  }

  const packageColumns = useMemo<ColumnDef<SalaryPackage>[]>(() => [
    {
      id: 'employee',
      accessorFn: r => r.employee.fullName,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => <span className="text-gray-900 dark:text-white">{row.original.employee.fullName}</span>,
    },
    {
      accessorKey: 'basicSalary',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Basic" />,
      cell: ({ row }) => <span className="text-gray-900 dark:text-white">{row.original.basicSalary.toLocaleString()}</span>,
    },
    {
      accessorKey: 'effectiveFrom',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Effective" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.effectiveFrom.slice(0, 10)}</span>,
    },
    {
      id: 'lines',
      accessorFn: r => r.lines.length,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Lines" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.lines.length}</span>,
    },
  ], [])

  const componentColumns = useMemo<ColumnDef<Component>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => <span className="font-medium text-gray-900 dark:text-white">{row.original.name}</span>,
    },
    {
      accessorKey: 'code',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
      cell: ({ row }) => <span className="font-mono text-xs text-gray-500 dark:text-slate-400">{row.original.code}</span>,
    },
    {
      accessorKey: 'kind',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Kind" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.kind}</span>,
    },
    {
      accessorKey: 'calcType',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Calc" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.calcType}</span>,
    },
    {
      accessorKey: 'defaultAmount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Default" />,
      cell: ({ row }) => <span className="text-gray-900 dark:text-white">{row.original.defaultAmount}</span>,
    },
    {
      accessorKey: 'isActive',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={`text-xs px-2 py-0.5 rounded-full ${row.original.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ], [])

  return (
    <HrFeatureGate>
      <HrPageShell title="Salary" subtitle="Components and employee packages" icon={DollarSign}
        actions={canEdit ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setCompOpen(true)} className="btn-secondary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Component
            </button>
            <button type="button" onClick={() => { setPkgForm(f => ({ ...f, employeeId: employees[0]?.id ?? '' })); setPkgOpen(true) }}
              className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Package
            </button>
          </div>
        ) : undefined}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HrStatCard label="Packages" value={packages.length} icon={PackageIcon} color="violet" />
          <HrStatCard label="Components" value={components.length} icon={Layers} color="blue" />
          <HrStatCard label="Active components" value={components.filter(c => c.isActive).length} icon={DollarSign} color="emerald" />
          <HrStatCard label="Employees" value={employees.length} icon={PackageIcon} color="sky" />
        </div>

        <div className="flex gap-2">
          {(['packages', 'components'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)} className="px-3 py-1.5 rounded-lg text-sm capitalize"
              style={{ background: tab === t ? 'var(--bg-subtle)' : 'transparent', color: 'var(--text-muted)' }}>{t}</button>
          ))}
        </div>
        {error && <HrError message={error} />}
        {!error && tab === 'packages' && (
          <ClientSideTable
            data={packages}
            columns={packageColumns}
            isLoading={loading}
            pageCount={Math.ceil((packages.length || 1) / 20)}
            searchableColumns={[]}
          />
        )}
        {!error && tab === 'components' && (
          <ClientSideTable
            data={components}
            columns={componentColumns}
            isLoading={loading}
            pageCount={Math.ceil((components.length || 1) / 20)}
            searchableColumns={[]}
          />
        )}
      </HrPageShell>

      {pkgOpen && (
        <HrModal
          title="Set salary package"
          onClose={() => setPkgOpen(false)}
          footer={(
            <>
              <HrModalCancel onClick={() => setPkgOpen(false)} disabled={saving} />
              <HrModalSubmit type="button" loading={saving} onClick={() => void savePackage()}>
                Save
              </HrModalSubmit>
            </>
          )}
        >
          <div className="space-y-3">
            <HrField label="Employee">
              <select value={pkgForm.employeeId} onChange={e => setPkgForm(f => ({ ...f, employeeId: e.target.value }))}
                className="input-field h-11 w-full">
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
            </HrField>
            <HrField label="Basic salary">
              <input type="number" value={pkgForm.basicSalary} onChange={e => setPkgForm(f => ({ ...f, basicSalary: e.target.value }))}
                className="input-field h-11 w-full" />
            </HrField>
            <HrField label="Effective from">
              <input type="date" value={pkgForm.effectiveFrom} onChange={e => setPkgForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                className="input-field h-11 w-full" />
            </HrField>
          </div>
        </HrModal>
      )}

      {compOpen && (
        <HrModal
          title="New component"
          onClose={() => setCompOpen(false)}
          footer={(
            <>
              <HrModalCancel onClick={() => setCompOpen(false)} disabled={saving} />
              <HrModalSubmit type="button" loading={saving} onClick={() => void saveComponent()}>
                Save
              </HrModalSubmit>
            </>
          )}
        >
          <div className="space-y-3">
            {(['name', 'code'] as const).map(k => (
              <HrField key={k} label={k}>
                <input value={compForm[k]} onChange={e => setCompForm(f => ({ ...f, [k]: e.target.value }))}
                  className="input-field h-11 w-full" />
              </HrField>
            ))}
            <HrField label="Kind">
              <select value={compForm.kind} onChange={e => setCompForm(f => ({ ...f, kind: e.target.value }))}
                className="input-field h-11 w-full">
                <option value="EARNING">Earning</option>
                <option value="DEDUCTION">Deduction</option>
                <option value="EMPLOYER">Employer</option>
              </select>
            </HrField>
            <HrField label="Default amount / %">
              <input type="number" value={compForm.defaultAmount} onChange={e => setCompForm(f => ({ ...f, defaultAmount: e.target.value }))}
                className="input-field h-11 w-full" />
            </HrField>
          </div>
        </HrModal>
      )}
    </HrFeatureGate>
  )
}
