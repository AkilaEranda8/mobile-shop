'use client'

import { useState } from 'react'
import { Search, Plus, Package, AlertTriangle, Download, Upload, QrCode, Edit, Trash2, Loader2, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useProducts } from '@/lib/hooks'
import { productsApi } from '@/lib/api'
import type { Product } from '@/types'

const categories = ['All', 'Smartphones', 'Accessories', 'Tablets', 'Batteries', 'Screens', 'Chargers']

function AddProductModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', sku: '', categoryName: 'Smartphones', brandName: '', buyingPrice: '', sellingPrice: '', stock: '', minStock: '5', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await productsApi.create({
        ...form,
        buyingPrice: Number(form.buyingPrice),
        sellingPrice: Number(form.sellingPrice),
        stock: Number(form.stock),
        minStock: Number(form.minStock),
      })
      onSaved(); onClose()
    } catch (err: any) { setError(err.message || 'Failed to create product') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <h3 className="text-base font-semibold text-white">Add Product</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Product Name *</label>
              <input required className="input-field" placeholder="iPhone 15 Pro Max 256GB" value={form.name} onChange={f('name')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">SKU *</label>
              <input required className="input-field" placeholder="IP15PM-256-BLK" value={form.sku} onChange={f('sku')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Brand</label>
              <input className="input-field" placeholder="Apple" value={form.brandName} onChange={f('brandName')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Category</label>
              <select className="input-field" value={form.categoryName} onChange={f('categoryName')}>
                {['Smartphones','Accessories','Tablets','Batteries','Screens','Chargers','Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Buying Price (₹) *</label>
              <input required type="number" min="0" className="input-field" placeholder="75000" value={form.buyingPrice} onChange={f('buyingPrice')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Selling Price (₹) *</label>
              <input required type="number" min="0" className="input-field" placeholder="89999" value={form.sellingPrice} onChange={f('sellingPrice')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Stock Qty *</label>
              <input required type="number" min="0" className="input-field" placeholder="10" value={form.stock} onChange={f('stock')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Min Stock Alert</label>
              <input type="number" min="0" className="input-field" placeholder="5" value={form.minStock} onChange={f('minStock')} />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}Add Product
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [showAddModal, setShowAddModal] = useState(false)
  const { data: productsData, loading, refetch } = useProducts()
  const products: Product[] = (productsData?.data ?? []) as Product[]

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || (p as any).categoryName === category
    return matchSearch && matchCat
  })

  const lowStockCount = products.filter(p => p.stock < p.minStock).length

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return
    await productsApi.delete(id)
    refetch()
  }

  return (
    <div className="space-y-6">
      {showAddModal && <AddProductModal onClose={() => setShowAddModal(false)} onSaved={refetch} />}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">{products.length} products · {lowStockCount} low stock alerts</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button className="btn-secondary text-sm flex items-center gap-2">
            <Upload size={14} />Import
          </button>
          <button className="btn-secondary text-sm flex items-center gap-2">
            <Download size={14} />Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total SKUs', value: products.length, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
          { label: 'Total Stock Value', value: formatCurrency(products.reduce((s, p) => s + p.buyingPrice * p.stock, 0)), color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
          { label: 'Low Stock', value: lowStockCount, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
          { label: 'Out of Stock', value: products.filter(p => p.stock === 0).length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
        ].map(stat => (
          <div key={stat.label} className={`card p-4 border ${stat.bg}`}>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, SKU..."
            className="input-field pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-2 text-xs rounded-lg border whitespace-nowrap transition-colors ${category === cat ? 'border-violet-500 bg-violet-500/15 text-violet-300' : 'border-white/10 text-slate-400 hover:border-white/20'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Table */}
      <div className="card overflow-hidden">
        {loading && <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="table-header">Product</th>
                <th className="table-header">SKU</th>
                <th className="table-header">Category</th>
                <th className="table-header text-right">Cost</th>
                <th className="table-header text-right">Selling</th>
                <th className="table-header text-center">Stock</th>
                <th className="table-header text-center">Status</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/3">
              {filtered.map((product) => {
                const isLow = product.stock < product.minStock && product.stock > 0
                const isOut = product.stock === 0
                return (
                  <tr key={product.id} className="hover:bg-white/2 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                          <Package size={14} className="text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.brandName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs font-mono text-slate-400">{product.sku}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs text-slate-400">{product.categoryName}</span>
                    </td>
                    <td className="table-cell text-right">
                      <span className="text-sm text-slate-300">{formatCurrency(product.buyingPrice)}</span>
                    </td>
                    <td className="table-cell text-right">
                      <span className="text-sm font-semibold text-white">{formatCurrency(product.sellingPrice)}</span>
                    </td>
                    <td className="table-cell text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-sm font-bold ${isOut ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-white'}`}>{product.stock}</span>
                        {isLow && <AlertTriangle size={10} className="text-yellow-500 mt-0.5" />}
                      </div>
                    </td>
                    <td className="table-cell text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${isOut ? 'bg-red-500/10 border-red-500/20 text-red-400' : isLow ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                        {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors">
                          <QrCode size={13} />
                        </button>
                        <button className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
                          <Edit size={13} />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
