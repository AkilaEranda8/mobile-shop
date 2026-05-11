'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Plus, Star, Phone, Mail, MapPin, Eye, Loader2, SlidersHorizontal, X, ShoppingBag, Wrench, CreditCard, Calendar, ChevronRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useCustomers } from '@/lib/hooks'
import { customersApi } from '@/lib/api'
import type { Customer } from '@/types'

/* ── Customer Detail Modal ───────────────────────────────────────────── */
function CustomerDetailModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    customersApi.getById(customerId)
      .then((r: any) => setCustomer(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customerId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <h3 className="text-base font-semibold text-white">Customer Profile</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-violet-400" />
          </div>
        )}

        {!loading && customer && (
          <div className="p-5 space-y-5">
            {/* Avatar + Name */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 border border-violet-500/20 flex items-center justify-center text-2xl font-bold text-violet-300 flex-shrink-0">
                {customer.name?.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-white">{customer.name}</p>
                  {customer.loyaltyPoints > 500 && (
                    <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">
                      <Star size={8} className="fill-yellow-400" />VIP
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Customer since {formatDate(customer.createdAt)}</p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/3 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <Phone size={12} className="text-slate-500" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">Phone</span>
                </div>
                <p className="text-sm text-slate-200">{customer.phone}</p>
              </div>
              <div className="bg-white/3 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <Mail size={12} className="text-slate-500" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">Email</span>
                </div>
                <p className="text-sm text-slate-200 truncate">{customer.email || '—'}</p>
              </div>
              <div className="bg-white/3 rounded-xl p-3 border border-white/5 col-span-2">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin size={12} className="text-slate-500" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">Location</span>
                </div>
                <p className="text-sm text-slate-200">{[customer.address, customer.city].filter(Boolean).join(', ') || '—'}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: ShoppingBag,  label: 'Purchases',  value: customer.totalPurchases,               color: 'text-green-400'  },
                { icon: Wrench,       label: 'Repairs',    value: customer.totalRepairs,                  color: 'text-cyan-400'   },
                { icon: Star,         label: 'Points',     value: `${customer.loyaltyPoints} pts`,        color: 'text-yellow-400' },
                { icon: CreditCard,   label: 'Outstanding', value: formatCurrency(customer.totalDue),    color: 'text-red-400'    },
              ].map(s => (
                <div key={s.label} className="bg-white/3 rounded-xl p-3 border border-white/5 text-center">
                  <s.icon size={14} className={`${s.color} mx-auto mb-1`} />
                  <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Notes */}
            {customer.notes && (
              <div className="bg-white/3 rounded-xl p-3 border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-xs text-slate-300">{customer.notes}</p>
              </div>
            )}
          </div>
        )}

        {!loading && !customer && (
          <div className="py-12 text-center text-slate-500 text-sm">Failed to load customer</div>
        )}
      </div>
    </div>
  )
}

/* ── Segment Dropdown ────────────────────────────────────────────────── */
const SEGMENTS = [
  { key: 'all',         label: 'All Customers',     filter: (_: Customer) => true },
  { key: 'vip',         label: 'VIP (500+ pts)',     filter: (c: Customer) => c.loyaltyPoints >= 500 },
  { key: 'active',      label: 'Active Buyers',      filter: (c: Customer) => c.totalPurchases >= 3 },
  { key: 'repair_only', label: 'Repair Customers',   filter: (c: Customer) => c.totalRepairs > 0 && c.totalPurchases === 0 },
  { key: 'outstanding', label: 'Has Outstanding',    filter: (c: Customer) => c.totalDue > 0 },
  { key: 'new',         label: 'New (≤30 days)',      filter: (c: Customer) => {
    const d = new Date(c.createdAt)
    return (Date.now() - d.getTime()) / 86400000 <= 30
  }},
]

/* ── Add Customer Modal ──────────────────────────────────────────────── */
function AddCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await customersApi.create(form)
      onSaved(); onClose()
    } catch (err: any) { setError(err.message || 'Failed to create customer') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-base font-semibold text-white">Add Customer</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Full Name *</label>
              <input required className="input-field" placeholder="Subramaniam R" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Phone *</label>
              <input required className="input-field" placeholder="9876543210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Email</label>
              <input type="email" className="input-field" placeholder="optional" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">City</label>
              <input className="input-field" placeholder="Chennai" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Address</label>
              <input className="input-field" placeholder="Street address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}Add Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────── */
export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [segment, setSegment] = useState('all')
  const [showSegment, setShowSegment] = useState(false)
  const segmentRef = useRef<HTMLDivElement>(null)

  const { data: customersData, loading, refetch } = useCustomers()
  const customers: Customer[] = (customersData?.data ?? []) as Customer[]

  const activeSeg = SEGMENTS.find(s => s.key === segment) ?? SEGMENTS[0]

  const filtered = customers
    .filter(activeSeg.filter)
    .filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase())
    )

  const totalDue       = customers.reduce((s, c) => s + c.totalDue, 0)
  const totalPurchases = customers.reduce((s, c) => s + c.totalPurchases, 0)

  /* close segment dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (segmentRef.current && !segmentRef.current.contains(e.target as Node)) {
        setShowSegment(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="space-y-6">
      {showAddModal && <AddCustomerModal onClose={() => setShowAddModal(false)} onSaved={refetch} />}
      {detailId     && <CustomerDetailModal customerId={detailId} onClose={() => setDetailId(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} registered · showing {filtered.length} in <span className="text-violet-400">{activeSeg.label}</span></p>
        </div>
        <div className="flex gap-2 sm:ml-auto items-center relative" ref={segmentRef}>
          <button
            onClick={() => setShowSegment(v => !v)}
            className={`btn-secondary text-sm flex items-center gap-2 ${showSegment ? 'border-violet-500/40 text-violet-300' : ''}`}
          >
            <SlidersHorizontal size={14} />Segment
            {segment !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
          </button>

          {showSegment && (
            <div className="absolute top-full right-0 mt-2 w-52 bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 pt-3 pb-1.5">Filter by segment</p>
              {SEGMENTS.map(s => (
                <button
                  key={s.key}
                  onClick={() => { setSegment(s.key); setShowSegment(false) }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${segment === s.key ? 'text-violet-300' : 'text-slate-400'}`}
                >
                  <span>{s.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">{customers.filter(s.filter).length}</span>
                    {segment === s.key && <ChevronRight size={12} className="text-violet-400" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />Add Customer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Customers',  value: customers.length.toString(),                                          color: 'text-violet-400' },
          { label: 'Total Outstanding', value: formatCurrency(totalDue),                                            color: 'text-red-400'    },
          { label: 'Total Purchases',  value: totalPurchases.toString(),                                            color: 'text-blue-400'   },
          { label: 'VIP Members',      value: customers.filter(c => c.loyaltyPoints >= 500).length.toString(),      color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search by name, phone, email..."
          className="input-field pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="table-header">Customer</th>
                <th className="table-header">Contact</th>
                <th className="table-header">City</th>
                <th className="table-header text-right">Purchases</th>
                <th className="table-header text-center">Points</th>
                <th className="table-header text-center">Repairs</th>
                <th className="table-header">Joined</th>
                <th className="table-header text-center">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/3">
              {loading && (
                <tr><td colSpan={8} className="py-12 text-center text-slate-500 text-sm">Loading customers...</td></tr>
              )}
              {!loading && filtered.map((customer) => (
                <tr key={customer.id} className="hover:bg-white/2 transition-colors cursor-pointer" onClick={() => setDetailId(customer.id)}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300 flex-shrink-0">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{customer.name}</p>
                        {customer.loyaltyPoints >= 500 && (
                          <span className="flex items-center gap-1 text-[10px] text-yellow-400">
                            <Star size={9} className="fill-yellow-400" />VIP
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Phone size={10} />{customer.phone}
                      </span>
                      {customer.email && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Mail size={10} />{customer.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <MapPin size={10} />{customer.city || '—'}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <span className="text-sm font-semibold text-green-400">{customer.totalPurchases}</span>
                  </td>
                  <td className="table-cell text-center">
                    <span className="text-xs text-violet-400 font-medium">{customer.loyaltyPoints} pts</span>
                  </td>
                  <td className="table-cell text-center">
                    <span className="text-xs text-slate-400">{customer.totalRepairs}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs text-slate-500">{formatDate(customer.createdAt)}</span>
                  </td>
                  <td className="table-cell text-center" onClick={e => { e.stopPropagation(); setDetailId(customer.id) }}>
                    <button className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors">
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-slate-500 text-sm">No customers in this segment</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
