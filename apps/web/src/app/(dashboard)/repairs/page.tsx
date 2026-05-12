'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Clock, CheckCircle, PhoneCall, Loader2, X,
  Eye, Edit, ChevronRight, Smartphone, User, Wrench, DollarSign, AlertTriangle,
  Calendar, Hash, Save, ArrowRight, MessageSquare, Package,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* ── Header ── */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Smartphone size={16} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[11px] font-mono font-semibold text-violet-400 leading-none">{repair.ticketNumber}</p>
              <h3 className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {repair.deviceBrand} {repair.deviceModel}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${getRepairStatusColor(repair.status)}`}>
              {statusLabels[repair.status]}
            </span>
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
              <Edit size={11} />Edit
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Status Timeline ── */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Status Progress</p>
            <div className="relative flex items-start">
              {/* connecting line */}
              <div className="absolute top-3.5 left-3.5 right-3.5 h-0.5 bg-violet-500/15 -z-0" />
              {STATUS_FLOW.map((s, i) => {
                const done   = i <= currentIdx
                const active = i === currentIdx
                return (
                  <div key={s} className="flex-1 flex flex-col items-center gap-1.5 relative z-10">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold border-2 transition-all
                      ${active  ? 'bg-violet-500 border-violet-400 text-white shadow-lg shadow-violet-500/30'
                      : done   ? 'bg-violet-400/80 border-violet-400/60 text-white'
                      : 'bg-white/10 border-slate-600/30 text-slate-500'}`}
                      style={!active && !done ? { background: 'var(--bg-card)', borderColor: 'var(--border-default)' } : undefined}>
                      {done ? <CheckCircle size={13} /> : i + 1}
                    </div>
                    <span className="text-[9px] text-center leading-tight" style={{ color: active ? '#a78bfa' : 'var(--text-muted)' }}>
                      {statusLabels[s].split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            {(nextStatus || (repair.status !== 'DELIVERED' && repair.status !== 'CANCELLED')) && (
              <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {nextStatus && repair.status !== 'CANCELLED' && (
                  <button onClick={handleNext} disabled={changingStatus}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-xl text-white transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}>
                    {changingStatus ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                    Move to {statusLabels[nextStatus]}
                  </button>
                )}
                {repair.status !== 'DELIVERED' && repair.status !== 'CANCELLED' && (
                  <button onClick={handleCancel} disabled={changingStatus}
                    className="px-4 py-2 text-xs rounded-xl font-medium transition-colors disabled:opacity-50 text-red-500"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Device & Customer ── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: <Smartphone size={13} className="text-violet-400" />,
                label: 'Device',
                accent: '#7c3aed',
                lines: [
                  <span key="d" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{repair.deviceBrand} {repair.deviceModel}</span>,
                  (repair as any).deviceColor && <span key="c" className="text-xs" style={{ color: 'var(--text-muted)' }}>{(repair as any).deviceColor}</span>,
                  repair.imei && <span key="i" className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>IMEI: {repair.imei}</span>,
                ],
              },
              {
                icon: <User size={13} className="text-cyan-400" />,
                label: 'Customer',
                accent: '#0891b2',
                lines: [
                  <span key="n" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{repair.customerName}</span>,
                  <a key="p" href={`tel:${repair.customerPhone}`} className="text-xs flex items-center gap-1 text-cyan-500 hover:underline">
                    <PhoneCall size={10} />{repair.customerPhone}
                  </a>,
                ],
              },
            ].map(({ icon, label, lines }) => (
              <div key={label} className="rounded-xl p-3.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  {icon}
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
                </div>
                <div className="flex flex-col gap-0.5">{lines.filter(Boolean)}</div>
              </div>
            ))}
          </div>

          {/* ── Issue ── */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Wrench size={13} className="text-amber-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Reported Issue</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{repair.reportedIssue}</p>
          </div>

          {/* ── Cost + Technician ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <DollarSign size={14} className="text-emerald-500" />, label: 'Estimated', value: repair.estimatedCost ? formatCurrency(repair.estimatedCost) : '—' },
              { icon: <DollarSign size={14} className="text-violet-400" />,  label: 'Actual',    value: repair.actualCost    ? formatCurrency(repair.actualCost)    : '—' },
              { icon: <Wrench size={14} className="text-slate-400" />,       label: 'Technician',value: repair.technicianName || '—' },
            ].map(({ icon, label, value }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex justify-center mb-1.5">{icon}</div>
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* ── Spare Parts ── */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Package size={13} className="text-orange-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Spare Parts</span>
              </div>
              <button onClick={() => setShowAddPart(v => !v)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg font-medium transition-colors"
                style={{ background: 'rgba(249,115,22,0.10)', color: '#ea580c', border: '1px solid rgba(249,115,22,0.25)' }}>
                <Plus size={10} />{showAddPart ? 'Cancel' : 'Add Part'}
              </button>
            </div>

            {showAddPart && (
              <div className="mb-3 p-3 rounded-xl space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <div className="relative">
                  <input className="input-field text-xs py-1.5" placeholder="Search inventory by name or SKU…"
                    value={selProduct ? selProduct.name : partSearch}
                    onChange={e => { setPartSearch(e.target.value); setSelProduct(null) }} />
                  {filteredProducts.length > 0 && !selProduct && (
                    <div className="absolute z-10 top-full mt-1 w-full rounded-xl shadow-xl overflow-hidden"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                      {filteredProducts.map((p: any) => (
                        <button key={p.id} type="button"
                          onClick={() => { setSelProduct(p); setPartSearch(''); setPartCost(String(p.buyingPrice ?? '')) }}
                          className="w-full text-left px-3 py-2 transition-colors hover:bg-white/5"
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.sku ?? ''} · Stock: {p.stock} · {formatCurrency(p.buyingPrice)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selProduct && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <Package size={10} className="text-orange-500 flex-shrink-0" />
                    <span className="text-xs flex-1 truncate text-orange-600">{selProduct.name}</span>
                    <button onClick={() => setSelProduct(null)} style={{ color: 'var(--text-muted)' }}><X size={10} /></button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Quantity</label>
                    <input type="number" min={1} className="input-field text-xs py-1.5" value={partQty} onChange={e => setPartQty(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Unit Cost (optional)</label>
                    <input type="number" min={0} className="input-field text-xs py-1.5"
                      placeholder={selProduct ? String(selProduct.buyingPrice ?? '') : ''} value={partCost} onChange={e => setPartCost(e.target.value)} />
                  </div>
                </div>
                <button onClick={handleAddPart} disabled={!selProduct || addingPart}
                  className="w-full py-2 text-xs rounded-xl text-white font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                  style={{ background: '#ea580c' }}>
                  {addingPart ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}Add to Repair
                </button>
              </div>
            )}

            {repair.spareParts?.length > 0 ? (
              <div className="space-y-2">
                {repair.spareParts.map((part: any) => (
                  <div key={part.id} className="flex items-center gap-2 py-1.5 text-xs"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <span className="flex-1 font-medium truncate" style={{ color: 'var(--text-primary)' }}>{part.productName}</span>
                    <span style={{ color: 'var(--text-muted)' }}>×{part.quantity}</span>
                    <span className="font-semibold w-20 text-right" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(part.total)}</span>
                    <button onClick={() => handleRemovePart(part.id)} disabled={removingId === part.id}
                      className="p-1 transition-colors disabled:opacity-40 text-red-400 hover:text-red-600">
                      {removingId === part.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 text-xs font-bold">
                  <span style={{ color: 'var(--text-muted)' }}>Total Parts Cost</span>
                  <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(repair.spareParts.reduce((s: number, p: any) => s + p.total, 0))}</span>
                </div>
              </div>
            ) : (
              !showAddPart && <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>No spare parts added yet</p>
            )}
          </div>

          {/* ── Status History ── */}
          {repair.statusHistory?.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Status History</p>
              <div className="space-y-2">
                {repair.statusHistory.map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getRepairStatusColor(h.status)}`}>{statusLabels[h.status]}</span>
                    <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{h.changedBy}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(h.changedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          {repair.notes?.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5 mb-3">
                <MessageSquare size={13} className="text-blue-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Notes</span>
              </div>
              {repair.notes.map((n: any) => (
                <div key={n.id} className="pb-2 mb-2 last:pb-0 last:mb-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{n.text}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{n.authorName} · {formatDate(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Footer ── */}
          <div className="flex items-center justify-between text-[11px] pt-1" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5"><Calendar size={11} />Created {formatDate(repair.createdAt)}</span>
            {repair.estimatedCompletion && <span className="flex items-center gap-1.5"><Calendar size={11} />Due {formatDate(repair.estimatedCompletion)}</span>}
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

  const columns = useMemo<ColumnDef<RepairTicket>[]>(() => [
    {
      accessorKey: 'ticketNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Ticket #" />,
      cell: ({ row }) => <span className="text-xs font-mono text-violet-400">{row.original.ticketNumber}</span>,
    },
    {
      id: 'device',
      accessorFn: (row) => `${row.deviceBrand} ${row.deviceModel}`,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Device" />,
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-white">{row.original.deviceBrand} {row.original.deviceModel}</p>
        </div>
      ),
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300">
            {row.original.customerName.charAt(0)}
          </div>
          <div>
            <p className="text-xs text-slate-300">{row.original.customerName}</p>
            <a href={`tel:${row.original.customerPhone}`} className="text-[10px] text-slate-500 hover:text-violet-400">{row.original.customerPhone}</a>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'reportedIssue',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Issue" />,
      cell: ({ row }) => <p className="text-xs text-slate-400 max-w-[200px] truncate">{row.original.reportedIssue}</p>,
    },
    {
      accessorKey: 'priority',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Priority" />,
      cell: ({ row }) => (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityBadge(row.original.priority)}`}>
          {row.original.priority}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${getRepairStatusColor(row.original.status)}`}>
          {statusLabels[row.original.status] ?? row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => <span className="text-xs text-slate-500">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <TableActionsRow
          showAction={{ action: () => setDetailRepair(row.original) }}
          editAction={{ action: () => setEditRepair(row.original) }}
        />
      ),
    },
  ], [setDetailRepair, setEditRepair])

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
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />New Ticket
          </button>
        </div>
      </div>

      {/* Table */}
      <ClientSideTable
        data={repairs}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((repairs.length || 1) / 20)}
        searchableColumns={[
          { id: 'ticketNumber',          title: 'Ticket #'  },
          { id: 'customerName',           title: 'Customer'  },
          { id: 'device' as any,          title: 'Device'    },
        ]}
        filterableColumns={[
          {
            id: 'status',
            title: 'Status',
            options: [
              { label: 'Received',     value: 'RECEIVED'   },
              { label: 'Diagnosed',    value: 'DIAGNOSED'  },
              { label: 'In Repair',    value: 'IN_REPAIR'  },
              { label: 'Quality Check',value: 'QC'         },
              { label: 'Ready',        value: 'READY'      },
              { label: 'Delivered',    value: 'DELIVERED'  },
              { label: 'Cancelled',    value: 'CANCELLED'  },
            ],
          },
          {
            id: 'priority',
            title: 'Priority',
            options: [
              { label: 'Urgent', value: 'URGENT' },
              { label: 'High',   value: 'HIGH'   },
              { label: 'Normal', value: 'NORMAL' },
              { label: 'Low',    value: 'LOW'    },
            ],
          },
        ]}
      />
    </div>
  )
}
