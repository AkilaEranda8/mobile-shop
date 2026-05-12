'use client'

import { useState } from 'react'
import {
  Plus, Search, Clock, CheckCircle, PhoneCall, Loader2, SlidersHorizontal, X,
  Eye, Edit, ChevronRight, Smartphone, User, Wrench, DollarSign, AlertTriangle,
  Calendar, Hash, Save, ArrowRight, MessageSquare, Package,
} from 'lucide-react'
import { formatCurrency, formatDate, getRepairStatusColor } from '@/lib/utils'
import { useRepairs, useProducts } from '@/lib/hooks'
import { repairsApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import toast from 'react-hot-toast'
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
  ALL: 'All', RECEIVED: 'Received', DIAGNOSED: 'Diagnosed',
  IN_REPAIR: 'In Repair', QC: 'Quality Check',
  READY: 'Ready', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
}

const STATUS_FLOW = ['RECEIVED', 'DIAGNOSED', 'IN_REPAIR', 'QC', 'READY', 'DELIVERED']

const priorityBadge = (p: string) => {
  const map: Record<string, string> = {
    URGENT: 'bg-red-500/10 border-red-500/20 text-red-400',
    HIGH:   'bg-orange-500/10 border-orange-500/20 text-orange-400',
    NORMAL: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    LOW:    'bg-green-500/10 border-green-500/20 text-green-400',
  }
  return map[p] || 'bg-slate-500/10 border-slate-500/20 text-slate-400'
}

/* ── Repair Details Modal ─────────────────────────────────────────────── */
function RepairDetailsModal({ repair, onClose, onEdit, onStatusChange, onRefresh }: {
  repair: RepairTicket
  onClose: () => void
  onEdit: () => void
  onStatusChange: (id: string, status: string) => Promise<void>
  onRefresh: () => void
}) {
  const [changingStatus, setChangingStatus] = useState(false)
  /* ── spare parts state ── */
  const [showAddPart, setShowAddPart]       = useState(false)
  const [partSearch,  setPartSearch]        = useState('')
  const [partQty,     setPartQty]           = useState(1)
  const [partCost,    setPartCost]          = useState('')
  const [selProduct,  setSelProduct]        = useState<any>(null)
  const [addingPart,  setAddingPart]        = useState(false)
  const [removingId,  setRemovingId]        = useState<string | null>(null)
  const { data: productsData } = useProducts()
  const allProducts: any[] = (productsData?.data ?? []) as any[]
  const filteredProducts = partSearch.length > 1
    ? allProducts.filter(p => p.name.toLowerCase().includes(partSearch.toLowerCase()) || p.sku?.toLowerCase().includes(partSearch.toLowerCase())).slice(0, 8)
    : []

  const handleAddPart = async () => {
    if (!selProduct) return
    setAddingPart(true)
    try {
      await repairsApi.addPart(repair.id, {
        productId: selProduct.id,
        quantity:  partQty,
        unitCost:  partCost ? Number(partCost) : undefined,
      })
      toast.success(`${selProduct.name} added`)
      setShowAddPart(false); setPartSearch(''); setSelProduct(null); setPartQty(1); setPartCost('')
      onRefresh()
    } catch { toast.error('Failed to add part') }
    finally { setAddingPart(false) }
  }

  const handleRemovePart = async (partId: string) => {
    setRemovingId(partId)
    try {
      await repairsApi.removePart(repair.id, partId)
      toast.success('Part removed')
      onRefresh()
    } catch { toast.error('Failed to remove part') }
    finally { setRemovingId(null) }
  }
  const currentIdx = STATUS_FLOW.indexOf(repair.status)
  const nextStatus = STATUS_FLOW[currentIdx + 1] ?? null

  const handleNext = async () => {
    if (!nextStatus) return
    setChangingStatus(true)
    await onStatusChange(repair.id, nextStatus)
    setChangingStatus(false)
  }

  const handleCancel = async () => {
    setChangingStatus(true)
    await onStatusChange(repair.id, 'CANCELLED')
    setChangingStatus(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <div>
            <p className="text-xs font-mono text-violet-400">{repair.ticketNumber}</p>
            <h3 className="text-sm font-bold text-white mt-0.5">{repair.deviceBrand} {repair.deviceModel}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors">
              <Edit size={11} />Edit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Status progress */}
          <div className="bg-white/3 rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Status Progress</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${getRepairStatusColor(repair.status)}`}>
                {statusLabels[repair.status]}
              </span>
            </div>
            <div className="flex items-center gap-1 mb-2">
              {STATUS_FLOW.map((s, i) => {
                const done = i <= currentIdx
                const active = i === currentIdx
                return (
                  <div key={s} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors
                      ${active ? 'bg-violet-500 text-white ring-2 ring-violet-400/30' : done ? 'bg-violet-500/60 text-white' : 'bg-white/5 border border-white/10 text-slate-600'}`}>
                      {done ? <CheckCircle size={12} /> : i + 1}
                    </div>
                    <span className="text-[8px] text-slate-600 text-center leading-tight">
                      {statusLabels[s].split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
            {/* Action buttons */}
            <div className="flex gap-2 mt-3">
              {nextStatus && repair.status !== 'CANCELLED' && (
                <button onClick={handleNext} disabled={changingStatus}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border border-violet-500/20 transition-colors disabled:opacity-50">
                  {changingStatus ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />}
                  Move to {statusLabels[nextStatus]}
                </button>
              )}
              {repair.status !== 'DELIVERED' && repair.status !== 'CANCELLED' && (
                <button onClick={handleCancel} disabled={changingStatus}
                  className="px-3 py-2 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50">
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Device & Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/3 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-1.5 mb-2">
                <Smartphone size={11} className="text-violet-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Device</span>
              </div>
              <p className="text-xs font-semibold text-slate-200">{repair.deviceBrand} {repair.deviceModel}</p>
              {(repair as any).deviceColor && <p className="text-[11px] text-slate-500 mt-0.5">{(repair as any).deviceColor}</p>}
              {repair.imei && <p className="text-[10px] font-mono text-slate-600 mt-1">IMEI: {repair.imei}</p>}
            </div>
            <div className="bg-white/3 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-1.5 mb-2">
                <User size={11} className="text-cyan-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Customer</span>
              </div>
              <p className="text-xs font-semibold text-slate-200">{repair.customerName}</p>
              <a href={`tel:${repair.customerPhone}`} className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-0.5">
                <PhoneCall size={9} />{repair.customerPhone}
              </a>
            </div>
          </div>

          {/* Issue */}
          <div className="bg-white/3 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-2">
              <Wrench size={11} className="text-amber-400" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Reported Issue</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{repair.reportedIssue}</p>
          </div>

          {/* Cost + Technician */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/3 rounded-xl p-3 border border-white/5 text-center">
              <DollarSign size={12} className="mx-auto mb-1 text-emerald-400" />
              <p className="text-sm font-bold text-white">{repair.estimatedCost ? formatCurrency(repair.estimatedCost) : '—'}</p>
              <p className="text-[10px] text-slate-600">Estimated</p>
            </div>
            <div className="bg-white/3 rounded-xl p-3 border border-white/5 text-center">
              <DollarSign size={12} className="mx-auto mb-1 text-violet-400" />
              <p className="text-sm font-bold text-white">{repair.actualCost ? formatCurrency(repair.actualCost) : '—'}</p>
              <p className="text-[10px] text-slate-600">Actual</p>
            </div>
            <div className="bg-white/3 rounded-xl p-3 border border-white/5 text-center">
              <Wrench size={12} className="mx-auto mb-1 text-slate-400" />
              <p className="text-xs font-semibold text-slate-200 truncate">{repair.technicianName || '—'}</p>
              <p className="text-[10px] text-slate-600">Technician</p>
            </div>
          </div>

          {/* ── Spare Parts ── */}
          <div className="bg-white/3 rounded-xl p-3 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Package size={11} className="text-orange-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Spare Parts</span>
              </div>
              <button onClick={() => setShowAddPart(v => !v)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-colors">
                <Plus size={9} />{showAddPart ? 'Cancel' : 'Add Part'}
              </button>
            </div>

            {/* Add part form */}
            {showAddPart && (
              <div className="mb-3 p-3 bg-white/3 rounded-xl border border-white/5 space-y-2">
                {/* Product search */}
                <div className="relative">
                  <input
                    className="input-field text-xs py-1.5"
                    placeholder="Search inventory by name or SKU…"
                    value={selProduct ? selProduct.name : partSearch}
                    onChange={e => { setPartSearch(e.target.value); setSelProduct(null) }}
                  />
                  {filteredProducts.length > 0 && !selProduct && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-[#0f1623] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                      {filteredProducts.map((p: any) => (
                        <button key={p.id} type="button"
                          onClick={() => { setSelProduct(p); setPartSearch(''); setPartCost(String(p.buyingPrice ?? '')) }}
                          className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                          <p className="text-xs text-slate-200 font-medium">{p.name}</p>
                          <p className="text-[10px] text-slate-500">{p.sku ?? ''} · Stock: {p.stock} · {formatCurrency(p.buyingPrice)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selProduct && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <Package size={10} className="text-orange-400 flex-shrink-0" />
                    <span className="text-xs text-orange-300 flex-1 truncate">{selProduct.name}</span>
                    <button onClick={() => setSelProduct(null)} className="text-slate-500 hover:text-white"><X size={10} /></button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Quantity</label>
                    <input type="number" min={1} className="input-field text-xs py-1.5"
                      value={partQty} onChange={e => setPartQty(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Unit Cost (optional)</label>
                    <input type="number" min={0} className="input-field text-xs py-1.5"
                      placeholder={selProduct ? String(selProduct.buyingPrice ?? '') : ''}
                      value={partCost} onChange={e => setPartCost(e.target.value)} />
                  </div>
                </div>
                <button onClick={handleAddPart} disabled={!selProduct || addingPart}
                  className="w-full py-1.5 text-xs rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors">
                  {addingPart ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}Add to Repair
                </button>
              </div>
            )}

            {/* Existing parts list */}
            {repair.spareParts?.length > 0 ? (
              <div className="space-y-1.5">
                {repair.spareParts.map((part: any) => (
                  <div key={part.id} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 text-slate-300 truncate">{part.productName}</span>
                    <span className="text-slate-500">×{part.quantity}</span>
                    <span className="text-slate-400 font-medium w-20 text-right">{formatCurrency(part.total)}</span>
                    <button onClick={() => handleRemovePart(part.id)} disabled={removingId === part.id}
                      className="p-1 text-slate-600 hover:text-red-400 transition-colors disabled:opacity-40">
                      {removingId === part.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-xs font-semibold">
                  <span className="text-slate-500">Total Parts Cost</span>
                  <span className="text-white">{formatCurrency(repair.spareParts.reduce((s: number, p: any) => s + p.total, 0))}</span>
                </div>
              </div>
            ) : (
              !showAddPart && <p className="text-[11px] text-slate-600 text-center py-2">No spare parts added yet</p>
            )}
          </div>

          {/* Status History */}
          {repair.statusHistory?.length > 0 && (
            <div className="bg-white/3 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Status History</p>
              <div className="space-y-2">
                {repair.statusHistory.map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRepairStatusColor(h.status)}`}>{statusLabels[h.status]}</span>
                    <span className="text-[10px] text-slate-500 flex-1">{h.changedBy}</span>
                    <span className="text-[10px] text-slate-600">{formatDate(h.changedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {repair.notes?.length > 0 && (
            <div className="bg-white/3 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare size={11} className="text-blue-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Notes</span>
              </div>
              {repair.notes.map((n: any) => (
                <div key={n.id} className="mb-2 pb-2 border-b border-white/5 last:border-0 last:mb-0 last:pb-0">
                  <p className="text-xs text-slate-300">{n.text}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{n.authorName} · {formatDate(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1">
            <span className="flex items-center gap-1"><Calendar size={10} />Created {formatDate(repair.createdAt)}</span>
            {repair.estimatedCompletion && <span>Due {formatDate(repair.estimatedCompletion)}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Edit Repair Modal ────────────────────────────────────────────────── */
function EditRepairModal({ repair, onClose, onSaved }: {
  repair: RepairTicket; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    customerName:    repair.customerName    ?? '',
    customerPhone:   repair.customerPhone   ?? '',
    deviceBrand:     repair.deviceBrand     ?? '',
    deviceModel:     repair.deviceModel     ?? '',
    deviceColor:     (repair as any).deviceColor ?? '',
    imei:            repair.imei            ?? '',
    reportedIssue:   repair.reportedIssue   ?? '',
    technicianName:  repair.technicianName  ?? '',
    priority:        repair.priority        ?? 'NORMAL',
    estimatedCost:   String(repair.estimatedCost ?? ''),
    actualCost:      String(repair.actualCost    ?? ''),
    estimatedCompletion: repair.estimatedCompletion
      ? repair.estimatedCompletion.slice(0, 10) : '',
  })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      await repairsApi.update(repair.id, {
        ...form,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
        actualCost:    form.actualCost    ? Number(form.actualCost)    : undefined,
      })
      toast.success('Repair job updated')
      onSaved(); onClose()
    } catch (err: any) { toast.error(err?.message ?? 'Update failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <div>
            <p className="text-[10px] font-mono text-violet-400">{repair.ticketNumber}</p>
            <h3 className="text-sm font-bold text-white">Edit Repair Job</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'customerName',  label: 'Customer Name *',  type: 'text',   req: true  },
              { k: 'customerPhone', label: 'Phone *',           type: 'text',   req: true  },
              { k: 'deviceBrand',   label: 'Device Brand *',   type: 'text',   req: true  },
              { k: 'deviceModel',   label: 'Device Model *',   type: 'text',   req: true  },
              { k: 'deviceColor',   label: 'Color',            type: 'text',   req: false },
              { k: 'imei',          label: 'IMEI',             type: 'text',   req: false },
              { k: 'technicianName',label: 'Technician',       type: 'text',   req: false },
              { k: 'estimatedCost', label: 'Estimated Cost',   type: 'number', req: false },
              { k: 'actualCost',    label: 'Actual Cost',      type: 'number', req: false },
              { k: 'estimatedCompletion', label: 'Due Date',   type: 'date',   req: false },
            ].map(({ k, label, type, req }) => (
              <div key={k}>
                <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
                <input
                  type={type} required={req}
                  className="input-field"
                  value={(form as any)[k]}
                  onChange={f(k)}
                  min={type === 'number' ? 0 : undefined}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Priority</label>
              <select className="input-field" value={form.priority} onChange={f('priority')}>
                {['LOW','NORMAL','HIGH','URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Reported Issue *</label>
              <textarea required className="input-field min-h-[72px] resize-none"
                value={form.reportedIssue} onChange={f('reportedIssue')} />
            </div>
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

export default function RepairsPage() {
  const { data: repairsData, loading, refetch } = useRepairs()
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [search, setSearch]                 = useState('')
  const [showAddModal, setShowAddModal]     = useState(false)
  const [detailRepair, setDetailRepair]     = useState<RepairTicket | null>(null)
  const [editRepair,   setEditRepair]       = useState<RepairTicket | null>(null)
  const repairs: RepairTicket[] = (repairsData?.data ?? []) as RepairTicket[]

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await repairsApi.updateStatus(id, status)
      toast.success(`Status → ${statusLabels[status]}`)
      refetch()
      if (detailRepair?.id === id) setDetailRepair(null)
    } catch { toast.error('Status update failed') }
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
      {showAddModal  && <NewTicketModal onClose={() => setShowAddModal(false)} onSaved={refetch} />}
      {detailRepair  && <RepairDetailsModal repair={detailRepair} onClose={() => setDetailRepair(null)} onEdit={() => { setEditRepair(detailRepair); setDetailRepair(null) }} onStatusChange={handleStatusUpdate} onRefresh={async () => { refetch(); const res: any = await repairsApi.getById(detailRepair.id); setDetailRepair(res?.data ?? detailRepair) }} />}
      {editRepair    && <EditRepairModal   repair={editRepair}   onClose={() => setEditRepair(null)}   onSaved={() => { refetch(); setEditRepair(null) }} />}
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
      {loading && <p className="text-sm text-slate-500 py-4">Loading...</p>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((repair) => {
          const currentIdx = STATUS_FLOW.indexOf(repair.status)
          const nextStatus = STATUS_FLOW[currentIdx + 1] ?? null
          return (
            <div key={repair.id} className="card p-4 hover:border-violet-500/20 transition-all flex flex-col">
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
                <a href={`tel:${repair.customerPhone}`} className="ml-auto text-slate-500 hover:text-violet-400">
                  <PhoneCall size={13} />
                </a>
              </div>

              {/* Problem */}
              <p className="text-xs text-slate-500 mb-3 line-clamp-2 flex-1">{repair.reportedIssue}</p>

              {/* Progress mini bar */}
              <div className="flex gap-0.5 mb-3">
                {STATUS_FLOW.map((s, i) => (
                  <div key={s} className={`flex-1 h-1 rounded-full ${i <= currentIdx ? 'bg-violet-500' : 'bg-white/8'}`} />
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityBadge(repair.priority)}`}>
                    {repair.priority}
                  </span>
                  {repair.technicianName && (
                    <span className="text-[10px] text-slate-500 truncate max-w-[80px]">· {repair.technicianName}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Next status quick button */}
                  {nextStatus && repair.status !== 'CANCELLED' && (
                    <button
                      onClick={() => handleStatusUpdate(repair.id, nextStatus)}
                      className="flex items-center gap-0.5 px-2 py-1 text-[10px] rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 transition-colors"
                      title={`Move to ${statusLabels[nextStatus]}`}
                    >
                      <ArrowRight size={9} />{statusLabels[nextStatus]}
                    </button>
                  )}
                  <button
                    onClick={() => setDetailRepair(repair)}
                    className="p-1.5 text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                    title="View Details"
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => setEditRepair(repair)}
                    className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={13} />
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-600 flex items-center gap-1 mt-2">
                <Clock size={9} />{formatDate(repair.createdAt)}
                {repair.estimatedCost ? <span className="ml-auto font-semibold text-slate-400">{formatCurrency(repair.estimatedCost)}</span> : null}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
