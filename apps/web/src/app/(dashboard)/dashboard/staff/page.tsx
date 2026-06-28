'use client'

import { useState } from 'react'
import { UserCheck, Plus, Search, CheckCircle, XCircle, X, Loader2, Mail, Clock, Edit2, Trash2, AlertTriangle, Building2 } from 'lucide-react'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { useUsers, useBranches } from '@/lib/hooks'
import { usersApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import toast from 'react-hot-toast'

const roleConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  OWNER: { label: 'Owner', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  MANAGER: { label: 'Manager', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  TECHNICIAN: { label: 'Technician', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  CASHIER: { label: 'Cashier', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
}

const avatarColors = ['from-violet-600/40 to-violet-800/40', 'from-cyan-600/40 to-cyan-800/40', 'from-green-600/40 to-green-800/40', 'from-amber-600/40 to-amber-800/40', 'from-blue-600/40 to-blue-800/40']

const permissionMatrix = [
  { feature: 'Dashboard', owner: true, manager: true, technician: false, sales: false },
  { feature: 'Point of Sale', owner: true, manager: true, technician: false, sales: true },
  { feature: 'Inventory', owner: true, manager: true, technician: false, sales: false },
  { feature: 'Repair Jobs', owner: true, manager: true, technician: true, sales: false },
  { feature: 'Customers', owner: true, manager: true, technician: false, sales: true },
  { feature: 'Finance', owner: true, manager: true, technician: false, sales: false },
  { feature: 'Reports', owner: true, manager: true, technician: false, sales: false },
  { feature: 'Staff', owner: true, manager: false, technician: false, sales: false },
  { feature: 'Settings', owner: true, manager: false, technician: false, sales: false },
]

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

function StaffFormModal({
  staff, branches, onClose, onSaved,
}: { staff?: any; branches: Array<{ id: string; name: string }>; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!staff
  const initialBranchIds = staff?.branches?.map((b: { branchId: string }) => b.branchId) ?? (branches.length === 1 ? [branches[0].id] : [])
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
      const branchIds = branches.length === 1 ? [branches[0].id] : form.branchIds
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
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [tab, setTab] = useState<'staff' | 'permissions'>('staff')
  const [showAdd, setShowAdd] = useState(false)
  const [editStaff, setEditStaff] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { data: branchesRaw } = useBranches()
  const branches = ((branchesRaw as any[]) ?? []).map((b: any) => ({ id: b.id, name: b.name }))
  const listParams: Record<string, string> = {}
  if (search) listParams.search = search
  if (branchFilter) listParams.branchId = branchFilter
  const { data, loading, refetch } = useUsers(Object.keys(listParams).length ? listParams : undefined)
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
      {showAdd      && <StaffFormModal branches={branches} onClose={() => setShowAdd(false)} onSaved={refetch} />}
      {editStaff    && <StaffFormModal staff={editStaff} branches={branches} onClose={() => setEditStaff(null)} onSaved={refetch} />}
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
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
            {t === 'permissions' ? 'Permission Matrix' : 'Staff List'}
          </button>
        ))}
      </div>

      {tab === 'staff' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input-field pl-9" placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {branches.length > 1 && (
              <FilterDropdown
                value={branchFilter}
                onChange={setBranchFilter}
                options={[{ value: '', label: 'All Branches' }, ...branches.map(b => ({ value: b.id, label: b.name }))]}
                icon={Building2}
                placeholder="All Branches"
                active={!!branchFilter}
                onClear={() => setBranchFilter('')}
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
                      <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${role.color} ${role.bg} ${role.border}`}>{role.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full mr-1 ${s.isActive ? 'bg-green-400' : 'bg-slate-500'}`} />
                      <button onClick={() => setEditStaff(s)} className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors" title="Edit"><Edit2 size={13} /></button>
                      <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remove"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
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
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock size={11} className="flex-shrink-0" />
                      <span>Joined {new Date(s.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4 pt-4 border-t border-white/5">
                    <div className="flex-1 text-center">
                      <p className="text-[10px] font-medium text-slate-300 capitalize">{s.role?.toLowerCase().replace('_', ' ')}</p>
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

      {tab === 'permissions' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Role Permission Matrix</h3>
            <p className="text-xs text-slate-500 mt-0.5">Access control per role</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="table-header">Feature</th>
                  <th className="table-header text-center">Owner</th>
                  <th className="table-header text-center">Manager</th>
                  <th className="table-header text-center">Technician</th>
                  <th className="table-header text-center">Sales Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {permissionMatrix.map(p => (
                  <tr key={p.feature} className="hover:bg-white/2">
                    <td className="table-cell text-sm font-medium text-slate-300">{p.feature}</td>
                    {[p.owner, p.manager, p.technician, p.sales].map((has, i) => (
                      <td key={i} className="table-cell text-center">
                        {has
                          ? <CheckCircle size={16} className="text-green-400 mx-auto" />
                          : <XCircle size={16} className="text-slate-700 mx-auto" />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
