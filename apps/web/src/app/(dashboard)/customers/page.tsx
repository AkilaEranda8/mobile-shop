'use client'

import { useState } from 'react'
import { Search, Plus, Users, Star, Phone, Mail, MapPin, Eye, Loader2, SlidersHorizontal, X } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useCustomers } from '@/lib/hooks'
import { customersApi } from '@/lib/api'
import type { Customer } from '@/types'

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

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'table'>('table')
  const [showAddModal, setShowAddModal] = useState(false)
  const { data: customersData, loading, refetch } = useCustomers()
  const customers: Customer[] = (customersData?.data ?? []) as Customer[]

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  const totalDue = customers.reduce((s, c) => s + c.totalDue, 0)
  const totalPurchases = customers.reduce((s, c) => s + c.totalPurchases, 0)

  return (
    <div className="space-y-6">
      {showAddModal && <AddCustomerModal onClose={() => setShowAddModal(false)} onSaved={refetch} />}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} registered customers</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button className="btn-secondary text-sm flex items-center gap-2">
            <SlidersHorizontal size={14} />Segment
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />Add Customer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Customers', value: customers.length.toString(), color: 'text-violet-400' },
          { label: 'Total Outstanding', value: formatCurrency(totalDue), color: 'text-red-400' },
          { label: 'Total Purchases', value: totalPurchases.toString(), color: 'text-blue-400' },
          { label: 'VIP (High Points)', value: customers.filter((c: Customer) => c.loyaltyPoints > 500).length.toString(), color: 'text-yellow-400' },
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
                <th className="table-header text-right">Total Spent</th>
                <th className="table-header text-center">Points</th>
                <th className="table-header text-center">Repairs</th>
                <th className="table-header">Last Visit</th>
                <th className="table-header text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/3">
              {filtered.map((customer) => (
                <tr key={customer.id} className="hover:bg-white/2 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300 flex-shrink-0">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{customer.name}</p>
                        {customer.loyaltyPoints > 500 && (
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
                      <MapPin size={10} />{customer.city}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <span className="text-sm font-semibold text-green-400">{customer.totalPurchases} sales</span>
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
                  <td className="table-cell text-center">
                    <button className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors">
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
