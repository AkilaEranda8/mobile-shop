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
  const [showPayment, setShowPayment] = useState(false)
  const [discount,    setDiscount]    = useState('')
  const [payMethod,   setPayMethod]   = useState<'CASH'|'CARD'|'UPI'|'BANK_TRANSFER'>('CASH')
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

  const partsTotal   = repair.spareParts?.reduce((s: number, p: any) => s + p.total, 0) ?? 0
  const subtotal     = (repair.estimatedCost ?? 0) + partsTotal
  const discountAmt  = Number(discount) || 0
  const finalAmount  = Math.max(0, subtotal - discountAmt)

  const handleCollectPayment = async () => {
    setCollecting(true)
    try {
      await repairsApi.collectPayment(repair.id, { discount: discountAmt, paymentMethod: payMethod })
      toast.success('Payment collected — sale recorded!')
      setShowPayment(false)
      onRefresh()
      onClose()
    } catch { toast.error('Failed to collect payment') }
    finally { setCollecting(false) }
  }

  const STEP_ICONS = [Smartphone, Wrench, CheckCircle2]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-3xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* ══ HEADER ══ */}
        <div className="relative overflow-hidden rounded-t-3xl" data-scheme="dark"
          style={{ background: 'linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)' }}>
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #7c3aed 0%, transparent 50%), radial-gradient(circle at 10% 80%, #0ea5e9 0%, transparent 45%)' }} />

          <div className="relative px-6 pt-6 pb-5">
            {/* top row */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}>
                  <Smartphone size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold tracking-[0.18em] text-violet-300 leading-none mb-1">{repair.ticketNumber}</p>
                  <h3 className="text-lg font-bold text-white leading-tight">{repair.deviceBrand} {repair.deviceModel}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getRepairStatusColor(repair.status)}`}>{statusLabels[repair.status]}</span>
                    {repair.priority && repair.priority !== 'NORMAL' && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${priorityBadge(repair.priority)}`}>{repair.priority}</span>
                    )}
                    {(repair as any).source && (repair as any).source !== 'WALK_IN' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-cyan-300 bg-cyan-500/15 border border-cyan-500/20">{(repair as any).source.replace('_',' ')}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white/80 hover:text-white transition-all"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)' }}>
                  <Edit size={11} />Edit
                </button>
                <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* ── Progress stepper ── */}
            <div className="relative flex items-center px-2">
              <div className="absolute left-8 right-8 top-5 h-[2px] rounded-full bg-white/10" />
              <div className="absolute left-8 top-5 h-[2px] rounded-full bg-gradient-to-r from-violet-400 to-violet-300 transition-all duration-500"
                style={{ width: currentIdx <= 0 ? '0%' : currentIdx === 1 ? '50%' : '100%' }} />
              {STATUS_FLOW.map((s, i) => {
                const StepIcon = STEP_ICONS[i]
                const done   = i < currentIdx
                const active = i === currentIdx
                return (
                  <div key={s} className="flex-1 flex flex-col items-center gap-2 relative z-10">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg
                      ${active  ? 'bg-gradient-to-br from-violet-500 to-violet-600 border-2 border-violet-300/60 scale-110 shadow-violet-500/40'
                      : done   ? 'bg-violet-500/70 border border-violet-400/50'
                      : 'border-2 border-white/15'}`}
                      style={active ? {} : done ? {} : { background: 'rgba(255,255,255,0.07)' }}>
                      {done ? <CheckCircle size={16} className="text-white" />
                        : <StepIcon size={15} className={active ? 'text-white' : 'text-white/30'} />}
                    </div>
                    <span className={`text-[10px] font-bold tracking-wide ${active ? 'text-white' : done ? 'text-violet-300/80' : 'text-white/30'}`}>
                      {statusLabels[s].split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* ── Action buttons ── */}
            {repair.status !== 'DELIVERED' && repair.status !== 'CANCELLED' && (
              <div className="mt-5 space-y-3">
                <div className="flex gap-2.5">
                  {repair.status === 'READY' ? (
                    <button onClick={() => setShowPayment(v => !v)} disabled={collecting}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg"
                      style={{ background: showPayment ? 'rgba(255,255,255,0.12)' : 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: showPayment ? 'none' : '0 4px 20px rgba(22,163,74,0.45)', border: showPayment ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(134,239,172,0.25)' }}>
                      <DollarSign size={15} />
                      {showPayment ? 'Hide Payment' : 'Collect Payment'}
                    </button>
                  ) : nextStatus ? (
                    <button onClick={handleNext} disabled={changingStatus}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)' }}>
                      {changingStatus ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                      Move to {statusLabels[nextStatus]}
                    </button>
                  ) : null}
                  <button onClick={handleCancel} disabled={changingStatus}
                    className="px-5 py-3 rounded-2xl text-sm font-bold text-red-300 hover:text-red-200 transition-all disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    Cancel
                  </button>
                </div>

                {/* ── Payment panel ── */}
                {showPayment && repair.status === 'READY' && (
                  <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(134,239,172,0.2)' }}>
                    {/* Breakdown */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">Service Fee</span>
                        <span className="font-semibold text-white">{formatCurrency(repair.estimatedCost ?? 0)}</span>
                      </div>
                      {partsTotal > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-white/60">Spare Parts ({repair.spareParts?.length})</span>
                          <span className="font-semibold text-white">{formatCurrency(partsTotal)}</span>
                        </div>
                      )}
                      <div className="h-px my-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-white">Subtotal</span>
                        <span className="font-black text-white">{formatCurrency(subtotal)}</span>
                      </div>
                    </div>
                    {/* Discount */}
                    <div>
                      <label className="block text-[11px] font-bold text-white/50 mb-1.5">Discount Amount</label>
                      <input type="number" min={0} max={subtotal} value={discount} onChange={e => setDiscount(e.target.value)}
                        placeholder="0" className="w-full px-3 py-2 rounded-xl text-sm text-white font-semibold outline-none"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }} />
                    </div>
                    {/* Final amount */}
                    {discountAmt > 0 && (
                      <div className="flex justify-between items-center px-3 py-2.5 rounded-xl" style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(134,239,172,0.25)' }}>
                        <span className="text-xs font-bold text-green-300">Final Amount</span>
                        <span className="text-lg font-black text-green-300">{formatCurrency(finalAmount)}</span>
                      </div>
                    )}
                    {/* Payment method */}
                    <div>
                      <p className="text-[11px] font-bold text-white/50 mb-1.5">Payment Method</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['CASH','CARD','UPI','BANK_TRANSFER'] as const).map(m => (
                          <button key={m} type="button" onClick={() => setPayMethod(m)}
                            className={`py-2 rounded-xl text-[11px] font-bold transition-all border ${
                              payMethod === m
                                ? 'bg-green-500/20 border-green-400/40 text-green-300'
                                : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                            }`}>
                            {m === 'BANK_TRANSFER' ? 'Bank' : m === 'UPI' ? 'UPI' : m.charAt(0)+m.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Confirm button */}
                    <button onClick={handleCollectPayment} disabled={collecting}
                      className="w-full py-3 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 16px rgba(22,163,74,0.4)' }}>
                      {collecting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                      {collecting ? 'Processing…' : `Confirm & Collect ${formatCurrency(finalAmount)}`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ══ BODY ══ */}
        <div className="p-5 space-y-3">

          {/* Device + Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4 space-y-2.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-violet-500/15"><Smartphone size={13} className="text-violet-500" /></div>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Device</span>
              </div>
              <div>
                <p className="text-sm font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{repair.deviceBrand} {repair.deviceModel}</p>
                {(repair as any).deviceColor && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{(repair as any).deviceColor}</p>}
                {repair.imei && (
                  <p className="text-[10px] font-mono mt-2 px-2.5 py-1 rounded-lg inline-block" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                    {repair.imei}
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-2xl p-4 space-y-2.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-cyan-500/15"><User size={13} className="text-cyan-500" /></div>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Customer</span>
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{repair.customerName}</p>
                <a href={`tel:${repair.customerPhone}`} className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-cyan-500 hover:text-cyan-400 transition-colors">
                  <PhoneCall size={11} />{repair.customerPhone}
                </a>
              </div>
            </div>
          </div>

          {/* Reported Issue */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-amber-500/15"><AlertTriangle size={13} className="text-amber-500" /></div>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Reported Issue</span>
            </div>
            <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--text-secondary)' }}>{repair.reportedIssue}</p>
          </div>

          {/* Financials */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="p-4 text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Service Fee</p>
                <p className="text-base font-black text-emerald-600">{repair.estimatedCost ? formatCurrency(repair.estimatedCost) : '—'}</p>
              </div>
              <div className="p-4 text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Parts Cost</p>
                <p className="text-base font-black text-orange-500">{partsTotal > 0 ? formatCurrency(partsTotal) : '—'}</p>
              </div>
              <div className="p-4 text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Technician</p>
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{repair.technicianName || '—'}</p>
              </div>
            </div>
            {/* Grand total row */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Amount</span>
                {repair.actualCost != null && repair.actualCost !== subtotal && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-violet-500/10 text-violet-600 border border-violet-500/20">Paid: {formatCurrency(repair.actualCost)}</span>
                )}
              </div>
              <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{formatCurrency(subtotal)}</p>
            </div>
          </div>

          {/* Spare Parts */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <Package size={14} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Spare Parts</p>
                  {repair.spareParts?.length > 0 && (
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{repair.spareParts.length} item{repair.spareParts.length > 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setShowAddPart(v => !v)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-xl font-bold transition-all"
                style={{ background: showAddPart ? 'rgba(239,68,68,0.08)' : 'linear-gradient(135deg,rgba(249,115,22,0.15),rgba(234,88,12,0.10))', color: showAddPart ? '#ef4444' : '#ea580c', border: `1px solid ${showAddPart ? 'rgba(239,68,68,0.25)' : 'rgba(249,115,22,0.30)'}` }}>
                {showAddPart ? <><X size={11} />Cancel</> : <><Plus size={11} />Add Part</>}
              </button>
            </div>

            {/* Add Part form */}
            {showAddPart && (
              <div className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <div className="relative">
                  <input className="input-field text-sm" placeholder="Search inventory by name or SKU…"
                    value={selProduct ? selProduct.name : partSearch}
                    onChange={e => { setPartSearch(e.target.value); setSelProduct(null) }} />
                  {filteredProducts.length > 0 && !selProduct && (
                    <div className="absolute z-10 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                      {filteredProducts.map((p: any) => (
                        <button key={p.id} type="button"
                          onClick={() => { setSelProduct(p); setPartSearch(''); setPartCost(String(p.buyingPrice ?? '')) }}
                          className="w-full text-left px-4 py-2.5 transition-colors"
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.sku ? `${p.sku} · ` : ''}Stock: {p.stock} · {formatCurrency(p.buyingPrice)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selProduct && (
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <div className="w-6 h-6 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0"><Package size={11} className="text-orange-500" /></div>
                    <span className="text-xs flex-1 truncate font-semibold text-orange-600">{selProduct.name}</span>
                    <button onClick={() => setSelProduct(null)} className="text-orange-400 hover:text-orange-600"><X size={11} /></button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>Quantity</label>
                    <input type="number" min={1} className="input-field" value={partQty} onChange={e => setPartQty(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>Unit Cost <span className="font-normal opacity-60">(optional)</span></label>
                    <input type="number" min={0} className="input-field"
                      placeholder={selProduct ? String(selProduct.buyingPrice ?? '') : '0'} value={partCost} onChange={e => setPartCost(e.target.value)} />
                  </div>
                </div>
                <button onClick={handleAddPart} disabled={!selProduct || addingPart}
                  className="w-full py-2.5 text-sm rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 2px 12px rgba(234,88,12,0.3)' }}>
                  {addingPart ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}Add to Repair
                </button>
              </div>
            )}

            {/* Parts table */}
            {repair.spareParts?.length > 0 ? (
              <div style={{ background: 'var(--bg-card)' }}>
                {/* Table header */}
                <div className="grid px-5 py-2" style={{ gridTemplateColumns: '1fr 60px 110px 36px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Part Name</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--text-muted)' }}>Qty</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-right" style={{ color: 'var(--text-muted)' }}>Amount</span>
                  <span />
                </div>
                {/* Rows */}
                {repair.spareParts.map((part: any, idx: number) => (
                  <div key={part.id} className="grid items-center px-5 py-3"
                    style={{ gridTemplateColumns: '1fr 60px 110px 36px', borderBottom: '1px solid var(--border-subtle)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.18)' }}>
                        <Package size={12} className="text-orange-500" />
                      </div>
                      <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{part.productName}</span>
                    </div>
                    <div className="text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                        {part.quantity}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-right" style={{ color: 'var(--text-primary)' }}>{formatCurrency(part.total)}</p>
                    <div className="flex justify-end">
                      <button onClick={() => handleRemovePart(part.id)} disabled={removingId === part.id}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; e.currentTarget.style.color = '#ef4444' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                        {removingId === part.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                      </button>
                    </div>
                  </div>
                ))}
                {/* Total row */}
                <div className="grid items-center px-5 py-3.5" style={{ gridTemplateColumns: '1fr 60px 110px 36px', background: 'linear-gradient(135deg,rgba(249,115,22,0.06),rgba(234,88,12,0.03))', borderTop: '2px solid rgba(249,115,22,0.2)' }}>
                  <span className="text-xs font-black uppercase tracking-wide text-orange-600 col-span-2">Total Parts Cost</span>
                  <p className="text-base font-black text-right text-orange-600">{formatCurrency(partsTotal)}</p>
                  <span />
                </div>
              </div>
            ) : !showAddPart && (
              <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ background: 'var(--bg-card)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                  <Package size={20} className="opacity-30" style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>No spare parts added yet</p>
                <button onClick={() => setShowAddPart(true)} className="text-xs font-bold text-orange-500 hover:text-orange-400 transition-colors mt-0.5">+ Add first part</button>
              </div>
            )}
          </div>

          {/* Status History */}
          {repair.statusHistory?.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                <Clock size={12} className="text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Timeline</span>
              </div>
              <div className="p-4 space-y-2" style={{ background: 'var(--bg-card)' }}>
                {repair.statusHistory.map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getRepairStatusColor(h.status)}`}>{statusLabels[h.status] ?? h.status}</span>
                    <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{h.changedBy}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(h.changedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
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
