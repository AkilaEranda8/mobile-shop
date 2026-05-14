'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Truck, Phone, Mail, Package, Eye, Edit, Loader2, X, ChevronDown, Trash2, FileText, MapPin, Globe, Hash, ShoppingBag, TrendingUp, AlertCircle, Calendar, CheckCircle, Save } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useSuppliers, usePurchaseOrders, useProducts } from '@/lib/hooks'
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

/* ── Supplier Details Modal ─────────────────────────────────────────── */
function SupplierDetailsModal({ supplier, onClose, onEdit }: { supplier: Supplier; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-base font-bold text-violet-300">
              {supplier.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{supplier.name}</h3>
              {supplier.contactName && <p className="text-xs text-slate-500">{supplier.contactName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors">
              <Edit size={11} />Edit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: ShoppingBag,  label: 'Total Orders',    value: supplier.totalOrders,                              cls: 'text-violet-400' },
              { icon: TrendingUp,   label: 'Purchase Value',  value: formatCurrency(supplier.totalPurchaseValue ?? 0),   cls: 'text-emerald-400' },
              { icon: AlertCircle,  label: 'Outstanding',     value: formatCurrency(supplier.outstandingDues ?? 0),      cls: supplier.outstandingDues > 0 ? 'text-red-400' : 'text-green-400' },
            ].map(({ icon: Icon, label, value, cls }) => (
              <div key={label} className="bg-white/3 rounded-xl p-3 text-center border border-white/5">
                <Icon size={14} className={`mx-auto mb-1 ${cls}`} />
                <p className={`text-sm font-bold ${cls}`}>{value}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Contact details */}
          <div className="bg-white/3 rounded-xl p-4 border border-white/5 space-y-2.5">
            {[
              supplier.phone    && { icon: Phone,   label: 'Phone',   value: supplier.phone },
              supplier.email    && { icon: Mail,    label: 'Email',   value: supplier.email },
              supplier.address  && { icon: MapPin,  label: 'Address', value: supplier.address },
              supplier.city     && { icon: Globe,   label: 'City',    value: supplier.city },
              supplier.gstin    && { icon: Hash,    label: 'GSTIN',   value: supplier.gstin },
            ].filter(Boolean).map((row: any) => (
              <div key={row.label} className="flex items-start gap-3">
                <row.icon size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 flex items-start justify-between gap-4">
                  <span className="text-[11px] text-slate-500 w-14 flex-shrink-0">{row.label}</span>
                  <span className="text-xs text-slate-200 text-right">{row.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Status + created */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {supplier.isActive
                ? <span className="flex items-center gap-1 text-emerald-400"><CheckCircle size={11} />Active</span>
                : <span className="flex items-center gap-1 text-red-400"><X size={11} />Inactive</span>}
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Calendar size={11} />
              <span>Joined {formatDate(supplier.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Edit Supplier Modal ─────────────────────────────────────────────── */
function EditSupplierModal({ supplier, onClose, onSaved }: { supplier: Supplier; onClose: () => void; onSaved: () => void }) {
  const [form, setForm]   = useState({
    name:        supplier.name        ?? '',
    contactName: supplier.contactName ?? '',
    phone:       supplier.phone       ?? '',
    email:       supplier.email       ?? '',
    city:        supplier.city        ?? '',
    address:     supplier.address     ?? '',
    gstin:       supplier.gstin       ?? '',
  })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      await suppliersApi.update(supplier.id, form)
      toast.success('Supplier updated')
      onSaved(); onClose()
    } catch (err: any) { toast.error(err?.message ?? 'Update failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <h3 className="text-sm font-bold text-white">Edit Supplier</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'name',        label: 'Supplier Name *', full: true  },
              { k: 'contactName', label: 'Contact Name',    full: false },
              { k: 'phone',       label: 'Phone',           full: false },
              { k: 'email',       label: 'Email',           full: false },
              { k: 'city',        label: 'City',            full: false },
              { k: 'address',     label: 'Address',         full: true  },
              { k: 'gstin',       label: 'GSTIN / VAT No',  full: false },
            ].map(({ k, label, full }) => (
              <div key={k} className={full ? 'col-span-2' : ''}>
                <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
                <input
                  className="input-field"
                  value={(form as any)[k]}
                  onChange={f(k)}
                  required={k === 'name'}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
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
  const [items, setItems]             = useState([{ productId: '', productName: '', quantity: 1, unitCost: 0 }])
  const [loading, setLoading]         = useState(false)
  const [searches, setSearches]       = useState<string[]>([''])
  const [openIdx, setOpenIdx]         = useState<number | null>(null)

  const { data: productsData } = useProducts({ limit: '200' })
  const allProducts: any[] = (productsData?.data ?? []) as any[]

  const getFiltered = (i: number) => {
    const q = (searches[i] ?? '').toLowerCase()
    if (!q) return allProducts.slice(0, 10)
    return allProducts.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.brandName?.toLowerCase().includes(q)
    ).slice(0, 10)
  }

  const selectProduct = (i: number, product: any) => {
    setItems(prev => prev.map((row, idx) =>
      idx === i ? {
        ...row,
        productId:   product.id,
        productName: product.name,
        unitCost:    product.buyingPrice ?? 0,
      } : row
    ))
    setSearches(prev => prev.map((s, idx) => idx === i ? product.name : s))
    setOpenIdx(null)
  }

  const updateItem = (i: number, k: string, v: string | number) =>
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, [k]: v } : row))

  const addItem = () => {
    setItems(p => [...p, { productId: '', productName: '', quantity: 1, unitCost: 0 }])
    setSearches(p => [...p, ''])
  }

  const removeItem = (i: number) => {
    setItems(p => p.filter((_, idx) => idx !== i))
    setSearches(p => p.filter((_, idx) => idx !== i))
  }

  const subtotal = items.reduce((s, r) => s + Number(r.quantity) * Number(r.unitCost), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      const selectedSupplier = suppliers.find(s => s.id === supplierId)
      await suppliersApi.createPO({
        supplierId,
        supplierName: selectedSupplier?.name ?? '',
        items: items.map(r => ({
          productId:        r.productId   || undefined,
          productName:      r.productName,
          quantity:         Number(r.quantity),
          unitCost:         Number(r.unitCost),
          total:            Number(r.quantity) * Number(r.unitCost),
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
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Items *</label>
              <button type="button" onClick={addItem} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                <Plus size={11} />Add Row
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 mb-1 px-0.5">
              <span className="col-span-5 text-[10px] text-slate-600 uppercase tracking-wide">Product</span>
              <span className="col-span-2 text-[10px] text-slate-600 uppercase tracking-wide text-center">Qty</span>
              <span className="col-span-3 text-[10px] text-slate-600 uppercase tracking-wide">Unit Cost</span>
              <span className="col-span-2 text-[10px] text-slate-600 uppercase tracking-wide text-right">Total</span>
            </div>

            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  {/* Product search dropdown */}
                  <div className="col-span-5 relative">
                    <input
                      required
                      className="input-field text-sm w-full"
                      placeholder="Search product..."
                      value={searches[i] ?? ''}
                      onFocus={() => setOpenIdx(i)}
                      onChange={e => {
                        const v = e.target.value
                        setSearches(prev => prev.map((s, idx) => idx === i ? v : s))
                        setItems(prev => prev.map((row, idx) => idx === i ? { ...row, productName: v, productId: '' } : row))
                        setOpenIdx(i)
                      }}
                      onBlur={() => setTimeout(() => setOpenIdx(null), 150)}
                    />
                    {openIdx === i && getFiltered(i).length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1220] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                        {getFiltered(i).map((p: any) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={() => selectProduct(i, p)}
                            className="w-full px-3 py-2 text-left hover:bg-violet-500/10 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs text-slate-200 truncate">{p.name}</p>
                                <p className="text-[10px] text-slate-500">{p.sku} · {p.brandName}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-[10px] text-violet-400">{formatCurrency(p.buyingPrice)}</p>
                                <p className="text-[10px] text-slate-600">stock: {p.stock}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                        {allProducts.length === 0 && (
                          <p className="text-xs text-slate-500 px-3 py-2">No products in inventory</p>
                        )}
                      </div>
                    )}
                  </div>

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
                    placeholder="Cost"
                    value={item.unitCost}
                    onChange={e => updateItem(i, 'unitCost', e.target.value)}
                  />
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <span className="text-xs text-slate-400">
                      {formatCurrency(Number(item.quantity) * Number(item.unitCost))}
                    </span>
                    <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                      className="p-1 text-slate-600 hover:text-red-400 disabled:opacity-30 transition-colors flex-shrink-0">
                      <Trash2 size={11} />
                    </button>
                  </div>
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
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers')
  const [showAddSupplier, setShowAddSupplier]     = useState(false)
  const [showNewPO, setShowNewPO]                 = useState(false)
  const [detailSupplier, setDetailSupplier]       = useState<Supplier | null>(null)
  const [editSupplier,   setEditSupplier]         = useState<Supplier | null>(null)
  const [markReceiving,  setMarkReceiving]        = useState<string | null>(null)
  const { data: suppliersData, loading: suppliersLoading, refetch: refetchSuppliers } = useSuppliers()
  const { data: ordersData,    loading: ordersLoading,    refetch: refetchOrders    } = usePurchaseOrders()
  const suppliers:      Supplier[]      = (suppliersData?.data ?? []) as Supplier[]
  const purchaseOrders: PurchaseOrder[] = (ordersData?.data    ?? []) as PurchaseOrder[]

  const handleMarkReceived = async (po: PurchaseOrder) => {
    const msg = po.status === 'RECEIVED'
      ? `"${po.poNumber}" is already RECEIVED.\nApply stock restock now? (Only runs if not already applied)`
      : `Mark "${po.poNumber}" as RECEIVED?\nThis will restock all items in your inventory.`
    if (!confirm(msg)) return
    setMarkReceiving(po.id)
    try {
      await suppliersApi.updatePO(po.id, { status: 'RECEIVED' })
      toast.success(`${po.poNumber} received — inventory updated`)
      refetchOrders()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update PO')
    } finally {
      setMarkReceiving(null)
    }
  }

  const supplierColumns = useMemo<ColumnDef<Supplier>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300 flex-shrink-0">
            {row.original.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-100 text-sm">{row.original.name}</p>
            {row.original.contactName && <p className="text-xs text-slate-500">{row.original.contactName}</p>}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => (
        <a href={`tel:${row.original.phone}`} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-300">
          <Phone size={11} />{row.original.phone}
        </a>
      ),
    },
    {
      accessorKey: 'city',
      header: ({ column }) => <DataTableColumnHeader column={column} title="City" />,
      cell: ({ row }) => <span className="text-xs text-slate-400">{row.original.city || '—'}</span>,
    },
    {
      accessorKey: 'totalOrders',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Orders" />,
      cell: ({ row }) => <span className="text-sm font-semibold text-violet-400">{row.original.totalOrders}</span>,
    },
    {
      accessorKey: 'outstandingDues',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Outstanding" />,
      cell: ({ row }) => (
        <span className={`text-sm font-bold ${(row.original as any).outstandingDues > 0 ? 'text-red-400' : 'text-green-400'}`}>
          {formatCurrency((row.original as any).outstandingDues ?? 0)}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <TableActionsRow
          showAction={{ action: () => setDetailSupplier(row.original) }}
          editAction={{ action: () => setEditSupplier(row.original) }}
        />
      ),
    },
  ], [setDetailSupplier, setEditSupplier])

  const poColumns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
    {
      accessorKey: 'poNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="PO Number" />,
      cell: ({ row }) => <span className="text-xs font-mono text-violet-300">{row.original.poNumber}</span>,
    },
    {
      accessorKey: 'supplierName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Truck size={13} className="text-slate-500 flex-shrink-0" />
          <span className="text-sm text-slate-200">{row.original.supplierName}</span>
        </div>
      ),
    },
    {
      id: 'itemCount',
      accessorFn: (row) => row.items.length,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Items" />,
      cell: ({ row }) => <span className="text-xs text-slate-400">{row.original.items.length} items</span>,
    },
    {
      accessorKey: 'total',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
      cell: ({ row }) => <span className="text-sm font-semibold text-white">{formatCurrency(row.original.total)}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order Date" />,
      cell: ({ row }) => <span className="text-xs text-slate-400">{formatDate(row.original.createdAt)}</span>,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${poStatusColors[row.original.status] || ''}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const po = row.original
        const canReceive = po.status !== 'CLOSED'
        return (
          <div className="flex items-center gap-2">
            {canReceive && (
              <button
                onClick={() => handleMarkReceived(po)}
                disabled={markReceiving === po.id}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50">
                {markReceiving === po.id
                  ? <Loader2 size={10} className="animate-spin" />
                  : <CheckCircle size={10} />}
                Receive
              </button>
            )}
            <TableActionsRow
              dropMoreActions={[{ text: 'View Invoice', function: () => router.push(`/purchase-invoice?id=${po.id}`), icon: <FileText size={13} /> }]}
            />
          </div>
        )
      },
    },
  ], [router, markReceiving, handleMarkReceived])

  return (
    <div className="space-y-6">
      {showAddSupplier && <AddSupplierModal onClose={() => setShowAddSupplier(false)} onSaved={refetchSuppliers} />}
      {showNewPO       && <NewPOModal suppliers={suppliers} onClose={() => setShowNewPO(false)} onSaved={() => { refetchOrders(); refetchSuppliers() }} />}
      {detailSupplier  && <SupplierDetailsModal supplier={detailSupplier} onClose={() => setDetailSupplier(null)} onEdit={() => { setEditSupplier(detailSupplier); setDetailSupplier(null) }} />}
      {editSupplier    && <EditSupplierModal supplier={editSupplier} onClose={() => setEditSupplier(null)} onSaved={() => { refetchSuppliers(); setEditSupplier(null) }} />}
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

      {activeTab === 'suppliers' ? (
        <ClientSideTable
          data={suppliers}
          columns={supplierColumns}
          isLoading={suppliersLoading}
          pageCount={Math.ceil((suppliers.length || 1) / 20)}
          searchableColumns={[
            { id: 'name',        title: 'Name'    },
            { id: 'contactName', title: 'Contact' },
          ]}
        />
      ) : (
        <ClientSideTable
          data={purchaseOrders}
          columns={poColumns}
          isLoading={ordersLoading}
          pageCount={Math.ceil((purchaseOrders.length || 1) / 20)}
          searchableColumns={[
            { id: 'poNumber',     title: 'PO #'     },
            { id: 'supplierName', title: 'Supplier' },
          ]}
          filterableColumns={[{
            id: 'status',
            title: 'Status',
            options: [
              { label: 'Draft',    value: 'DRAFT'    },
              { label: 'Sent',     value: 'SENT'     },
              { label: 'Partial',  value: 'PARTIAL'  },
              { label: 'Received', value: 'RECEIVED' },
              { label: 'Closed',   value: 'CLOSED'   },
            ],
          }]}
        />
      )}
    </div>
  )
}
