'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Users, Plus, Loader2, Edit2, Search, Filter,
  UserRound, Building2, Briefcase, Phone, Link2, StickyNote, Calendar,
  UserCheck, Link as LinkIcon,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { hrApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { getOperationalBranchId, getVisibleBranches } from '@/lib/active-branch'
import { useUsers } from '@/lib/hooks'
import { useModuleAccess } from '@/lib/module-access'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { cn } from '@/lib/utils'
import {
  HrFeatureGate,
  HrPageShell,
  HrError,
  HrModal,
  HrModalCancel,
  HrModalSubmit,
  HrField,
  HrSection,
  HrChoicePills,
  HrAvatarBadge,
  HrStatCard,
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_STATUS_STYLE,
} from '@/components/hr/hr-ui'
import { TableActionsRow } from '@/components/table/table-actions-row'

type Employee = {
  id: string
  employeeCode: string
  fullName: string
  email: string | null
  phone: string | null
  emergencyName?: string | null
  emergencyPhone?: string | null
  notes?: string | null
  joinedAt?: string | null
  status: string
  employmentType: string
  department?: { id: string; name: string } | null
  designation?: { id: string; name: string } | null
  primaryBranch?: { id: string; name: string }
  user?: { id: string; name: string; email: string; role: string } | null
}

type Master = { id: string; name: string }

type TabId = 'profile' | 'org' | 'employment' | 'access'

const STATUS_OPTIONS = Object.entries(EMPLOYMENT_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
  tone: EMPLOYMENT_STATUS_STYLE[value],
}))
const TYPE_OPTIONS = Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const TABS: Array<{ id: TabId; label: string; icon: typeof UserRound }> = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'org', label: 'Organization', icon: Building2 },
  { id: 'employment', label: 'Employment', icon: Briefcase },
  { id: 'access', label: 'Access & Notes', icon: Link2 },
]

function toDateInput(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function EmployeeModal({
  employee,
  departments,
  designations,
  branches,
  users,
  defaultBranchId,
  onClose,
  onSaved,
}: {
  employee?: Employee
  departments: Master[]
  designations: Master[]
  branches: Array<{ id: string; name: string }>
  users: Array<{ id: string; name: string; email: string; role?: string }>
  defaultBranchId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!employee
  const [tab, setTab] = useState<TabId>('profile')
  const [detailLoading, setDetailLoading] = useState(isEdit)
  const [form, setForm] = useState({
    fullName: employee?.fullName ?? '',
    employeeCode: employee?.employeeCode ?? '',
    email: employee?.email ?? '',
    phone: employee?.phone ?? '',
    emergencyName: employee?.emergencyName ?? '',
    emergencyPhone: employee?.emergencyPhone ?? '',
    departmentId: employee?.department?.id ?? '',
    designationId: employee?.designation?.id ?? '',
    primaryBranchId: employee?.primaryBranch?.id ?? defaultBranchId ?? branches[0]?.id ?? '',
    userId: employee?.user?.id ?? '',
    employmentType: employee?.employmentType ?? 'FULL_TIME',
    status: employee?.status ?? 'ACTIVE',
    joinedAt: toDateInput(employee?.joinedAt) || new Date().toISOString().slice(0, 10),
    notes: employee?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    if (!employee?.id) {
      setDetailLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await hrApi.getEmployee(employee.id) as { data: Employee }
        if (cancelled || !res.data) return
        const d = res.data
        setForm({
          fullName: d.fullName ?? '',
          employeeCode: d.employeeCode ?? '',
          email: d.email ?? '',
          phone: d.phone ?? '',
          emergencyName: d.emergencyName ?? '',
          emergencyPhone: d.emergencyPhone ?? '',
          departmentId: d.department?.id ?? '',
          designationId: d.designation?.id ?? '',
          primaryBranchId: d.primaryBranch?.id ?? defaultBranchId ?? branches[0]?.id ?? '',
          userId: d.user?.id ?? '',
          employmentType: d.employmentType ?? 'FULL_TIME',
          status: d.status ?? 'ACTIVE',
          joinedAt: toDateInput(d.joinedAt) || '',
          notes: d.notes ?? '',
        })
      } catch {
        /* keep list-row defaults */
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [employee?.id, defaultBranchId, branches])

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm(p => ({ ...p, [key]: e.target.value }))

  const linkedUser = users.find(u => u.id === form.userId)
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return users.slice(0, 40)
    return users
      .filter(u =>
        u.name.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q)
        || (u.role ?? '').toLowerCase().includes(q),
      )
      .slice(0, 40)
  }, [users, userSearch])

  const validate = () => {
    if (!form.fullName.trim()) {
      setTab('profile')
      toast.error('Full name is required')
      return false
    }
    if (!form.primaryBranchId) {
      setTab('org')
      toast.error('Select a primary branch')
      return false
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setTab('profile')
      toast.error('Enter a valid email')
      return false
    }
    return true
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        fullName: form.fullName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        emergencyName: form.emergencyName.trim() || null,
        emergencyPhone: form.emergencyPhone.trim() || null,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
        primaryBranchId: form.primaryBranchId,
        userId: form.userId || null,
        employmentType: form.employmentType,
        status: form.status,
        joinedAt: form.joinedAt || null,
        notes: form.notes.trim() || null,
      }
      if (!isEdit && form.employeeCode.trim()) body.employeeCode = form.employeeCode.trim()
      if (isEdit) {
        const { userId: _u, ...updateBody } = body
        await hrApi.updateEmployee(employee!.id, updateBody)
        if ((employee?.user?.id ?? '') !== (form.userId || '')) {
          await hrApi.linkUser(employee!.id, form.userId || null)
        }
        toast.success('Employee updated')
      } else {
        await hrApi.createEmployee(body)
        toast.success('Employee created')
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
      wide
      title={isEdit ? 'Edit Employee' : 'Add Employee'}
      subtitle={isEdit ? `${employee?.employeeCode} · HR profile` : 'Create HR profile — optionally link a staff login'}
      icon={Users}
      onClose={onClose}
      footer={(
        <>
          <HrModalCancel onClick={onClose} disabled={loading} />
          <HrModalSubmit form="hr-employee-form" loading={loading || detailLoading}>
            {isEdit ? 'Save changes' : 'Create employee'}
          </HrModalSubmit>
        </>
      )}
    >
      <form id="hr-employee-form" onSubmit={submit} className="space-y-5">
        {detailLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={16} className="animate-spin" /> Loading employee…
          </div>
        ) : (
          <>
        <HrAvatarBadge
          name={form.fullName}
          code={isEdit ? employee?.employeeCode : (form.employeeCode.trim() || undefined)}
        />

        <div
          className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors -mb-px',
                )}
                style={{
                  borderBottom: `2px solid ${active ? 'var(--brand-primary)' : 'transparent'}`,
                  color: active ? 'var(--brand-light)' : 'var(--text-muted)',
                }}
              >
                <Icon size={13} />
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'profile' && (
          <HrSection title="Personal details" description="Identity and contact for this employee" icon={UserRound}>
            <div className="grid sm:grid-cols-2 gap-3">
              <HrField label="Full name" required className="sm:col-span-2">
                <input
                  required
                  className="input-field w-full"
                  placeholder="e.g. Nimal Perera"
                  value={form.fullName}
                  onChange={set('fullName')}
                  autoFocus={!isEdit}
                />
              </HrField>
              {!isEdit ? (
                <HrField label="Employee code" hint="Leave blank to auto-generate (EMP-0001…)" className="sm:col-span-2">
                  <input
                    className="input-field w-full font-mono"
                    placeholder="Auto if blank"
                    value={form.employeeCode}
                    onChange={set('employeeCode')}
                  />
                </HrField>
              ) : (
                <HrField label="Employee code" className="sm:col-span-2">
                  <div className="input-field w-full font-mono opacity-80 cursor-default">{employee?.employeeCode}</div>
                </HrField>
              )}
              <HrField label="Email">
                <input
                  type="email"
                  className="input-field w-full"
                  placeholder="name@shop.com"
                  value={form.email}
                  onChange={set('email')}
                />
              </HrField>
              <HrField label="Phone">
                <input
                  className="input-field w-full"
                  placeholder="07X XXX XXXX"
                  value={form.phone}
                  onChange={set('phone')}
                />
              </HrField>
            </div>
            <div className="rounded-xl p-3 space-y-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                <Phone size={12} /> Emergency contact
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <HrField label="Contact name">
                  <input
                    className="input-field w-full"
                    placeholder="Relative / guardian"
                    value={form.emergencyName}
                    onChange={set('emergencyName')}
                  />
                </HrField>
                <HrField label="Contact phone">
                  <input
                    className="input-field w-full"
                    placeholder="07X XXX XXXX"
                    value={form.emergencyPhone}
                    onChange={set('emergencyPhone')}
                  />
                </HrField>
              </div>
            </div>
          </HrSection>
        )}

        {tab === 'org' && (
          <HrSection title="Organization" description="Where this person sits in the shop structure" icon={Building2}>
            <div className="grid sm:grid-cols-2 gap-3">
              <HrField label="Primary branch" required className="sm:col-span-2">
                <select className="input-field w-full" value={form.primaryBranchId} onChange={set('primaryBranchId')} required>
                  <option value="" disabled>Select branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </HrField>
              <HrField label="Department">
                <select className="input-field w-full" value={form.departmentId} onChange={set('departmentId')}>
                  <option value="">Unassigned</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </HrField>
              <HrField label="Designation">
                <select className="input-field w-full" value={form.designationId} onChange={set('designationId')}>
                  <option value="">Unassigned</option>
                  {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </HrField>
            </div>
          </HrSection>
        )}

        {tab === 'employment' && (
          <HrSection title="Employment" description="Type, status, and start date" icon={Briefcase}>
            <HrField label="Employment type">
              <HrChoicePills
                value={form.employmentType}
                onChange={v => setForm(p => ({ ...p, employmentType: v }))}
                options={TYPE_OPTIONS}
              />
            </HrField>
            <HrField label="Status">
              <HrChoicePills
                value={form.status}
                onChange={v => setForm(p => ({ ...p, status: v }))}
                options={STATUS_OPTIONS}
              />
            </HrField>
            <HrField label="Joined date" hint="Used for tenure and payroll eligibility later">
              <div className="relative max-w-xs">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="date"
                  className="input-field w-full pl-9"
                  value={form.joinedAt}
                  onChange={set('joinedAt')}
                />
              </div>
            </HrField>
            {(form.status === 'RESIGNED' || form.status === 'TERMINATED') && (
              <div className="text-xs rounded-lg px-3 py-2 bg-amber-500/10 border border-amber-500/25 text-amber-200">
                Setting status to {EMPLOYMENT_STATUS_LABELS[form.status]} will mark the employee inactive and set left date.
              </div>
            )}
          </HrSection>
        )}

        {tab === 'access' && (
          <div className="space-y-6">
            <HrSection
              title="Staff login link"
              description="Optional — connect this HR profile to a Staff & Roles user for POS / dashboard access"
              icon={Link2}
            >
              {linkedUser ? (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{linkedUser.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {linkedUser.email}{linkedUser.role ? ` · ${linkedUser.role}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs px-2.5 py-1.5 rounded-lg border shrink-0"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                    onClick={() => setForm(p => ({ ...p, userId: '' }))}
                  >
                    Unlink
                  </button>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  No staff user linked. This employee can still exist for payroll / attendance without a login.
                </p>
              )}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  className="input-field w-full pl-9"
                  placeholder="Search staff by name or email…"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>
              <div
                className="max-h-44 overflow-y-auto rounded-xl divide-y"
                style={{ border: '1px solid var(--border-subtle)', borderColor: 'var(--border-subtle)' }}
              >
                {filteredUsers.map(u => {
                  const selected = form.userId === u.id
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, userId: u.id }))}
                      className={cn('w-full text-left px-3 py-2.5 transition-colors', selected ? 'bg-violet-500/10' : 'hover:bg-white/5')}
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {u.email}{u.role ? ` · ${u.role}` : ''}
                      </p>
                    </button>
                  )
                })}
                {!filteredUsers.length && (
                  <p className="px-3 py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>No matching staff users</p>
                )}
              </div>
            </HrSection>

            <HrSection title="Internal notes" description="Visible to managers with HR access only" icon={StickyNote}>
              <HrField label="Notes">
                <textarea
                  className="input-field w-full min-h-[96px] resize-y"
                  placeholder="Probation terms, remarks, document checklist…"
                  value={form.notes}
                  onChange={set('notes')}
                  maxLength={2000}
                />
              </HrField>
            </HrSection>
          </div>
        )}
          </>
        )}
      </form>
    </HrModal>
  )
}

export default function HrEmployeesPage() {
  const { canEdit } = useModuleAccess()
  const user = authStorage.getUser()
  const branches = useMemo(() => getVisibleBranches(user), [user])
  const defaultBranchId = getOperationalBranchId()
  const { data: usersData } = useUsers({ limit: '200' })
  const staffUsers = useMemo(() => {
    const rows = (usersData?.data ?? []) as Array<{ id: string; name: string; email: string; role?: string }>
    return rows
  }, [usersData])
  const [rows, setRows] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Master[]>([])
  const [designations, setDesignations] = useState<Master[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal] = useState<Employee | null | 'new'>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = {}
      if (search.trim()) params.search = search.trim()
      if (statusFilter) params.status = statusFilter
      const [empRes, deptRes, desRes] = await Promise.all([
        hrApi.listEmployees(params) as Promise<{ data: { data: Employee[] } }>,
        hrApi.listDepartments() as Promise<{ data: Master[] }>,
        hrApi.listDesignations() as Promise<{ data: Master[] }>,
      ])
      setRows(empRes.data?.data ?? [])
      setDepartments(deptRes.data ?? [])
      setDesignations(desRes.data ?? [])
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load employees')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const t = window.setTimeout(() => { void load() }, 250)
    return () => window.clearTimeout(t)
  }, [load])

  const activeCount = rows.filter(r => r.status === 'ACTIVE').length
  const linkedCount = rows.filter(r => !!r.user).length

  const columns = useMemo<ColumnDef<Employee>[]>(() => {
    const cols: ColumnDef<Employee>[] = [
      {
        accessorKey: 'fullName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{row.original.fullName}</p>
            <p className="text-xs font-mono text-gray-500 dark:text-slate-500">{row.original.employeeCode}</p>
          </div>
        ),
      },
      {
        id: 'branch',
        accessorFn: r => r.primaryBranch?.name ?? '',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Branch" />,
        cell: ({ row }) => (
          <span className="text-gray-500 dark:text-slate-400">{row.original.primaryBranch?.name ?? '—'}</span>
        ),
      },
      {
        id: 'deptTitle',
        accessorFn: r => [r.department?.name, r.designation?.name].filter(Boolean).join(' · '),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dept / Title" />,
        cell: ({ row }) => (
          <span className="text-gray-500 dark:text-slate-400">
            {[row.original.department?.name, row.original.designation?.name].filter(Boolean).join(' · ') || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const tone = EMPLOYMENT_STATUS_STYLE[row.original.status]
          return (
            <span className={cn('text-xs px-2 py-0.5 rounded-full border', tone?.bg, tone?.text, tone?.border)}>
              {EMPLOYMENT_STATUS_LABELS[row.original.status] ?? row.original.status}
            </span>
          )
        },
      },
      {
        id: 'linkedUser',
        accessorFn: r => r.user?.name ?? '',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Linked user" />,
        cell: ({ row }) => (
          <span className="text-xs text-gray-500 dark:text-slate-400">{row.original.user?.name ?? '—'}</span>
        ),
      },
    ]
    if (canEdit) {
      cols.push({
        id: 'actions',
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <TableActionsRow editAction={{ action: () => setModal(row.original) }} />
          </div>
        ),
      })
    }
    return cols
  }, [canEdit])

  return (
    <HrFeatureGate>
      <HrPageShell
        title="Employees"
        subtitle="HR profiles — optionally linked to staff login accounts"
        icon={Users}
        actions={canEdit && (
          <button type="button" onClick={() => setModal('new')} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Add employee
          </button>
        )}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HrStatCard label="Total" value={rows.length} icon={Users} color="violet" />
          <HrStatCard label="Active" value={activeCount} icon={UserCheck} color="emerald" />
          <HrStatCard label="Linked login" value={linkedCount} icon={LinkIcon} color="blue" />
          <HrStatCard label="Departments" value={departments.length} icon={Building2} color="sky" />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <ToolbarSearch
            value={search}
            onChange={setSearch}
            placeholder="Search name, code, email…"
            className="w-full sm:w-auto sm:min-w-[220px]"
          />
          <FilterDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS.map(({ value, label }) => ({ value, label }))]}
            icon={Filter}
            placeholder="Status"
            active={!!statusFilter}
            onClear={() => setStatusFilter('')}
          />
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
        <EmployeeModal
          employee={modal === 'new' ? undefined : modal}
          departments={departments}
          designations={designations}
          branches={branches}
          users={staffUsers}
          defaultBranchId={defaultBranchId}
          onClose={() => setModal(null)}
          onSaved={() => void load()}
        />
      )}
    </HrFeatureGate>
  )
}
