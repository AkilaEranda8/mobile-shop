'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Edit, MapPin, Phone, Mail, Star, X, Loader2, Save, CheckCircle, AlertTriangle } from 'lucide-react'
import { branchesApi, tenantApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import toast from 'react-hot-toast'

/* ── Plan limits ─────────────────────────────────────────────────── */
const PLAN_BRANCH_LIMIT: Record<string, number> = {
  STARTER: 1,
  PRO: 3,
  ENTERPRISE: Infinity,
  TRIAL: 1,
}
const PLAN_COLOR: Record<string, string> = {
  STARTER: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  PRO: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  ENTERPRISE: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  TRIAL: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
}

interface Branch {
  id: string
  name: string
  address: string
  city: string
  state: string
  phone: string
  email?: string
  isHeadquarters: boolean
  isActive: boolean
  createdAt: string
}

const emptyForm = { name: '', address: '', city: '', state: '', phone: '', email: '', isHeadquarters: false }

/* ── Add / Edit Modal ────────────────────────────────────────────── */
function BranchModal({
  branch, onClose, onSaved,
}: { branch?: Branch; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!branch
  const [form, setForm] = useState(
    isEdit
      ? { name: branch.name, address: branch.address, city: branch.city, state: branch.state, phone: branch.phone, email: branch.email ?? '', isHeadquarters: branch.isHeadquarters }
      : { ...emptyForm }
  )
  const [loading, setLoading] = useState(false)

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const body = { ...form, email: form.email || undefined }
      if (isEdit) {
        await branchesApi.update(branch.id, body)
        toast.success('Branch updated')
      } else {
        await branchesApi.create(body)
        toast.success('Branch created')
      }
      onSaved(); onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit Branch' : 'New Branch'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Branch Name *</label>
              <input required className="input-field" placeholder="e.g. Colombo Main Branch"
                value={form.name} onChange={f('name')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Address *</label>
              <input required className="input-field" placeholder="Street address"
                value={form.address} onChange={f('address')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">City *</label>
              <input required className="input-field" placeholder="e.g. Colombo"
                value={form.city} onChange={f('city')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Province / State *</label>
              <input required className="input-field" placeholder="e.g. Western"
                value={form.state} onChange={f('state')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Phone *</label>
              <input required className="input-field" placeholder="+94 77 123 4567"
                value={form.phone} onChange={f('phone')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Email</label>
              <input type="email" className="input-field" placeholder="branch@shop.lk"
                value={form.email} onChange={f('email')} />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(p => ({ ...p, isHeadquarters: !p.isHeadquarters }))}
                  className={`w-10 h-5 rounded-full transition-all relative cursor-pointer ${form.isHeadquarters ? 'bg-violet-500' : 'bg-white/10'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.isHeadquarters ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Mark as Headquarters</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isEdit ? 'Save Changes' : 'Create Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function BranchesPage() {
  const user = authStorage.getUser()
  const [branches, setBranches] = useState<Branch[]>([])
  const [plan, setPlan]         = useState('STARTER')
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [editBranch, setEditBranch] = useState<Branch | null>(null)

  const limit    = PLAN_BRANCH_LIMIT[plan] ?? 1
  const atLimit  = branches.filter(b => b.isActive).length >= limit

  const fetchData = async () => {
    setLoading(true)
    try {
      const [brRes, tenantRes]: any[] = await Promise.all([
        branchesApi.list(),
        user?.tenantId ? tenantApi.get(user.tenantId) : Promise.resolve(null),
      ])
      setBranches((brRes.data ?? brRes) as Branch[])
      const t = tenantRes?.data ?? tenantRes
      if (t?.plan) setPlan(t.plan)
    } catch { toast.error('Failed to load branches') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  return (
    <div className="space-y-6">
      {(showAdd) && <BranchModal onClose={() => setShowAdd(false)} onSaved={fetchData} />}
      {editBranch  && <BranchModal branch={editBranch} onClose={() => setEditBranch(null)} onSaved={fetchData} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Branch Management</h1>
          <p className="page-subtitle">
            {branches.filter(b => b.isActive).length} active branch{branches.filter(b => b.isActive).length !== 1 ? 'es' : ''}
            {limit !== Infinity && ` · ${limit - branches.filter(b => b.isActive).length} slot${limit - branches.filter(b => b.isActive).length !== 1 ? 's' : ''} remaining`}
          </p>
        </div>
        <div className="flex items-center gap-3 sm:ml-auto">
          {/* Plan badge */}
          <span className={`text-[11px] px-3 py-1.5 rounded-lg font-bold border ${PLAN_COLOR[plan] ?? PLAN_COLOR.STARTER}`}>
            {plan} · {limit === Infinity ? 'Unlimited branches' : `${limit} branch${limit !== 1 ? 'es' : ''}`}
          </span>
          <button
            onClick={() => { if (atLimit) { toast.error(`Your ${plan} plan allows only ${limit} branch${limit !== 1 ? 'es' : ''}. Upgrade to add more.`); return; } setShowAdd(true) }}
            className="btn-primary flex items-center gap-2 text-sm"
            title={atLimit ? `Upgrade plan to add more branches` : 'Add new branch'}>
            <Plus size={15} />Add Branch
          </button>
        </div>
      </div>

      {/* Plan limit warning */}
      {atLimit && limit !== Infinity && (
        <div className="flex items-start gap-3 p-4 rounded-xl border"
          style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)' }}>
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Branch limit reached</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Your <strong>{plan}</strong> plan includes {limit} branch{limit !== 1 ? 'es' : ''}. Contact support or upgrade to <strong>{plan === 'STARTER' ? 'PRO' : 'ENTERPRISE'}</strong> to add more.
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-violet-400" />
        </div>
      )}

      {/* Branch cards */}
      {!loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(branch => (
            <div key={branch.id}
              className={`rounded-2xl p-5 space-y-3 transition-all ${!branch.isActive ? 'opacity-50' : ''}`}
              style={{ background: 'var(--bg-card)', border: `1px solid ${branch.isHeadquarters ? 'rgba(124,58,237,0.4)' : 'var(--border-default)'}` }}>

              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${branch.isHeadquarters ? 'bg-violet-500/20' : 'bg-white/5'}`}>
                    <Building2 size={16} className={branch.isHeadquarters ? 'text-violet-400' : 'text-slate-400'} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{branch.name}</p>
                    {branch.isHeadquarters && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-violet-400">
                        <Star size={9} fill="currentColor" />HQ
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${branch.isActive ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-slate-500 bg-white/5 border-white/10'}`}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => setEditBranch(branch)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-violet-500/10"
                    style={{ color: 'var(--text-muted)' }} title="Edit">
                    <Edit size={13} />
                  </button>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <div className="flex items-center gap-2">
                  <MapPin size={11} className="shrink-0" />
                  <span className="truncate">{branch.address}, {branch.city}, {branch.state}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={11} className="shrink-0" />
                  <span>{branch.phone}</span>
                </div>
                {branch.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={11} className="shrink-0" />
                    <span className="truncate">{branch.email}</span>
                  </div>
                )}
              </div>

              {/* Toggle active */}
              <div className="pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  onClick={async () => {
                    if (branch.isHeadquarters && branch.isActive) { toast.error("Cannot deactivate HQ branch"); return }
                    try {
                      await branchesApi.update(branch.id, { isActive: !branch.isActive })
                      toast.success(branch.isActive ? 'Branch deactivated' : 'Branch activated')
                      fetchData()
                    } catch { toast.error('Failed to update') }
                  }}
                  className={`text-xs font-medium transition-colors ${branch.isActive ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}>
                  {branch.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}

          {/* Add placeholder */}
          {!atLimit && (
            <button onClick={() => setShowAdd(true)}
              className="rounded-2xl p-5 flex flex-col items-center justify-center gap-2 transition-all hover:border-violet-500/40 hover:bg-violet-500/5"
              style={{ background: 'var(--bg-subtle)', border: '2px dashed var(--border-default)', minHeight: 160 }}>
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Plus size={18} className="text-violet-400" />
              </div>
              <p className="text-sm font-medium text-slate-400">Add New Branch</p>
              <p className="text-[11px] text-slate-600">{limit - branches.filter(b => b.isActive).length} slot{limit - branches.filter(b => b.isActive).length !== 1 ? 's' : ''} remaining</p>
            </button>
          )}
        </div>
      )}

      {!loading && branches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 size={40} className="text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">No branches yet</p>
          <p className="text-slate-600 text-sm mt-1">Create your first branch to get started</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary mt-4 flex items-center gap-2">
            <Plus size={14} />Add First Branch
          </button>
        </div>
      )}

      {/* Upgrade hint for non-Enterprise */}
      {plan !== 'ENTERPRISE' && (
        <div className="rounded-xl p-4 flex items-center justify-between gap-4"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Need more branches?</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {plan === 'STARTER' ? 'Upgrade to PRO for 3 branches, or ENTERPRISE for unlimited.' : 'Upgrade to ENTERPRISE for unlimited branches.'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <CheckCircle size={13} className="text-violet-400" />
            <span className="text-xs font-semibold text-violet-400">Contact support to upgrade</span>
          </div>
        </div>
      )}
    </div>
  )
}
