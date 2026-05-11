'use client'

import { useState } from 'react'
import { Plus, Search, Clock, CheckCircle, PhoneCall, Loader2, SlidersHorizontal, X } from 'lucide-react'
import { formatCurrency, formatDate, getRepairStatusColor } from '@/lib/utils'
import { useRepairs } from '@/lib/hooks'
import { repairsApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import type { RepairTicket } from '@/types'

function NewTicketModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', deviceBrand: '', deviceModel: '',
    deviceColor: '', reportedIssue: '', priority: 'NORMAL', estimatedCost: '', technicianName: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const user = authStorage.getUser()
      await repairsApi.create({
        ...form,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
        branchId: user?.branchIds?.[0],
        createdBy: user?.name || 'Staff',
      })
      onSaved(); onClose()
    } catch (err: any) { setError(err.message || 'Failed to create ticket') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <h3 className="text-base font-semibold text-white">New Repair Ticket</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Customer Name *</label>
              <input required className="input-field" placeholder="Kavitha M" value={form.customerName} onChange={f('customerName')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Phone *</label>
              <input required className="input-field" placeholder="9876543210" value={form.customerPhone} onChange={f('customerPhone')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Device Brand *</label>
              <input required className="input-field" placeholder="Apple" value={form.deviceBrand} onChange={f('deviceBrand')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Device Model *</label>
              <input required className="input-field" placeholder="iPhone 14 Pro" value={form.deviceModel} onChange={f('deviceModel')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Color</label>
              <input className="input-field" placeholder="Space Black" value={form.deviceColor} onChange={f('deviceColor')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Technician</label>
              <input className="input-field" placeholder="Assign technician" value={form.technicianName} onChange={f('technicianName')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Reported Issue *</label>
              <textarea required className="input-field min-h-[72px] resize-none" placeholder="Screen cracked, touch not working..." value={form.reportedIssue} onChange={f('reportedIssue')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Priority</label>
              <select className="input-field" value={form.priority} onChange={f('priority')}>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Estimated Cost (₹)</label>
              <input type="number" min="0" className="input-field" placeholder="2500" value={form.estimatedCost} onChange={f('estimatedCost')} />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}Create Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const statuses = ['ALL', 'RECEIVED', 'DIAGNOSED', 'IN_REPAIR', 'QC', 'READY', 'DELIVERED', 'CANCELLED']

const statusLabels: Record<string, string> = {
  ALL: 'All',
  RECEIVED: 'Received',
  DIAGNOSED: 'Diagnosed',
  IN_REPAIR: 'In Repair',
  QC: 'Quality Check',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

const priorityBadge = (p: string) => {
  const map: Record<string, string> = {
    URGENT: 'bg-red-500/10 border-red-500/20 text-red-400',
    HIGH: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    NORMAL: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    LOW: 'bg-green-500/10 border-green-500/20 text-green-400',
  }
  return map[p] || 'bg-slate-500/10 border-slate-500/20 text-slate-400'
}

export default function RepairsPage() {
  const { data: repairsData, loading, refetch } = useRepairs()
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const repairs: RepairTicket[] = (repairsData?.data ?? []) as RepairTicket[]
  const [selectedRepair, setSelectedRepair] = useState<string | null>(null)

  const handleStatusUpdate = async (id: string, status: string) => {
    await repairsApi.updateStatus(id, status)
    refetch()
  }

  const filtered = repairs.filter(r => {
    const matchSearch = r.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.customerName.toLowerCase().includes(search.toLowerCase()) ||
      `${r.deviceBrand} ${r.deviceModel}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus = selectedStatus === 'ALL' || r.status === selectedStatus
    return matchSearch && matchStatus
  })

  const statusCounts = statuses.reduce((acc, s) => {
    acc[s] = s === 'ALL' ? repairs.length : repairs.filter((r: RepairTicket) => r.status === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {showAddModal && <NewTicketModal onClose={() => setShowAddModal(false)} onSaved={refetch} />}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Repair Jobs</h1>
          <p className="page-subtitle">Finite State Machine · Kanban workflow</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button className="btn-secondary text-sm flex items-center gap-2">
            <SlidersHorizontal size={14} />Filter
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />New Ticket
          </button>
        </div>
      </div>

      {/* Status Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setSelectedStatus(s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors ${selectedStatus === s ? 'border-violet-500 bg-violet-500/15 text-violet-300' : 'border-white/10 text-slate-400 hover:border-white/20'}`}
          >
            {statusLabels[s]}
            <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full border ${selectedStatus === s ? 'bg-violet-500/20 border-violet-500/30 text-violet-300' : 'bg-white/5 border-white/10 text-slate-500'}`}>
              {statusCounts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search ticket #, customer, device..."
          className="input-field pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Repair Cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((repair) => (
          <div
            key={repair.id}
            onClick={() => setSelectedRepair(repair.id === selectedRepair ? null : repair.id)}
            className={`card p-4 cursor-pointer transition-all hover:border-violet-500/20 ${selectedRepair === repair.id ? 'border-violet-500/40 bg-violet-500/5' : ''}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-mono text-violet-400">{repair.ticketNumber}</p>
                <p className="text-sm font-semibold text-white mt-0.5">{repair.deviceBrand} {repair.deviceModel}</p>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${getRepairStatusColor(repair.status)}`}>
                {statusLabels[repair.status]}
              </span>
            </div>

            {/* Customer */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300">
                {repair.customerName.charAt(0)}
              </div>
              <p className="text-xs text-slate-400">{repair.customerName}</p>
              <a href={`tel:${repair.customerPhone}`} onClick={e => e.stopPropagation()} className="ml-auto text-slate-500 hover:text-violet-400">
                <PhoneCall size={13} />
              </a>
            </div>

            {/* Problem */}
            <p className="text-xs text-slate-500 mb-3 line-clamp-2">{repair.reportedIssue}</p>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityBadge(repair.priority)}`}>
                  {repair.priority}
                </span>
                {repair.technicianName && (
                  <span className="text-[10px] text-slate-500">· {repair.technicianName}</span>
                )}
              </div>
              <div className="text-right">
                {repair.estimatedCost && (
                  <p className="text-xs font-bold text-white">{formatCurrency(repair.estimatedCost)}</p>
                )}
                <p className="text-[10px] text-slate-600 flex items-center gap-1 justify-end">
                  <Clock size={9} />{formatDate(repair.createdAt)}
                </p>
              </div>
            </div>

            {/* Status Progress */}
            {selectedRepair === repair.id && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1">
                  {['RECEIVED', 'DIAGNOSED', 'IN_REPAIR', 'QC', 'DELIVERED'].map((s, i) => {
                    const steps = ['RECEIVED', 'DIAGNOSED', 'IN_REPAIR', 'QC', 'READY', 'DELIVERED']
                    const currentIdx = steps.indexOf(repair.status)
                    const stepIdx = steps.indexOf(s)
                    const isDone = stepIdx <= currentIdx
                    return (
                      <div key={s} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isDone ? 'bg-violet-500' : 'bg-white/5 border border-white/10'}`}>
                          {isDone ? <CheckCircle size={11} className="text-white" /> : <span className="text-[9px] text-slate-600">{i + 1}</span>}
                        </div>
                        {i < 4 && <div className={`h-0.5 w-full ${isDone ? 'bg-violet-500' : 'bg-white/5'}`} style={{ marginTop: '-10px', zIndex: -1 }} />}
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  {['Received', 'Diagnosed', 'In Repair', 'QC', 'Done'].map(l => (
                    <span key={l} className="text-[9px] text-slate-600 text-center flex-1">{l}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
