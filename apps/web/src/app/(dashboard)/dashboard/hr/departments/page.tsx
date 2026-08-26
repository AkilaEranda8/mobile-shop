'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Plus, Users, CheckCircle2, XCircle } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { useModuleAccess } from '@/lib/module-access'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import {
  HrFeatureGate,
  HrPageShell,
  HrError,
  HrModal,
  HrModalCancel,
  HrModalSubmit,
  HrField,
  HrStatCard,
} from '@/components/hr/hr-ui'

type Department = {
  id: string
  name: string
  code: string | null
  description: string | null
  isActive: boolean
  sortOrder: number
  _count?: { employees: number }
}

function DeptModal({
  row,
  onClose,
  onSaved,
}: {
  row?: Department
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!row
  const [form, setForm] = useState({
    name: row?.name ?? '',
    code: row?.code ?? '',
    description: row?.description ?? '',
    isActive: row?.isActive ?? true,
    sortOrder: String(row?.sortOrder ?? 0),
  })
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Department name is required')
      return
    }
    setLoading(true)
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      }
      if (isEdit) {
        await hrApi.updateDepartment(row!.id, body)
        toast.success('Department updated')
      } else {
        await hrApi.createDepartment(body)
        toast.success('Department created')
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <HrModal
      title={isEdit ? 'Edit Department' : 'Add Department'}
      subtitle="Organize employees into teams / units"
      icon={Building2}
      onClose={onClose}
      footer={(
        <>
          <HrModalCancel onClick={onClose} disabled={loading} />
          <HrModalSubmit form="hr-dept-form" loading={loading}>
            {isEdit ? 'Save changes' : 'Create department'}
          </HrModalSubmit>
        </>
      )}
    >
      <form id="hr-dept-form" onSubmit={submit} className="space-y-3">
        <HrField label="Name" required>
          <input required className="input-field h-11 w-full" placeholder="e.g. Sales Floor" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
        </HrField>
        <div className="grid grid-cols-2 gap-3">
          <HrField label="Code" hint="Optional short code">
            <input className="input-field h-11 w-full font-mono" placeholder="SALES" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
          </HrField>
          <HrField label="Sort order">
            <input type="number" min={0} className="input-field h-11 w-full" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))} />
          </HrField>
        </div>
        <HrField label="Description">
          <textarea className="input-field w-full min-h-[80px] resize-y" placeholder="What this department covers…" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </HrField>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
          Active department
        </label>
      </form>
    </HrModal>
  )
}

export default function HrDepartmentsPage() {
  const { canEdit } = useModuleAccess()
  const [rows, setRows] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<Department | null | 'new'>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await hrApi.listDepartments() as { data: Department[] }
      setRows(res.data ?? [])
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const activeCount = rows.filter(r => r.isActive).length
  const employeeTotal = rows.reduce((s, r) => s + (r._count?.employees ?? 0), 0)

  const columns = useMemo<ColumnDef<Department>[]>(() => {
    const cols: ColumnDef<Department>[] = [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 dark:text-white">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'code',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => (
          <span className="text-gray-500 dark:text-slate-400">{row.original.code || '—'}</span>
        ),
      },
      {
        id: 'employees',
        accessorFn: r => r._count?.employees ?? 0,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employees" />,
        cell: ({ row }) => (
          <span className="text-gray-500 dark:text-slate-400">{row.original._count?.employees ?? 0}</span>
        ),
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
    ]
    if (canEdit) {
      cols.push({
        id: 'actions',
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <TableActionsRow editAction={{ action: () => setModal(row.original) }} />
        ),
      })
    }
    return cols
  }, [canEdit])

  return (
    <HrFeatureGate>
      <HrPageShell
        title="Departments"
        subtitle="Organizational units for employee assignment"
        icon={Building2}
        actions={canEdit && (
          <button type="button" onClick={() => setModal('new')} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Add department
          </button>
        )}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HrStatCard label="Total" value={rows.length} icon={Building2} color="violet" />
          <HrStatCard label="Active" value={activeCount} icon={CheckCircle2} color="emerald" />
          <HrStatCard label="Inactive" value={rows.length - activeCount} icon={XCircle} color="slate" />
          <HrStatCard label="Employees" value={employeeTotal} icon={Users} color="blue" />
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
      {modal && (
        <DeptModal
          row={modal === 'new' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => void load()}
        />
      )}
    </HrFeatureGate>
  )
}
