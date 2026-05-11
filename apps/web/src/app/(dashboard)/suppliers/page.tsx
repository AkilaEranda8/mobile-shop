'use client'

import { useState } from 'react'
import { Search, Plus, Truck, Phone, Mail, Package, Eye, Edit, Loader2, X, ChevronDown, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useSuppliers, usePurchaseOrders } from '@/lib/hooks'
import { suppliersApi } from '@/lib/api'
import toast from 'react-hot-toast'
import type { Supplier, PurchaseOrder } from '@/types'

const poStatusColors: Record<string, string> = {
  DRAFT:    'bg-slate-500/10 border-slate-500/20 text-slate-400',
  SENT:     'bg-blue-500/10 border-blue-500/20 text-blue-400',
  PARTIAL:  'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  RECEIVED: 'bg-green-500/10 border-green-500/20 text-green-400',
  CLOSED:   'bg-violet-500/10 border-violet-500/20 text-violet-400',
}

/* ── Add Supplier Modal ──────────────────────────────────────────────── */
function AddSupplierModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', city: '', address: '', gstin: '' })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      await suppliersApi.create(form)
      toast.success('Supplier added')
      onSaved(); onClose()
    } catch (err: any) { toast.error(err?.message ?? 'Failed to add supplier') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-base font-semibold text-white">Add Supplier</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Company Name *</label>
              <input required className="input-field" placeholder="Apple India Pvt Ltd" value={form.name} onChange={f('name')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Contact Person</label>
              <input className="input-field" placeholder="Rajesh Kumar" value={form.contactName} onChange={f('contactName')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Phone *</label>
              <input required className="input-field" placeholder="9876543210" value={form.phone} onChange={f('phone')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Email</label>
              <input type="email" className="input-field" placeholder="supplier@email.com" value={form.email} onChange={f('email')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">City</label>
              <input className="input-field" placeholder="Chennai" value={form.city} onChange={f('city')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Address</label>
              <input className="input-field" placeholder="Street address" value={form.address} onChange={f('address')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">GSTIN</label>
              <input className="input-field" placeholder="22AAAAA0000A1Z5" value={form.gstin} onChange={f('gstin')} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Add Supplier
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── New PO Modal ────────────────────────────────────────────────────── */
function NewPOModal({ suppliers, onClose, onSaved }: { suppliers: Supplier[]; onClose: () => void; onSaved: () => void }) {
  const [supplierId, setSupplierId]   = useState(suppliers[0]?.id ?? '')
  const [expectedDelivery, setExpDel] = useState('')
  const [notes, setNotes]             = useState('')
  const [items, setItems]             = useState([{ productName: '', quantity: 1, unitCost: 0 }])
  const [loading, setLoading]         = useState(false)

  const updateItem = (i: number, k: string, v: string | number) =>
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  const addItem    = () => setItems(p => [...p, { productName: '', quantity: 1, unitCost: 0 }])
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i))

  const subtotal = items.reduce((s, r) => s + r.quantity * r.unitCost, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      const selectedSupplier = suppliers.find(s => s.id === supplierId)
      await suppliersApi.createPO({
        supplierId,
        supplierName: selectedSupplier?.name ?? '',
        items: items.map(r => ({
          productName: r.productName,
          quantity: Number(r.quantity),
          unitCost: Number(r.unitCost),
          total: Number(r.quantity) * Number(r.unitCost),
          receivedQuantity: 0,
        })),
        subtotal,
        tax: 0,
        total: subtotal,
        paidAmount: 0,
        dueAmount: subtotal,
        expectedDelivery: expectedDelivery || undefined,
        notes,
        status: 'DRAFT',
      })
      toast.success('Purchase Order created')
      onSaved(); onClose()
    } catch (err: any) { toast.error(err?.message ?? 'Failed to create PO') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <h3 className="text-base font-semibold text-white">New Purchase Order</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Supplier + delivery */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Supplier *</label>
              {suppliers.length === 0
                ? <p className="text-xs text-red-400">No suppliers yet — add one first</p>
                : <select className="input-field" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
              }
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Expected Delivery</label>
              <input type="date" className="input-field" value={expectedDelivery} onChange={e => setExpDel(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Notes</label>
              <input className="input-field" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Items *</label>
              <button type="button" onClick={addItem} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                <Plus size={11} />Add Row
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    required
                    className="input-field col-span-5 text-sm"
                    placeholder="Product name"
                    value={item.productName}
                    onChange={e => updateItem(i, 'productName', e.target.value)}
                  />
                  <input
                    required type="number" min="1"
                    className="input-field col-span-2 text-sm text-center"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={e => updateItem(i, 'quantity', e.target.value)}
                  />
                  <input
                    required type="number" min="0"
                    className="input-field col-span-3 text-sm"
                    placeholder="Unit cost"
                    value={item.unitCost}
                    onChange={e => updateItem(i, 'unitCost', e.target.value)}
                  />
                  <span className="col-span-1 text-xs text-slate-500 text-right">
                    {formatCurrency(item.quantity * item.unitCost)}
                  </span>
                  <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                    className="col-span-1 p-1 text-slate-600 hover:text-red-400 disabled:opacity-30 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3 pt-3 border-t border-white/5">
              <span className="text-sm font-bold text-white">Total: {formatCurrency(subtotal)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading || suppliers.length === 0} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}Create PO
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SuppliersPage() {
  const [search, setSearch]       = useState('')
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers')
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [showNewPO, setShowNewPO]             = useState(false)
  const { data: suppliersData, loading: suppliersLoading, refetch: refetchSuppliers } = useSuppliers()
  const { data: ordersData,    loading: ordersLoading,    refetch: refetchOrders    } = usePurchaseOrders()
  const suppliers:      Supplier[]      = (suppliersData?.data ?? []) as Supplier[]
  const purchaseOrders: PurchaseOrder[] = (ordersData?.data    ?? []) as PurchaseOrder[]

  const filteredSuppliers = suppliers.filter((s: Supplier) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contactName?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredOrders = purchaseOrders.filter((po: PurchaseOrder) =>
    po.supplierName.toLowerCase().includes(search.toLowerCase()) ||
    po.poNumber.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {showAddSupplier && <AddSupplierModal onClose={() => setShowAddSupplier(false)} onSaved={refetchSuppliers} />}
      {showNewPO       && <NewPOModal suppliers={suppliers} onClose={() => setShowNewPO(false)} onSaved={() => { refetchOrders(); refetchSuppliers() }} />}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Suppliers & Purchase Orders</h1>
          <p className="page-subtitle">{suppliers.length} suppliers · {purchaseOrders.length} purchase orders</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button onClick={() => setShowAddSupplier(true)} className="btn-secondary text-sm flex items-center gap-2">
            <Plus size={14} />Add Supplier
          </button>
          <button onClick={() => setShowNewPO(true)} className="btn-primary text-sm flex items-center gap-2">
            <Package size={14} />New PO
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/3 p-1 rounded-xl w-fit">
        {[['suppliers', 'Suppliers'], ['orders', 'Purchase Orders']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as 'suppliers' | 'orders')}
            className={`px-4 py-1.5 text-xs rounded-lg transition-colors ${activeTab === key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder={activeTab === 'suppliers' ? 'Search suppliers...' : 'Search POs...'}
          className="input-field pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {activeTab === 'suppliers' ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(suppliersLoading || ordersLoading) && <div className="text-center py-8 text-slate-500 text-sm">Loading...</div>}
          {filteredSuppliers.map((supplier: Supplier) => (
            <div key={supplier.id} className="card p-5 hover:border-violet-500/20 transition-all">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300 flex-shrink-0">
                  {supplier.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-100 truncate">{supplier.name}</p>
                  {supplier.contactName && (
                    <p className="text-xs text-slate-500">{supplier.contactName}</p>
                  )}
                </div>
                <button className="text-slate-500 hover:text-violet-400 p-1">
                  <Edit size={13} />
                </button>
              </div>

              <div className="space-y-1.5">
                <a href={`tel:${supplier.phone}`} className="flex items-center gap-2 text-xs text-slate-400 hover:text-violet-300 transition-colors">
                  <Phone size={11} />{supplier.phone}
                </a>
                {supplier.email && (
                  <a href={`mailto:${supplier.email}`} className="flex items-center gap-2 text-xs text-slate-400 hover:text-violet-300 transition-colors">
                    <Mail size={11} />{supplier.email}
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                <div>
                  <p className="text-xs text-slate-500">City</p>
                  <p className="text-sm font-medium text-slate-300">{supplier.city}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Outstanding</p>
                  <p className={`text-sm font-bold ${supplier.outstandingDues > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {formatCurrency(supplier.outstandingDues)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="table-header">PO Number</th>
                  <th className="table-header">Supplier</th>
                  <th className="table-header">Items</th>
                  <th className="table-header text-right">Total</th>
                  <th className="table-header">Order Date</th>
                  <th className="table-header">Expected</th>
                  <th className="table-header text-center">Status</th>
                  <th className="table-header text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {filteredOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-white/2 transition-colors">
                    <td className="table-cell">
                      <span className="text-xs font-mono text-violet-300">{po.poNumber}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Truck size={13} className="text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-200">{po.supplierName}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs text-slate-400">{po.items.length} items</span>
                    </td>
                    <td className="table-cell text-right">
                      <span className="text-sm font-semibold text-white">{formatCurrency(po.total)}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs text-slate-400">{formatDate(po.createdAt)}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs text-slate-400">{po.expectedDelivery ? formatDate(po.expectedDelivery) : '—'}</span>
                    </td>
                    <td className="table-cell text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${poStatusColors[po.status] || ''}`}>
                        {po.status}
                      </span>
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
      )}
    </div>
  )
}
