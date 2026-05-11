'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Filter, MoreHorizontal, Eye, Edit, Ban, RefreshCw, Trash2, KeyRound, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { fetchTenants, updateTenantStatus, deleteTenant, type TenantRow } from '@/lib/api'

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'badge-green',
  TRIAL:     'badge-blue',
  SUSPENDED: 'badge-yellow',
  CANCELLED: 'badge-gray',
}
const PLAN_BADGE: Record<string, string> = {
  STARTER:    'badge-gray',
  PRO:        'badge-blue',
  ENTERPRISE: 'badge-purple',
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: '2-digit' })
}
function fmtMRR(n: number) {
  return n === 0 ? '—' : `Rs.${n.toLocaleString()}`
}

type SortKey = 'name' | 'mrr' | 'createdAt'

export default function TenantsPage() {
  const [allTenants, setAllTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [planFilter, setPlanFilter] = useState('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<TenantRow | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [showOnboard, setShowOnboard] = useState(false)
  const PER_PAGE = 8

  useEffect(() => {
    setLoading(true)
    fetchTenants({ limit: '100' })
      .then(d => setAllTenants(d.data))
      .catch(e => setError(e.message || 'Failed to load tenants'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = allTenants
    .filter(t => {
      const q = search.toLowerCase()
      const matchQ = t.name.toLowerCase().includes(q) || t.ownerEmail.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter
      const matchPlan = planFilter === 'ALL' || t.plan === planFilter
      return matchQ && matchStatus && matchPlan
    })
    .sort((a, b) => {
      const av = sortKey === 'mrr' ? (a.mrr ?? 0) : sortKey === 'createdAt' ? a.createdAt : a.name
      const bv = sortKey === 'mrr' ? (b.mrr ?? 0) : sortKey === 'createdAt' ? b.createdAt : b.name
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(true) }
  }

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    return (
      <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-gray-700 transition-colors">
        {label}
        {sortKey === k && <span className="text-[10px]">{sortAsc ? '↑' : '↓'}</span>}
      </button>
    )
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="page-title">Tenants</h1>
          <p className="text-sm text-gray-500">{filtered.length} tenants found</p>
        </div>
        <button onClick={() => setShowOnboard(true)} className="btn-primary">
          <Plus size={15} />Onboard New Tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-gray-400" />
          <input
            className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1"
            placeholder="Search shop, email, realm..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select className="input w-auto pr-8 text-sm" value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="TRIAL">Trial</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select className="input w-auto pr-8 text-sm" value={planFilter}
          onChange={e => { setPlanFilter(e.target.value); setPage(1) }}>
          <option value="ALL">All Plans</option>
          <option value="STARTER">Starter</option>
          <option value="PRO">Pro</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="th"><SortBtn k="name" label="Shop" /></th>
                <th className="th">Owner</th>
                <th className="th">Plan</th>
                <th className="th">Status</th>
                <th className="th"><SortBtn k="mrr" label="MRR" /></th>
                <th className="th">Users</th>
                <th className="th"><SortBtn k="createdAt" label="Joined" /></th>
                <th className="th text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paged.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="td">
                    <p className="font-medium text-gray-900 text-xs">{t.name}</p>
                    <p className="text-[10px] text-gray-400">{t.ownerEmail}</p>
                  </td>
                  <td className="td">
                    <p className="text-xs text-gray-700">{t.ownerName}</p>
                    <p className="text-[10px] text-gray-400">{t.ownerEmail}</p>
                  </td>
                  <td className="td"><span className={PLAN_BADGE[t.plan]}>{t.plan}</span></td>
                  <td className="td"><span className={STATUS_BADGE[t.status]}>{t.status}</span></td>
                  <td className="td font-semibold text-xs text-gray-800">{fmtMRR(t.mrr ?? 0)}</td>
                  <td className="td text-xs text-gray-600">{t._count?.users ?? '—'}</td>
                  <td className="td text-xs text-gray-500">{fmtDate(t.createdAt)}</td>
                  <td className="td text-center">
                    <div className="relative flex items-center justify-center gap-1">
                      <Link href={`/tenants/${t.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Eye size={14} />
                      </Link>
                      <button
                        onClick={() => setMenuOpen(menuOpen === t.id ? null : t.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {menuOpen === t.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20">
                          <Link href={`/tenants/${t.id}`} onClick={() => setMenuOpen(null)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            <Eye size={13} />View Details
                          </Link>
                          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            <Edit size={13} />Edit Plan
                          </button>
                          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            <KeyRound size={13} />Open Keycloak Realm
                          </button>
                          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            <RefreshCw size={13} />Force Backup
                          </button>
                          {t.status === 'ACTIVE' || t.status === 'TRIAL' ? (
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50">
                              <Ban size={13} />Suspend
                            </button>
                          ) : (
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50">
                              <RefreshCw size={13} />Reactivate
                            </button>
                          )}
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            <button onClick={() => { setConfirmDelete(t); setMenuOpen(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                              <Trash2 size={13} />Delete Tenant
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={10} className="td text-center py-10 text-gray-400 text-sm">No tenants match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded-lg hover:bg-gray-100">
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-7 h-7 text-xs rounded-lg ${n === page ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded-lg hover:bg-gray-100">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete Tenant</h3>
                <p className="text-xs text-gray-500">This action is irreversible</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete <strong>{confirmDelete.name}</strong>, all their data, PostgreSQL schema, and Keycloak realm.
            </p>
            <p className="text-sm text-gray-700 mb-2">
              Type <strong className="font-mono text-red-600">{confirmDelete.name}</strong> to confirm:
            </p>
            <input
              className="input mb-4"
              placeholder={confirmDelete.name}
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirmDelete(null); setDeleteInput('') }} className="btn-secondary">Cancel</button>
              <button
                disabled={deleteInput !== confirmDelete.name}
                className="btn-danger disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => { setConfirmDelete(null); setDeleteInput('') }}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboard modal */}
      {showOnboard && <OnboardModal onClose={() => setShowOnboard(false)} />}
    </div>
  )
}

function OnboardModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ shopName: '', ownerName: '', email: '', phone: '', plan: 'STARTER', country: 'LK' })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
        {/* Steps */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${n <= step ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>{n}</div>
              {n < 4 && <div className={`flex-1 h-0.5 w-8 ${n < step ? 'bg-gray-900' : 'bg-gray-200'}`} />}
            </div>
          ))}
          <p className="ml-2 text-sm text-gray-500">
            {['Shop Details', 'Plan', 'Provisioning', 'Done'][step - 1]}
          </p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Shop Details</h3>
            {[
              { label: 'Shop Name', key: 'shopName', placeholder: 'e.g. iRepair Hub' },
              { label: 'Owner Name', key: 'ownerName', placeholder: 'e.g. Kamal Perera' },
              { label: 'Email', key: 'email', placeholder: 'owner@shop.com' },
              { label: 'Phone', key: 'phone', placeholder: '+94771234567' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                <input className="input" placeholder={f.placeholder}
                  value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Select Plan</h3>
            {[
              { id: 'STARTER', label: 'Starter', price: 'Rs.1,199/mo', desc: '3 users, 1 branch, basic POS + repairs' },
              { id: 'PRO', label: 'Pro', price: 'Rs.4,799/mo', desc: '10 users, 3 branches, analytics, warranties' },
              { id: 'ENTERPRISE', label: 'Enterprise', price: 'Rs.14,399/mo', desc: 'Unlimited users, API access, white-label' },
            ].map(p => (
              <label key={p.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.plan === p.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="plan" value={p.id} checked={form.plan === p.id} onChange={() => setForm({ ...form, plan: p.id })} className="accent-gray-900" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{p.label}</p>
                    <p className="text-sm font-bold text-gray-800">{p.price}</p>
                  </div>
                  <p className="text-xs text-gray-500">{p.desc}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Auto-Provisioning</h3>
            <p className="text-sm text-gray-500">The following will be created automatically:</p>
            {[
              { label: 'PostgreSQL schema', detail: `schema: ${form.shopName.toLowerCase().replace(/\s/g, '_') || 'tenant_xxx'}`, done: true },
              { label: 'Keycloak realm', detail: `realm: ${form.shopName.toLowerCase().replace(/\s/g, '-') || 'tenant-xxx'}`, done: true },
              { label: 'Default roles & permissions', detail: 'Owner, Manager, Cashier, Technician', done: true },
              { label: 'Welcome email', detail: `to ${form.email || 'owner@shop.com'}`, done: false },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className="text-white text-[10px] font-bold">✓</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-800">{item.label}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✅</span>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Tenant Onboarded!</h3>
            <p className="text-sm text-gray-500 mb-4">{form.shopName} is now active on {form.plan} plan.</p>
            <div className="bg-gray-50 rounded-lg p-3 text-left">
              <p className="text-xs text-gray-500 mb-1">Keycloak Realm URL:</p>
              <p className="text-xs font-mono text-blue-600">
                https://auth.hexalyte.com/realms/{form.shopName.toLowerCase().replace(/\s/g, '-') || 'tenant'}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button onClick={onClose} className="btn-secondary">
            {step === 4 ? 'Close' : 'Cancel'}
          </button>
          {step < 4 && (
            <button onClick={() => setStep(s => s + 1)} className="btn-primary">
              {step === 3 ? 'Provision Tenant' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
