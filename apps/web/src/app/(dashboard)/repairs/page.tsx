'use client'

import { useState } from 'react'
import { Plus, Search, Clock, CheckCircle, PhoneCall, Loader2, SlidersHorizontal } from 'lucide-react'
import { formatCurrency, formatDate, getRepairStatusColor } from '@/lib/utils'
import { useRepairs } from '@/lib/hooks'
import { repairsApi } from '@/lib/api'
import type { RepairTicket } from '@/types'

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
    HIGH: 'bg-red-500/10 border-red-500/20 text-red-400',
    MEDIUM: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    LOW: 'bg-green-500/10 border-green-500/20 text-green-400',
  }
  return map[p] || ''
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
          <button className="btn-primary text-sm flex items-center gap-2">
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
