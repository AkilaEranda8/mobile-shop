'use client'

import { useState } from 'react'
import { Search, Plus, Truck, Phone, Mail, Package, Eye, Edit, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useSuppliers, usePurchaseOrders } from '@/lib/hooks'
import type { Supplier, PurchaseOrder } from '@/types'

const poStatusColors: Record<string, string> = {
  DRAFT: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
  SENT: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  PARTIAL: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  RECEIVED: 'bg-green-500/10 border-green-500/20 text-green-400',
  CLOSED: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
}

export default function SuppliersPage() {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers')
  const { data: suppliersData, loading: suppliersLoading } = useSuppliers()
  const { data: ordersData, loading: ordersLoading } = usePurchaseOrders()
  const suppliers: Supplier[] = (suppliersData?.data ?? []) as Supplier[]
  const purchaseOrders: PurchaseOrder[] = (ordersData?.data ?? []) as PurchaseOrder[]

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Suppliers & Purchase Orders</h1>
          <p className="page-subtitle">{suppliers.length} suppliers · {purchaseOrders.length} purchase orders</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button className="btn-secondary text-sm flex items-center gap-2">
            <Plus size={14} />Add Supplier
          </button>
          <button className="btn-primary text-sm flex items-center gap-2">
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
