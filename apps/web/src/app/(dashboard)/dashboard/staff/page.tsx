'use client'

import { useState } from 'react'
import { UserCheck, Plus, Search, CheckCircle, XCircle, X, Loader2, Mail, Phone, Clock, MoreVertical } from 'lucide-react'
import { useUsers } from '@/lib/hooks'
import { usersApi } from '@/lib/api'
import toast from 'react-hot-toast'

const roleConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  OWNER: { label: 'Owner', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  MANAGER: { label: 'Manager', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  TECHNICIAN: { label: 'Technician', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  SALES_STAFF: { label: 'Sales Staff', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  ACCOUNTANT: { label: 'Accountant', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
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

function AddStaffModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'CASHIER', password: '' })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await usersApi.create(form)
      toast.success('Staff member added')
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to add staff')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-base font-semibold text-white">Add Staff Member</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Full Name *</label>
              <input required className="input-field" placeholder="Arjun Kumar" value={form.name} onChange={f('name')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Email *</label>
              <input required type="email" className="input-field" placeholder="staff@shop.com" value={form.email} onChange={f('email')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Phone *</label>
              <input required className="input-field" placeholder="9876543210" value={form.phone} onChange={f('phone')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Role</label>
              <select className="input-field" value={form.role} onChange={f('role')}>
                <option value="MANAGER">Manager</option>
                <option value="TECHNICIAN">Technician</option>
                <option value="SALES_STAFF">Sales Staff</option>
                <option value="ACCOUNTANT">Accountant</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Temporary Password *</label>
              <input required type="password" className="input-field" placeholder="Min 8 characters" value={form.password} onChange={f('password')} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Add Member
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function StaffPage() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'staff' | 'permissions'>('staff')
  const [showAdd, setShowAdd] = useState(false)

  const { data, loading, refetch } = useUsers(search ? { search } : undefined)
  const users: any[] = (data?.data ?? []) as any[]
  const activeCount = users.filter((u: any) => u.isActive).length

  return (
    <div className="space-y-6">
      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} onSaved={refetch} />}

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
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input-field pl-9" placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} />
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
                      <div className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-green-400' : 'bg-slate-500'}`} />
                      <button className="p-1 text-slate-600 hover:text-slate-400 rounded"><MoreVertical size={14} /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Mail size={11} className="flex-shrink-0" /><span className="truncate">{s.email}</span>
                    </div>
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
