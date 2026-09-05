'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { TrendingUp, Plus, Users, ListChecks, Wallet, Tag, Percent } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { useModuleAccess } from '@/lib/module-access'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { HrFeatureGate, HrPageShell, HrError, HrModal, HrModalCancel, HrModalSubmit, HrField, HrStatCard } from '@/components/hr/hr-ui'

type Rule = { id: string; name: string; source: string; ratePercent: number; flatPerUnit: number; isActive: boolean }
type PreviewRow = {
  employee: { id: string; fullName: string; employeeCode: string }
  total: number; docCount: number
  bySource: Record<string, number>
}

function monthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const last = new Date(y, now.getMonth() + 1, 0).getDate()
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(last).padStart(2, '0')}` }
}

export default function HrCommissionPage() {
  const { canEdit } = useModuleAccess()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rules, setRules] = useState<Rule[]>([])
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [range, setRange] = useState(monthRange)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', source: 'SALES', ratePercent: '0.5', flatPerUnit: '0' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [r, p] = await Promise.all([
        hrApi.listCommissionRules() as Promise<{ data: Rule[] }>,
        hrApi.commissionPreview(range) as Promise<{ data: { rows: PreviewRow[]; grandTotal: number } }>,
      ])
      setRules(r.data ?? [])
      setRows(p.data?.rows ?? [])
      setGrandTotal(p.data?.grandTotal ?? 0)
    } catch (e: unknown) { setError((e as Error)?.message ?? 'Failed to load') }
    finally { setLoading(false) }
  }, [range])

  useEffect(() => { void load() }, [load])

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!form.name.trim()) { toast.error('Rule name is required'); return }
    setSaving(true)
    try {
      await hrApi.createCommissionRule({
        name: form.name.trim(),
        source: form.source,
        ratePercent: Number(form.ratePercent) || 0,
        flatPerUnit: Number(form.flatPerUnit) || 0,
      })
      toast.success('Rule created'); setOpen(false); await load()
    } catch (err: unknown) { toast.error((err as Error)?.message ?? 'Failed') }
    finally { setSaving(false) }
  }

  const previewColumns = useMemo<ColumnDef<PreviewRow>[]>(() => [
    {
      id: 'employee',
      accessorFn: r => r.employee.fullName,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => <span className="text-gray-900 dark:text-white">{row.original.employee.fullName}</span>,
    },
    {
      accessorKey: 'docCount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Docs" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.docCount}</span>,
    },
    {
      id: 'sales',
      accessorFn: r => r.bySource.SALES ?? 0,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sales" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{(row.original.bySource.SALES ?? 0).toLocaleString()}</span>,
    },
    {
      id: 'repairs',
      accessorFn: r => r.bySource.REPAIRS ?? 0,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Repairs" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{(row.original.bySource.REPAIRS ?? 0).toLocaleString()}</span>,
    },
    {
      id: 'hp',
      accessorFn: r => r.bySource.HIRE_PURCHASE ?? 0,
      header: ({ column }) => <DataTableColumnHeader column={column} title="HP" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{(row.original.bySource.HIRE_PURCHASE ?? 0).toLocaleString()}</span>,
    },
    {
      id: 'van',
      accessorFn: r => r.bySource.WHOLESALE_VAN ?? 0,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Van" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{(row.original.bySource.WHOLESALE_VAN ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'total',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
      cell: ({ row }) => <span className="font-semibold text-gray-900 dark:text-white">{row.original.total.toLocaleString()}</span>,
    },
  ], [])

  const ruleColumns = useMemo<ColumnDef<Rule>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Rule" />,
      cell: ({ row }) => <span className="font-medium text-gray-900 dark:text-white">{row.original.name}</span>,
    },
    {
      accessorKey: 'source',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.source}</span>,
    },
    {
      accessorKey: 'ratePercent',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Rate %" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.ratePercent}%</span>,
    },
    {
      accessorKey: 'flatPerUnit',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Flat" />,
      cell: ({ row }) => <span className="text-gray-500 dark:text-slate-400">{row.original.flatPerUnit}</span>,
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
      <HrPageShell title="Commission" subtitle="Staff sales / repair / van-rep incentive preview (calc only)" icon={TrendingUp}
        actions={canEdit ? (
          <button type="button" onClick={() => setOpen(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Rule
          </button>
        ) : undefined}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HrStatCard label="Period total" value={Number(grandTotal.toFixed(0))} icon={Wallet} color="blue" />
          <HrStatCard label="Staff with earnings" value={rows.filter(r => r.total > 0).length} icon={Users} color="emerald" />
          <HrStatCard label="Active rules" value={rules.filter(r => r.isActive).length} icon={ListChecks} color="blue" />
          <HrStatCard label="Preview rows" value={rows.length} icon={TrendingUp} color="sky" />
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>From
            <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
              className="block mt-1 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>To
            <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
              className="block mt-1 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
          </label>
        </div>
        {error && <HrError message={error} />}
        {!error && (
          <>
            <ClientSideTable
              data={rows}
              columns={previewColumns}
              isLoading={loading}
              pageCount={Math.ceil((rows.length || 1) / 20)}
              searchableColumns={[]}
            />
            <ClientSideTable
              data={rules}
              columns={ruleColumns}
              isLoading={loading}
              pageCount={Math.ceil((rules.length || 1) / 20)}
              searchableColumns={[]}
            />
          </>
        )}
      </HrPageShell>
      {open && (
        <HrModal
          title="Add commission rule"
          subtitle="Incentive rate for sales, repairs, hire purchase, or van / wholesale rep"
          icon={ListChecks}
          onClose={() => setOpen(false)}
          footer={(
            <>
              <HrModalCancel onClick={() => setOpen(false)} disabled={saving} />
              <HrModalSubmit form="hr-commission-rule-form" loading={saving}>
                Create rule
              </HrModalSubmit>
            </>
          )}
        >
          <form id="hr-commission-rule-form" onSubmit={e => void save(e)} className="space-y-5">
            <HrField label="Name" required>
              <div className="relative">
                <Tag size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  required
                  autoFocus
                  placeholder="e.g. Van rep 1%"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field h-11 w-full pl-10"
                />
              </div>
            </HrField>
            <HrField label="Source" required>
              <select
                required
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="input-field h-11 w-full"
              >
                <option value="SALES">Sales (retail POS)</option>
                <option value="REPAIRS">Repairs</option>
                <option value="HIRE_PURCHASE">Hire purchase</option>
                <option value="WHOLESALE_VAN">Van / wholesale rep</option>
              </select>
            </HrField>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Van source uses wholesale van invoices attributed to the rep&apos;s login (Employee must be linked to that user — auto-created when you add a sales rep under Wholesale → Rep / Van).
            </p>
            <div className="grid grid-cols-2 gap-4">
              <HrField label="Rate %" required hint="Percent of attributed revenue">
                <div className="relative">
                  <Percent size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.50"
                    value={form.ratePercent}
                    onChange={e => setForm(f => ({ ...f, ratePercent: e.target.value }))}
                    className="input-field h-11 w-full pl-10"
                  />
                </div>
              </HrField>
              <HrField label="Flat per unit" hint="Optional fixed amount">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.flatPerUnit}
                  onChange={e => setForm(f => ({ ...f, flatPerUnit: e.target.value }))}
                  className="input-field h-11 w-full"
                />
              </HrField>
            </div>
          </form>
        </HrModal>
      )}
    </HrFeatureGate>
  )
}
