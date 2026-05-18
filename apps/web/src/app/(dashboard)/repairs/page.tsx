'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Clock, CheckCircle, PhoneCall, Loader2, X,
  Eye, Edit, ChevronRight, Smartphone, User, Wrench, DollarSign, AlertTriangle,
  Calendar, Hash, Save, ArrowRight, MessageSquare, Package, Search, UserPlus, CheckCircle2,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { formatCurrency, formatDate, getRepairStatusColor } from '@/lib/utils'
import { useRepairs, useProducts } from '@/lib/hooks'
import { repairsApi, customersApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import type { Customer } from '@/types'
import toast from 'react-hot-toast'
import type { RepairTicket } from '@/types'

const SOURCE_OPTIONS = [
  { value: 'WALK_IN',    label: 'Walk-in',    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  { value: 'WHATSAPP',   label: 'WhatsApp',   color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/25'   },
  { value: 'FACEBOOK',   label: 'Facebook',   color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25'    },
  { value: 'INSTAGRAM',  label: 'Instagram',  color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/25'    },
  { value: 'PHONE_CALL', label: 'Phone Call', color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25'   },
  { value: 'REFERRAL',   label: 'Referral',   color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/25'  },
  { value: 'ONLINE',     label: 'Online',     color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/25'    },
]

function NewTicketModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  // ── customer search state ──
  const [customerMode, setCustomerMode] = useState<'search' | 'new'>('search')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [searching, setSearching]       = useState(false)
  const [showDrop, setShowDrop]         = useState(false)
  const [newCust, setNewCust]           = useState({ name: '', phone: '', email: '' })
  const [registeringCust, setRegisteringCust] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // ── ticket form state ──
  const [form, setForm] = useState({
    deviceBrand: '', deviceModel: '', deviceColor: '', imei: '',
    reportedIssue: '', priority: 'NORMAL', estimatedCost: '', technicianName: '',
    source: 'WALK_IN',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  // debounced customer search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); setShowDrop(false); return }
    setSearching(true)
    try {
      const res: any = await customersApi.search(q)
      setSearchResults(res.data ?? res ?? [])
      setShowDrop(true)
    } catch { setSearchResults([]) }
    finally { setSearching(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery, doSearch])

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c); setShowDrop(false); setSearchQuery(c.name)
  }

  const clearCustomer = () => {
    setSelectedCustomer(null); setSearchQuery(''); setSearchResults([])
  }

  const registerNewCustomer = async () => {
    if (!newCust.name.trim() || !newCust.phone.trim()) return
    setRegisteringCust(true)
    try {
      const res: any = await customersApi.create({ name: newCust.name.trim(), phone: newCust.phone.trim(), email: newCust.email.trim() || undefined })
      const created: Customer = res.data ?? res
      setSelectedCustomer(created)
      setCustomerMode('search')
      setSearchQuery(created.name)
    } catch (err: any) { setError(err.message || 'Failed to register customer') }
    finally { setRegisteringCust(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer && customerMode === 'search') { setError('Please select or register a customer'); return }
    setLoading(true); setError('')
    try {
      const user = authStorage.getUser()
      await repairsApi.create({
        ...form,
        customerId:    selectedCustomer?.id,
        customerName:  selectedCustomer?.name  ?? newCust.name,
        customerPhone: selectedCustomer?.phone ?? newCust.phone,
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
      <div className="rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0 z-10" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>New Repair Ticket</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* ── Customer section ── */}
          <div className="rounded-xl overflow-visible" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Customer</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => { setCustomerMode('search'); setNewCust({ name: '', phone: '', email: '' }) }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    customerMode === 'search' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  <Search size={10} className="inline mr-1" />Search
                </button>
                <button type="button" onClick={() => { setCustomerMode('new'); clearCustomer() }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    customerMode === 'new' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  <UserPlus size={10} className="inline mr-1" />New
                </button>
              </div>
            </div>

            <div className="px-4 pb-4">
              {customerMode === 'search' ? (
                selectedCustomer ? (
                  /* selected customer card */
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <div className="w-9 h-9 rounded-full bg-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-300 shrink-0">
                      {selectedCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{selectedCustomer.name}</p>
                      <p className="text-xs text-slate-400">{selectedCustomer.phone}</p>
                      <p className="text-[10px] text-violet-400 mt-0.5">{selectedCustomer.totalRepairs ?? 0} previous repairs</p>
                    </div>
                    <button type="button" onClick={clearCustomer} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  /* search input + dropdown */
                  <div className="relative" ref={dropRef}>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 animate-spin" />}
                      <input
                        className="input-field pl-9"
                        placeholder="Search by name or phone..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setSelectedCustomer(null) }}
                        onFocus={() => searchResults.length > 0 && setShowDrop(true)}
                        autoComplete="off"
                      />
                    </div>
                    {showDrop && (
                      <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[#0f1623] shadow-2xl z-50 overflow-hidden">
                        {searchResults.length > 0 ? (
                          <>
                            {searchResults.map(c => (
                              <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left">
                                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
                                  {c.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                                  <p className="text-xs text-slate-500">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                                </div>
                                <span className="text-[10px] text-slate-600 shrink-0">{c.totalRepairs ?? 0} repairs</span>
                              </button>
                            ))}
                            <div className="border-t border-white/5" />
                          </>
                        ) : (
                          <p className="px-4 py-3 text-xs text-slate-500">No customers found</p>
                        )}
                        <button type="button" onClick={() => { setCustomerMode('new'); setShowDrop(false); setNewCust(p => ({ ...p, name: searchQuery })) }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-emerald-500/10 transition-colors text-left">
                          <UserPlus size={13} className="text-emerald-400" />
                          <span className="text-xs text-emerald-400">Register as new customer</span>
                        </button>
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* new customer registration form */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Name *</label>
                      <input required className="input-field" placeholder="Kavitha M" value={newCust.name}
                        onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Phone *</label>
                      <input required className="input-field" placeholder="0771234567" value={newCust.phone}
                        onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Email <span className="text-slate-600">(optional)</span></label>
                      <input className="input-field" placeholder="kavitha@example.com" value={newCust.email}
                        onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))} />
                    </div>
                  </div>
                  <button type="button" onClick={registerNewCustomer} disabled={registeringCust || !newCust.name || !newCust.phone}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-all disabled:opacity-50">
                    {registeringCust ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    Register & Select Customer
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Device details ── */}
          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-xs text-slate-400 mb-1.5">IMEI</label>
              <input className="input-field font-mono" placeholder="Enter 15-digit IMEI (optional)" maxLength={17} value={form.imei} onChange={f('imei')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Reported Issue *</label>
              <textarea required className="input-field min-h-[72px] resize-none" placeholder="Screen cracked, touch not working..." value={form.reportedIssue} onChange={f('reportedIssue')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-2">Customer Source</label>
              <div className="flex flex-wrap gap-2">
                {SOURCE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, source: opt.value }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      form.source === opt.value
                        ? `${opt.color} ${opt.bg} ${opt.border}`
                        : 'text-slate-500 bg-white/3 border-white/8 hover:border-white/20'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
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

const STATUS_FLOW = ['RECEIVED', 'IN_REPAIR', 'READY']

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
  /* ── collect payment state ── */
  const [collecting,  setCollecting]  = useState(false)
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

  const handleCollectPayment = async () => {
    setCollecting(true)
    try {
      await repairsApi.update(repair.id, { actualCost: repair.actualCost ?? repair.estimatedCost })
      await onStatusChange(repair.id, 'DELIVERED')
    } catch { toast.error('Failed to collect payment') }
    finally { setCollecting(false) }
  }

  const partsTotal = repair.spareParts?.reduce((s: number, p: any) => s + p.total, 0) ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* ── Hero Header ── */}
        <div className="relative overflow-hidden rounded-t-2xl" data-scheme="dark"
          style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)' }}>
          {/* decorative circles */}
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-violet-500/10 pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-cyan-500/10 pointer-events-none" />

          <div className="relative px-6 pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 shadow-lg">
                  <Smartphone size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-mono font-bold text-violet-300 tracking-widest leading-none">{repair.ticketNumber}</p>
                  <h3 className="text-base font-bold text-white mt-0.5">{repair.deviceBrand} {repair.deviceModel}</h3>
                  {(repair as any).deviceColor && <p className="text-[11px] text-violet-300/70 mt-0.5">{(repair as any).deviceColor}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-3 py-1 rounded-full border font-semibold ${getRepairStatusColor(repair.status)}`}>
                  {statusLabels[repair.status]}
                </span>
                {repair.priority && repair.priority !== 'NORMAL' && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${priorityBadge(repair.priority)}`}>
                    {repair.priority}
                  </span>
                )}
                <button onClick={onEdit}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg font-semibold text-white/80 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <Edit size={11} />Edit
                </button>
                <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Status stepper */}
            <div className="mt-5 mb-1">
              <div className="relative flex items-center">
                <div className="absolute left-3 right-3 top-3.5 h-0.5 bg-white/10" />
                <div className="absolute left-3 top-3.5 h-0.5 bg-violet-400/60 transition-all"
                  style={{ width: currentIdx < 0 ? '0%' : `${(currentIdx / (STATUS_FLOW.length - 1)) * (100 - (6 / STATUS_FLOW.length))}%` }} />
                {STATUS_FLOW.map((s, i) => {
                  const done   = i < currentIdx
                  const active = i === currentIdx
                  return (
                    <div key={s} className="flex-1 flex flex-col items-center gap-1.5 relative z-10">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all shadow-sm
                        ${active  ? 'bg-violet-500 border-violet-300 text-white shadow-violet-500/40'
                        : done   ? 'bg-violet-400 border-violet-300/60 text-white'
                        : 'bg-white/10 border-white/20 text-white/40'}`}>
                        {done ? <CheckCircle size={13} /> : active ? <span className="w-2 h-2 rounded-full bg-white inline-block" /> : i + 1}
                      </div>
                      <span className={`text-[9px] font-semibold tracking-wide ${active ? 'text-violet-200' : done ? 'text-white/60' : 'text-white/30'}`}>
                        {statusLabels[s].split(' ')[0]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Action bar */}
          {repair.status !== 'DELIVERED' && repair.status !== 'CANCELLED' && (
            <div className="px-6 pb-4 space-y-2">
              <div className="flex gap-2">
                {repair.status === 'READY' ? (
                  <button onClick={handleCollectPayment} disabled={collecting || changingStatus}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl text-white transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', border: '1px solid rgba(134,239,172,0.3)', boxShadow: '0 2px 12px rgba(22,163,74,0.35)' }}>
                    {collecting ? <Loader2 size={13} className="animate-spin" /> : <DollarSign size={13} />}Collect Payment
                  </button>
                ) : nextStatus ? (
                  <button onClick={handleNext} disabled={changingStatus}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl text-white transition-all disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(4px)' }}>
                    {changingStatus ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                    Move to {statusLabels[nextStatus]}
                  </button>
                ) : null}
                <button onClick={handleCancel} disabled={changingStatus}
                  className="px-5 py-2.5 text-xs rounded-xl font-bold transition-colors disabled:opacity-50 text-red-300"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  Cancel
                </button>
              </div>

            </div>
          )}
        </div>

        <div className="p-5 space-y-3">

          {/* ── Device & Customer ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center"><Smartphone size={12} className="text-violet-500" /></div>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Device</span>
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{repair.deviceBrand} {repair.deviceModel}</p>
              {(repair as any).deviceColor && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{(repair as any).deviceColor}</p>}
              {repair.imei && <p className="text-[10px] font-mono mt-1 px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-card)' }}>IMEI: {repair.imei}</p>}
            </div>
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/15 flex items-center justify-center"><User size={12} className="text-cyan-500" /></div>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Customer</span>
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{repair.customerName}</p>
              <a href={`tel:${repair.customerPhone}`} className="text-xs flex items-center gap-1 mt-1 text-cyan-500 hover:underline font-medium">
                <PhoneCall size={10} />{repair.customerPhone}
              </a>
            </div>
          </div>

          {/* ── Reported Issue ── */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center"><Wrench size={12} className="text-amber-500" /></div>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Reported Issue</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{repair.reportedIssue}</p>
          </div>

          {/* ── Financials + Technician ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3.5 text-center" style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.08),rgba(16,185,129,0.04))', border: '1px solid rgba(16,185,129,0.2)' }}>
              <DollarSign size={15} className="text-emerald-500 mx-auto mb-1.5" />
              <p className="text-sm font-bold text-emerald-600">{repair.estimatedCost ? formatCurrency(repair.estimatedCost) : '—'}</p>
              <p className="text-[10px] mt-0.5 font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Estimated</p>
            </div>
            <div className="rounded-xl p-3.5 text-center" style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(124,58,237,0.04))', border: '1px solid rgba(124,58,237,0.2)' }}>
              <DollarSign size={15} className="text-violet-500 mx-auto mb-1.5" />
              <p className="text-sm font-bold text-violet-600">{repair.actualCost ? formatCurrency(repair.actualCost) : '—'}</p>
              <p className="text-[10px] mt-0.5 font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Actual</p>
            </div>
            <div className="rounded-xl p-3.5 text-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <Wrench size={15} className="mx-auto mb-1.5" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{repair.technicianName || '—'}</p>
              <p className="text-[10px] mt-0.5 font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Technician</p>
            </div>
          </div>

          {/* ── Spare Parts ── */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-orange-500/15 flex items-center justify-center"><Package size={12} className="text-orange-500" /></div>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Spare Parts</span>
                {repair.spareParts?.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                    {repair.spareParts.length}
                  </span>
                )}
              </div>
              <button onClick={() => setShowAddPart(v => !v)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-colors"
                style={{ background: showAddPart ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.10)', color: showAddPart ? '#ef4444' : '#ea580c', border: `1px solid ${showAddPart ? 'rgba(239,68,68,0.2)' : 'rgba(249,115,22,0.25)'}` }}>
                {showAddPart ? <><X size={10} />Cancel</> : <><Plus size={10} />Add Part</>}
              </button>
            </div>

            <div className="p-4 space-y-3" style={{ background: 'var(--bg-card)' }}>
              {showAddPart && (
                <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
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
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.sku ?? ''} · Stock: {p.stock} · {formatCurrency(p.buyingPrice)}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selProduct && (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                      <Package size={10} className="text-orange-500 flex-shrink-0" />
                      <span className="text-xs flex-1 truncate font-medium text-orange-600">{selProduct.name}</span>
                      <button onClick={() => setSelProduct(null)} style={{ color: 'var(--text-muted)' }}><X size={10} /></button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] mb-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Quantity</label>
                      <input type="number" min={1} className="input-field text-xs py-1.5" value={partQty} onChange={e => setPartQty(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="block text-[10px] mb-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Unit Cost (optional)</label>
                      <input type="number" min={0} className="input-field text-xs py-1.5"
                        placeholder={selProduct ? String(selProduct.buyingPrice ?? '') : ''} value={partCost} onChange={e => setPartCost(e.target.value)} />
                    </div>
                  </div>
                  <button onClick={handleAddPart} disabled={!selProduct || addingPart}
                    className="w-full py-2 text-xs rounded-xl text-white font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                    style={{ background: 'linear-gradient(135deg,#ea580c,#c2410c)' }}>
                    {addingPart ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}Add to Repair
                  </button>
                </div>
              )}

              {repair.spareParts?.length > 0 ? (
                <>
                  <div className="space-y-1">
                    {repair.spareParts.map((part: any) => (
                      <div key={part.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                        <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                          <Package size={11} className="text-orange-500" />
                        </div>
                        <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{part.productName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>×{part.quantity}</span>
                        <span className="text-xs font-bold w-20 text-right" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(part.total)}</span>
                        <button onClick={() => handleRemovePart(part.id)} disabled={removingId === part.id}
                          className="p-1 rounded-lg transition-colors disabled:opacity-40 text-red-400 hover:text-red-600 hover:bg-red-500/10">
                          {removingId === part.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs"
                    style={{ background: 'linear-gradient(135deg,rgba(249,115,22,0.08),rgba(249,115,22,0.04))', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <span className="text-orange-600">Total Parts Cost</span>
                    <span className="text-orange-600">{formatCurrency(partsTotal)}</span>
                  </div>
                </>
              ) : (
                !showAddPart && (
                  <div className="text-center py-6">
                    <Package size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No spare parts added yet</p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* ── Status History ── */}
          {repair.statusHistory?.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                <Clock size={12} className="text-blue-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Status History</span>
              </div>
              <div className="p-4 space-y-2" style={{ background: 'var(--bg-card)' }}>
                {repair.statusHistory.map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${getRepairStatusColor(h.status)}`}>{statusLabels[h.status]}</span>
                    <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{h.changedBy}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(h.changedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          {repair.notes?.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                <MessageSquare size={12} className="text-blue-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Notes</span>
              </div>
              <div className="p-4 space-y-2" style={{ background: 'var(--bg-card)' }}>
                {repair.notes.map((n: any) => (
                  <div key={n.id} className="pb-2 last:pb-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{n.text}</p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{n.authorName} · {formatDate(n.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="flex items-center justify-between text-[11px] pt-1 pb-1" style={{ color: 'var(--text-muted)' }}>
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
      <div className="rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div>
            <p className="text-[10px] font-mono text-violet-400">{repair.ticketNumber}</p>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Edit Repair Job</h3>
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
