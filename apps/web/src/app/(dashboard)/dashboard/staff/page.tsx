'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { UserCheck, Plus, X, Loader2, Mail, Clock, Edit2, Trash2, AlertTriangle, Building2, Eye, EyeOff, Save, CheckCircle } from 'lucide-react'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { useUsers, useBranches } from '@/lib/hooks'
import { usersApi, tenantApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { getOperationalBranchId } from '@/lib/active-branch'
import toast from 'react-hot-toast'
import {
  ROLE_PERMISSION_MODULES,
  STAFF_ROLES,
  ACCESS_LEVEL_META,
  DEFAULT_ROLE_PERMISSIONS,
  normalizeRolePermissions,
  type RoleAccessLevel,
  type RolePermissionMatrix,
  type StaffRole,
  type RolePermissionModuleKey,
} from '@/lib/role-permissions'

const roleConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  OWNER: { label: 'Owner', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  MANAGER: { label: 'Manager', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  TECHNICIAN: { label: 'Technician', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  CASHIER: { label: 'Cashier', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
}

const avatarColors = ['from-violet-600/40 to-violet-800/40', 'from-cyan-600/40 to-cyan-800/40', 'from-green-600/40 to-green-800/40', 'from-amber-600/40 to-amber-800/40', 'from-blue-600/40 to-blue-800/40']

const BASE_ROLE_OPTIONS = [
  { value: 'MANAGER',    label: 'Manager'    },
  { value: 'CASHIER',    label: 'Cashier'    },
  { value: 'TECHNICIAN', label: 'Technician' },
]

function roleOptionsFor(actorRole?: string) {
  if (actorRole === 'OWNER') {
    return [{ value: 'OWNER', label: 'Owner' }, ...BASE_ROLE_OPTIONS]
  }
  return BASE_ROLE_OPTIONS
}

function cycleAccess(current: RoleAccessLevel): RoleAccessLevel {
  if (current === 'hide') return 'view'
  if (current === 'view') return 'edit'
  return 'hide'
}

function AccessCell({
  level,
  locked,
  onChange,
}: {
  level: RoleAccessLevel
  locked?: boolean
  onChange?: (next: RoleAccessLevel) => void
}) {
  const meta = ACCESS_LEVEL_META[level]
  const Icon = level === 'hide' ? EyeOff : level === 'view' ? Eye : CheckCircle
  if (locked || !onChange) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${meta.className}`}
        title={meta.label}
      >
        <Icon size={12} />
        {meta.label}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onChange(cycleAccess(level))}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition hover:brightness-110 ${meta.className}`}
      title={`Click to cycle: Hide → View → Edit (now ${meta.label})`}
    >
      <Icon size={12} />
      {meta.label}
    </button>
  )
}

function PermissionMatrixPanel({ canEdit }: { canEdit: boolean }) {
  const [matrix, setMatrix] = useState<RolePermissionMatrix>(DEFAULT_ROLE_PERMISSIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const tenantId = authStorage.getUser()?.tenantId

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!tenantId) {
        setLoading(false)
        return
      }
      try {
        const res: any = await tenantApi.getRolePermissions(tenantId)
        if (cancelled) return
        setMatrix(normalizeRolePermissions(res?.data ?? res))
        setDirty(false)
      } catch {
        if (!cancelled) toast.error('Failed to load permission matrix')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tenantId])

  const setCell = (role: StaffRole, key: RolePermissionModuleKey, level: RoleAccessLevel) => {
    if (role === 'OWNER') return
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [key]: level },
    }))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!tenantId || !canEdit) return
    setSaving(true)
    try {
      const res: any = await tenantApi.updateRolePermissions(tenantId, matrix)
      const next = normalizeRolePermissions(res?.data ?? res)
      setMatrix(next)
      setDirty(false)
      try { localStorage.setItem('hx_role_permissions', JSON.stringify(next)) } catch { /* noop */ }
      window.dispatchEvent(new Event('role-permissions-updated'))
      toast.success('Permission matrix saved')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setMatrix(DEFAULT_ROLE_PERMISSIONS)
    setDirty(true)
  }

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Loading permission matrix…
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Role Permission Matrix</h3>
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
            {canEdit
              ? 'You (Owner) can enable or hide any feature for Manager, Cashier, and Technician. Click a cell: Hide → View → Edit, then Save. Owner column stays full access.'
              : 'Hide removes the feature from staff. View allows read-only. Edit allows full use. Only the owner can change this matrix.'}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={handleReset} className="btn-secondary text-xs px-3 py-1.5">
              Reset defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-b border-white/5 flex flex-wrap gap-3 text-[11px] text-slate-500">
        {(['hide', 'view', 'edit'] as RoleAccessLevel[]).map((lvl) => (
          <span key={lvl} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 ${ACCESS_LEVEL_META[lvl].className}`}>
            {ACCESS_LEVEL_META[lvl].label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-white/5">
              <th className="table-header text-left">Feature</th>
              {STAFF_ROLES.map((role) => (
                <th key={role} className="table-header text-center">
                  {roleConfig[role]?.label ?? role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/3">
            {ROLE_PERMISSION_MODULES.map((mod) => (
              <tr key={mod.key} className="hover:bg-white/2">
                <td className="table-cell text-sm font-medium text-gray-700 dark:text-slate-300">
                  <div>{mod.label}</div>
                  {mod.key === 'PRODUCT_COST' && (
                    <p className="text-[10px] font-normal text-slate-500 mt-0.5">
                      Buying price &amp; margin. Set View/Edit on staff columns to enable for them.
                    </p>
                  )}
                </td>
                {STAFF_ROLES.map((role) => (
                  <td key={role} className="table-cell text-center">
                    <AccessCell
                      level={matrix[role][mod.key]}
                      locked={role === 'OWNER' || !canEdit}
                      onChange={
                        role === 'OWNER' || !canEdit
                          ? undefined
                          : (next) => setCell(role, mod.key, next)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dirty && canEdit && (
        <div className="px-4 py-2 border-t border-amber-500/20 bg-amber-500/5 text-xs text-amber-300">
          Unsaved changes — click Save to apply for all staff.
        </div>
      )}
    </div>
  )
}

function StaffFormModal({
  staff, branches, defaultBranchId, onClose, onSaved,
}: {
  staff?: any
  branches: Array<{ id: string; name: string }>
  defaultBranchId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!staff
  const initialBranchIds = staff?.branches?.map((b: { branchId: string }) => b.branchId)
    ?? (branches.length === 1
      ? [branches[0].id]
      : defaultBranchId && branches.some(b => b.id === defaultBranchId)
        ? [defaultBranchId]
        : [])
  const [form, setForm] = useState({
    name:     staff?.name     ?? '',
    email:    staff?.email    ?? '',
    phone:    staff?.phone    ?? '',
    role:     staff?.role     ?? 'CASHIER',
    password: '',
    isActive: staff?.isActive ?? true,
    branchIds: initialBranchIds as string[],
  })
  const [loading, setLoading] = useState(false)
  const actorRole = authStorage.getUser()?.role
  const roleOptions = roleOptionsFor(actorRole)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let branchIds = branches.length === 1 ? [branches[0].id] : form.branchIds
      if (!branchIds.length && defaultBranchId) branchIds = [defaultBranchId]
      if (!branchIds.length) {
        toast.error('Select at least one branch for this staff member')
        setLoading(false)
        return
      }
      if (isEdit) {
        const body: any = { name: form.name, phone: form.phone, role: form.role, isActive: form.isActive, branchIds }
        if (form.password) body.password = form.password
        await usersApi.update(staff.id, body)
        toast.success('Staff member updated')
      } else {
        await usersApi.create({ ...form, branchIds })
        toast.success('Staff member added')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? (isEdit ? 'Failed to update' : 'Failed to add staff'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <UserCheck size={14} className="text-violet-400" />
            </div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {isEdit ? 'Edit Staff Member' : 'Add Staff Member'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Full Name *</label>
              <input required className="input-field" placeholder="Arjun Kumar" value={form.name} onChange={f('name')} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Email *</label>
              <input required type="email" className="input-field" placeholder="staff@shop.com" value={form.email} onChange={f('email')} disabled={isEdit} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Phone</label>
              <input className="input-field" placeholder="9876543210" value={form.phone} onChange={f('phone')} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Role</label>
              <select className="input-field" value={form.role} onChange={f('role')}
                disabled={isEdit && staff?.role === 'OWNER' && actorRole !== 'OWNER'}>
                {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                {isEdit && staff?.role === 'OWNER' && actorRole !== 'OWNER' && (
                  <option value="OWNER">Owner</option>
                )}
              </select>
              {form.role === 'OWNER' && (
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Full access to all branches, settings, and staff management
                </p>
              )}
            </div>
            {isEdit && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Status</label>
                <select className="input-field" value={form.isActive ? 'true' : 'false'}
                  onChange={e => setForm(p => ({ ...p, isActive: e.target.value === 'true' }))}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {isEdit ? 'New Password (leave blank to keep current)' : 'Temporary Password *'}
              </label>
              <input type="password" className="input-field" placeholder="Min 8 characters"
                required={!isEdit} value={form.password} onChange={f('password')} />
            </div>
            {branches.length > 1 && (
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Branches</label>
                <div className="flex flex-wrap gap-2">
                  {branches.map(b => (
                    <label key={b.id} className="flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded-lg border"
                      style={{ borderColor: 'var(--border-subtle)' }}>
                      <input type="checkbox" checked={form.branchIds.includes(b.id)}
                        onChange={() => setForm(p => ({
                          ...p,
                          branchIds: p.branchIds.includes(b.id)
                            ? p.branchIds.filter(id => id !== b.id)
                            : [...p.branchIds, b.id],
                        }))} />
                      {b.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : isEdit ? <Edit2 size={14} /> : <Plus size={14} />}
              {isEdit ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ name, onConfirm, onClose, loading }: { name: string; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Remove Staff Member</h3>
          <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Are you sure you want to remove <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</span>? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 text-sm flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-60">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StaffPage() {
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState(() => getOperationalBranchId() ?? '')
  const [tab, setTab] = useState<'staff' | 'permissions'>('staff')
  const [showAdd, setShowAdd] = useState(false)
  const [editStaff, setEditStaff] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const actorRole = authStorage.getUser()?.role
  const canEditMatrix = actorRole === 'OWNER' || actorRole === 'PLATFORM_ADMIN'
  const defaultBranchId = getOperationalBranchId()

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'add' || action === 'new' || searchParams.get('new') === '1') setShowAdd(true)
    if (searchParams.get('tab') === 'permissions') setTab('permissions')
  }, [searchParams])

  useEffect(() => {
    const syncBranch = () => {
      const id = getOperationalBranchId()
      if (id) setBranchFilter(id)
    }
    syncBranch()
    window.addEventListener('active-branch-changed', syncBranch)
    return () => window.removeEventListener('active-branch-changed', syncBranch)
  }, [])

  const { data: branchesRaw } = useBranches()
  const branches = ((branchesRaw as any[]) ?? []).map((b: any) => ({ id: b.id, name: b.name }))
  const listParams: Record<string, string> = {}
  if (search) listParams.search = search
  // Scope to branch: assigned staff only. Owner may clear filter to see everyone.
  if (branchFilter) {
    listParams.branchId = branchFilter
  } else if (!canEditMatrix && defaultBranchId) {
    listParams.branchId = defaultBranchId
  }
  const { data, loading, refetch } = useUsers(listParams)
  const users: any[] = (data?.data ?? []) as any[]
  const activeCount = users.filter((u: any) => u.isActive).length

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await usersApi.remove(deleteTarget.id)
      toast.success(`${deleteTarget.name} removed`)
      setDeleteTarget(null)
      refetch()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to remove staff')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {showAdd      && (
        <StaffFormModal
          branches={branches}
          defaultBranchId={branchFilter || defaultBranchId}
          onClose={() => setShowAdd(false)}
          onSaved={refetch}
        />
      )}
      {editStaff    && (
        <StaffFormModal
          staff={editStaff}
          branches={branches}
          defaultBranchId={branchFilter || defaultBranchId}
          onClose={() => setEditStaff(null)}
          onSaved={refetch}
        />
      )}
      {deleteTarget && <DeleteConfirmModal name={deleteTarget.name} loading={deleteLoading} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Staff & Roles</h1>
          <p className="page-subtitle">{activeCount} active · {users.length} total employees</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2 sm:ml-auto">
          <Plus size={14} />Add Staff
        </button>
      </div>

      <div className="flex gap-1 bg-white/3 border border-white/5 rounded-xl p-1 w-fit">
        {(['staff', 'permissions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20' : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}>
            {t === 'permissions' ? 'Permission Matrix' : 'Staff List'}
          </button>
        ))}
      </div>

      {tab === 'staff' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <ToolbarSearch
              value={search}
              onChange={setSearch}
              placeholder="Search staff…"
              className="flex-1 min-w-[200px] max-w-sm"
            />
            {branches.length > 1 && (
              <FilterDropdown
                value={canEditMatrix ? branchFilter : (branchFilter || defaultBranchId || '')}
                onChange={(v) => setBranchFilter(v)}
                options={[
                  ...(canEditMatrix ? [{ value: '', label: 'All Branches' }] : []),
                  ...branches.map(b => ({ value: b.id, label: b.name })),
                ]}
                icon={Building2}
                placeholder="Branch"
                active={canEditMatrix ? branchFilter !== '' : !!(branchFilter || defaultBranchId)}
                onClear={canEditMatrix ? () => setBranchFilter('') : undefined}
              />
            )}
          </div>

          {loading && <p className="text-sm text-slate-500">Loading staff...</p>}

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {users.map((s: any, i: number) => {
              const role = roleConfig[s.role] ?? roleConfig['OWNER']
              const initials = (s.name ?? '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div key={s.id} className="card p-5 hover:border-violet-500/20 transition-all">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} border border-white/10 flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${role.color} ${role.bg} ${role.border}`}>{role.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full mr-1 ${s.isActive ? 'bg-green-400' : 'bg-slate-500'}`} />
                      <button onClick={() => setEditStaff(s)} className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors" title="Edit"><Edit2 size={13} /></button>
                      <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remove"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-500">
                      <Mail size={11} className="flex-shrink-0" /><span className="truncate">{s.email}</span>
                    </div>
                    {s.branches?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {s.branches.map((b: { branchId: string }) => {
                          const name = branches.find(x => x.id === b.branchId)?.name ?? 'Branch'
                          return (
                            <span key={b.branchId} className="text-[9px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20">
                              {name}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-500">
                      <Clock size={11} className="flex-shrink-0" />
                      <span>Joined {new Date(s.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4 pt-4 border-t border-white/5">
                    <div className="flex-1 text-center">
                      <p className="text-[10px] font-medium text-gray-700 dark:text-slate-300 capitalize">{s.role?.toLowerCase().replace('_', ' ')}</p>
                      <p className="text-[10px] text-slate-500">Role</p>
                    </div>
                    <div className="w-px bg-white/5" />
                    <div className="flex-1 text-center">
                      <p className={`text-[10px] font-medium ${s.isActive ? 'text-green-400' : 'text-slate-500'}`}>{s.isActive ? 'Active' : 'Inactive'}</p>
                      <p className="text-[10px] text-slate-500">Status</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {!loading && users.length === 0 && (
            <div className="card p-12 text-center">
              <UserCheck size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No staff found</p>
            </div>
          )}
        </>
      )}

      {tab === 'permissions' && <PermissionMatrixPanel canEdit={canEditMatrix} />}
    </div>
  )
}
