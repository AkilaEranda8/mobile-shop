'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, Save, X, Layers } from 'lucide-react'
import { servicesApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [editing, setEditing] = useState<Service | null>(null)
  const [showModal, setShowModal] = useState(false)

  const load = async () => {
    try {
      const [res, cats] = await Promise.all([
        servicesApi.list({ active: 'true' }),
        servicesApi.categories(),
      ])
      setServices((res as any)?.data ?? res ?? [])
      setCategories((cats as any)?.data ?? cats ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) &&
    (!filterCategory || s.category === filterCategory)
  )

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    try {
      const body = {
        name: editing.name,
        description: editing.description,
        price: editing.price,
        category: editing.category,
        isActive: editing.isActive,
      }
      if (editing.id.startsWith('new')) {
        await servicesApi.create(body)
      } else {
        await servicesApi.update(editing.id, body)
      }
      setShowModal(false)
      setEditing(null)
      load()
    } catch (e) {
      console.error(e)
      alert('Failed to save service')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this service?')) return
    try {
      await servicesApi.delete(id)
      load()
    } catch (e) {
      console.error(e)
      alert('Failed to delete service')
    }
  }

  const openNew = () => {
    setEditing({
      id: 'new-' + Date.now(),
      name: '',
      description: '',
      price: 0,
      category: categories[0] || 'General',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    })
    setShowModal(true)
  }

  const openEdit = (s: Service) => {
    setEditing(s)
    setShowModal(true)
  }

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Services</h1>
          <p className="text-sm text-slate-400">Manage billable services for POS</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          Add Service
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search services..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-4 py-2 rounded-lg border bg-slate-900/50 border-slate-700 text-white focus:outline-none focus:border-violet-500"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/30 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Name</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Category</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Price</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{s.name}</div>
                  {s.description && <div className="text-xs text-slate-500 mt-0.5">{s.description}</div>}
                </td>
                <td className="px-4 py-3 text-slate-400">{s.category}</td>
                <td className="px-4 py-3 font-medium text-white">{formatCurrency(s.price)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${s.isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/15 text-slate-400 border border-slate-500/20'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  No services found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white">{editing.id.startsWith('new') ? 'New Service' : 'Edit Service'}</h2>
              <button onClick={() => { setShowModal(false); setEditing(null) }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Name *</label>
                <input
                  type="text"
                  required
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  placeholder="e.g. Screen Repair"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Description</label>
                <textarea
                  value={editing.description || ''}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none"
                  rows={2}
                  placeholder="Optional details..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editing.price}
                    onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Category</label>
                  <input
                    type="text"
                    value={editing.category}
                    onChange={e => setEditing({ ...editing, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                    placeholder="General"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={editing.isActive}
                  onChange={e => setEditing({ ...editing, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="active" className="text-sm text-slate-300">Active (visible in POS)</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditing(null) }}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
