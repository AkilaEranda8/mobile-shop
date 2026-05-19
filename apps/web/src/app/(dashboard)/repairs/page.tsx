'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Clock, CheckCircle, PhoneCall, Loader2, X, Check, ChevronDown,
  Eye, Edit, ChevronRight, Smartphone, User, Wrench, DollarSign, AlertTriangle,
  Calendar, Hash, Save, ArrowRight, MessageSquare, Package, Search, UserPlus, CheckCircle2, Download, Printer,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { formatCurrency, formatDate, getRepairStatusColor } from '@/lib/utils'
import { useRepairs, useProducts } from '@/lib/hooks'
import { repairsApi, customersApi, deviceCatalogApi, usersApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { getInvoiceSettings, type InvoiceSettings } from '@/lib/invoiceSettings'
import InvoicePrint, { type InvoiceData } from '@/components/invoice/InvoicePrint'
import type { Customer } from '@/types'
import toast from 'react-hot-toast'
import type { RepairTicket } from '@/types'

/* ── Thermal Receipt Printer ─────────────────────────────────────── */
function printRepairReceipt(repair: RepairTicket, settings: InvoiceSettings) {
  const paperWidth = settings.thermalWidthRepair || '80mm'
  const bodyWidth  = paperWidth === '58mm' ? '216px' : '302px'
  const fmt = (n: number) => `LKR ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
  const partsTotal = repair.spareParts?.reduce((s: any, p: any) => s + p.total, 0) ?? 0
  const subtotal = (repair.estimatedCost ?? 0) + partsTotal
  const partsRows = (repair.spareParts ?? []).map((p: any) => `
    <tr><td>${p.productName}</td><td style="text-align:right">${p.quantity}x</td><td style="text-align:right">${fmt(p.total)}</td></tr>`).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Repair Receipt</title>
<style>
  @page { size: ${paperWidth} auto; margin: 4mm 3mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color:#000; width:${bodyWidth}; }
  .center { text-align:center; }
  .bold { font-weight:bold; }
  .big { font-size:14px; font-weight:bold; }
  .med { font-size:12px; font-weight:bold; }
  .line { border-top:1px dashed #000; margin:4px 0; }
  .row { display:flex; justify-content:space-between; margin:1px 0; }
  table { width:100%; border-collapse:collapse; margin:3px 0; }
  td { padding:1px 2px; vertical-align:top; font-size:10px; }
  td:last-child { text-align:right; white-space:nowrap; }
  .total-row td { font-weight:bold; font-size:12px; border-top:1px solid #000; padding-top:3px; }
  .status { display:inline-block; border:1px solid #000; padding:1px 6px; font-size:10px; }
</style></head><body>
<div class="center"><div class="big">${settings.shopName || 'Service Center'}</div>
${settings.phone ? `<div>${settings.phone}</div>` : ''}
${settings.address ? `<div>${settings.address}</div>` : ''}</div>
<div class="line"></div>
<div class="center bold" style="font-size:13px;">REPAIR JOB RECEIPT</div>
<div class="line"></div>
<div class="row"><span class="bold">Ticket#:</span><span class="bold" style="font-size:12px;">${repair.ticketNumber}</span></div>
<div class="row"><span>Date:</span><span>${new Date(repair.createdAt).toLocaleDateString('en-LK')}</span></div>
<div class="row"><span>Status:</span><span class="status">${repair.status}</span></div>
<div class="line"></div>
<div class="bold med">CUSTOMER</div>
<div class="row"><span>Name:</span><span>${repair.customerName}</span></div>
<div class="row"><span>Phone:</span><span>${repair.customerPhone}</span></div>
<div class="line"></div>
<div class="bold med">DEVICE</div>
<div class="row"><span>Brand/Model:</span><span>${repair.deviceBrand} ${repair.deviceModel}</span></div>
${repair.imei ? `<div class="row"><span>IMEI:</span><span>${repair.imei}</span></div>` : ''}
${repair.accessories ? `<div class="row"><span>Accessories:</span><span>${repair.accessories}</span></div>` : ''}
<div class="line"></div>
<div class="bold med">FAULT</div>
<div style="word-break:break-word;margin:2px 0;">${repair.reportedIssue}</div>
<div class="line"></div>
<div class="bold med">CHARGES</div>
<table><tbody>
  <tr><td>Service Charge</td><td></td><td>${fmt(repair.estimatedCost ?? 0)}</td></tr>
  ${partsRows}
  <tr class="total-row"><td colspan="2">TOTAL</td><td>${fmt(subtotal)}</td></tr>
</tbody></table>
${repair.technicianName ? `<div class="line"></div><div class="row"><span>Technician:</span><span>${repair.technicianName}</span></div>` : ''}
<div class="line"></div>
<div class="center" style="font-size:10px;margin-top:4px;">Thank you for choosing us!</div>
<div class="center" style="font-size:9px;margin-top:2px;">${settings.website || ''}</div>
</body></html>`
  const w = window.open('', '_blank', 'width=350,height=600')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
}

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
    deviceBrand: '', deviceModel: '', imei: '',
    priority: 'NORMAL', estimatedCost: '',
    technicianId: '', technicianName: '',
    source: 'WALK_IN',
  })
  const [accessories, setAccessories] = useState<string[]>([])
  const [accOpen, setAccOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueQuery, setIssueQuery] = useState('')
  const [selectedIssues, setSelectedIssues] = useState<string[]>([])
  const FAULT_OPTIONS = [
    'DISPLAY CHANGE','DISPLAY FIXING ONLY','PIN REPLACEMENT','BATTERY SHORT FIX',
    'KEYBOARD ISSUE','TOUCH CHANGE','REPAIR SERVICE','CAMERA GLASS CHANGE',
    'TEMPERED GLASS','GREEN SCREEN','HOUSING REPLACEMENT','ON OFF FLEX',
    'NO SERVICE','PHONE FIXING','FRP','BACK GLASS','UNLOCKING','MAIN FLEX',
    'AUDIO IC','GLUE FIX','SOFTWARE','WATER DAMAGE','BOARD REPAIR','BATTERY CHANGE',
    'FLEX BONDING','MIC REPLACEMENT','MICRO CHARGING PIN REPLACEMENT','FINGER',
    'RINGER','ANTENNA CABLE','WHITE SCREEN',
  ]
  const filteredFaults = issueQuery.trim()
    ? FAULT_OPTIONS.filter(o => o.toLowerCase().includes(issueQuery.toLowerCase()))
    : FAULT_OPTIONS
  const toggleIssue = (v: string) => setSelectedIssues(p =>
    p.includes(v) ? p.filter(x => x !== v) : [...p, v]
  )
  const ACCESSORY_OPTIONS = ['Phone Only','Charger','Box','SIM','Memory Card','Back Cover','Battery','Stylus','Earphones'] as const
  const toggleAccessory = (a: string) => setAccessories(prev =>
    prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  // ── technician staff state ──
  const [technicians, setTechnicians] = useState<any[]>([])
  const [techOpen, setTechOpen]       = useState(false)
  const [techQuery, setTechQuery]     = useState('')

  useEffect(() => {
    usersApi.list({ role: 'TECHNICIAN', limit: '100' }).then((res: any) => {
      const list = res.data?.data ?? res.data ?? res ?? []
      setTechnicians(list)
    }).catch(() => {})
  }, [])

  const filteredTechs = techQuery.trim().length > 0
    ? technicians.filter(t => t.name.toLowerCase().includes(techQuery.toLowerCase()))
    : technicians

  const selectTech = (t: any) => {
    setForm(p => ({ ...p, technicianId: t.id, technicianName: t.name }))
    setTechQuery(t.name); setTechOpen(false)
  }

  // ── device catalog state ──
  const [brands, setBrands]       = useState<any[]>([])
  const [models, setModels]       = useState<any[]>([])
  const [brandOpen, setBrandOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [brandQuery, setBrandQuery] = useState('')
  const [modelQuery, setModelQuery] = useState('')

  useEffect(() => {
    deviceCatalogApi.listBrands().then((res: any) => setBrands(res.data ?? res)).catch(() => {})
  }, [])

  const selectBrand = (b: any) => {
    setForm(p => ({ ...p, deviceBrand: b.name, deviceModel: '' }))
    setBrandQuery(b.name); setBrandOpen(false); setModelQuery('')
    setModels(b.models ?? [])
  }
  const selectModel = (m: any) => {
    setForm(p => ({ ...p, deviceModel: m.name }))
    setModelQuery(m.name); setModelOpen(false)
  }

  const filteredBrands = brandQuery.length > 0
    ? brands.filter(b => b.name.toLowerCase().includes(brandQuery.toLowerCase()))
    : brands
  const filteredModels = modelQuery.length > 0
    ? models.filter(m => m.name.toLowerCase().includes(modelQuery.toLowerCase()))
    : models

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
        reportedIssue: selectedIssues.join(', '),
        accessories:   accessories.length > 0 ? accessories.join(', ') : undefined,
        branchId: user?.branchIds?.[0],
        createdBy: user?.name || 'Staff',
      })
      onSaved(); onClose()
    } catch (err: any) { setError(err.message || 'Failed to create ticket') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
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
            {/* Brand dropdown */}
            <div className="relative">
              <label className="block text-xs text-slate-400 mb-1.5">Device Brand *</label>
              <div className="relative">
                <Smartphone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input required className="input-field pl-8" placeholder="Select or type brand"
                  value={brandQuery}
                  onChange={e => { setBrandQuery(e.target.value); setForm(p => ({ ...p, deviceBrand: e.target.value, deviceModel: '' })); setModelQuery(''); setModels([]); setBrandOpen(true) }}
                  onFocus={() => setBrandOpen(true)}
                  onBlur={() => setTimeout(() => setBrandOpen(false), 150)}
                />
              </div>
              {brandOpen && filteredBrands.length > 0 && (
                <div className="absolute z-30 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  {filteredBrands.map(b => (
                    <button key={b.id} type="button" onMouseDown={() => selectBrand(b)}
                      className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-violet-500/10 transition-colors"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <Smartphone size={11} className="text-violet-400 shrink-0" />
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{b.name}</span>
                      <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{b.models?.length ?? 0} models</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Model dropdown */}
            <div className="relative">
              <label className="block text-xs text-slate-400 mb-1.5">Device Model *</label>
              <div className="relative">
                <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input required className="input-field pl-8"
                  placeholder={models.length > 0 ? `Select ${form.deviceBrand} model` : 'Select brand first'}
                  value={modelQuery}
                  onChange={e => { setModelQuery(e.target.value); setForm(p => ({ ...p, deviceModel: e.target.value })); setModelOpen(true) }}
                  onFocus={() => models.length > 0 && setModelOpen(true)}
                  onBlur={() => setTimeout(() => setModelOpen(false), 150)}
                  disabled={models.length === 0 && !form.deviceBrand}
                />
              </div>
              {modelOpen && filteredModels.length > 0 && (
                <div className="absolute z-30 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  {filteredModels.map(m => (
                    <button key={m.id} type="button" onMouseDown={() => selectModel(m)}
                      className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-violet-500/10 transition-colors"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-2 relative">
              <label className="block text-xs text-slate-400 mb-1.5">Accessories Received</label>
              <button type="button" onClick={() => setAccOpen(o => !o)}
                className="input-field w-full flex items-center justify-between text-left"
                style={{ minHeight: 38 }}>
                <span className={accessories.length === 0 ? 'text-slate-500 text-sm' : 'text-sm'}
                  style={{ color: accessories.length === 0 ? undefined : 'var(--text-primary)' }}>
                  {accessories.length === 0 ? 'Select accessories…' : accessories.join(', ')}
                </span>
                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${accOpen ? 'rotate-180' : ''}`} />
              </button>
              {accOpen && (
                <div className="absolute z-30 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  {ACCESSORY_OPTIONS.map(a => (
                    <button key={a} type="button"
                      onMouseDown={e => { e.preventDefault(); toggleAccessory(a) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-500/10 transition-colors text-left"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                        accessories.includes(a)
                          ? 'bg-violet-500 border-violet-500'
                          : 'border-slate-600'
                      }`}>
                        {accessories.includes(a) && <Check size={10} className="text-white" />}
                      </div>
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{a}</span>
                    </button>
                  ))}
                  {accessories.length > 0 && (
                    <button type="button" onMouseDown={e => { e.preventDefault(); setAccessories([]) }}
                      className="w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors text-left">
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Technician dropdown */}
            <div className="relative">
              <label className="block text-xs text-slate-400 mb-1.5">Technician</label>
              <div className="relative">
                <Wrench size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input className="input-field pl-8"
                  placeholder={technicians.length === 0 ? 'No technicians found' : 'Select technician…'}
                  value={techQuery}
                  onChange={e => { setTechQuery(e.target.value); setForm(p => ({ ...p, technicianId: '', technicianName: e.target.value })); setTechOpen(true) }}
                  onFocus={() => setTechOpen(true)}
                  onBlur={() => setTimeout(() => setTechOpen(false), 150)}
                />
                {techQuery && (
                  <button type="button" onClick={() => { setTechQuery(''); setForm(p => ({ ...p, technicianId: '', technicianName: '' })) }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    <X size={11} />
                  </button>
                )}
              </div>
              {techOpen && filteredTechs.length > 0 && (
                <div className="absolute z-30 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  {filteredTechs.map((t: any) => (
                    <button key={t.id} type="button" onMouseDown={() => selectTech(t)}
                      className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-violet-500/10 transition-colors"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-[11px] font-bold text-violet-300 shrink-0">
                        {t.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.email}</p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">TECH</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">IMEI</label>
              <input className="input-field font-mono" placeholder="Enter 15-digit IMEI (optional)" maxLength={17} value={form.imei} onChange={f('imei')} />
            </div>
            <div className="col-span-2" /></div>

          {/* ── Fault / Issue section ── */}
          <div className="rounded-xl overflow-visible" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Fault / Issue</span>
              {selectedIssues.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25 font-medium">
                  {selectedIssues.length} selected
                </span>
              )}
            </div>
            <div className="px-4 pb-4 relative">
              <button type="button" onClick={() => setIssueOpen(o => !o)}
                className="input-field w-full flex items-center justify-between text-left"
                style={{ minHeight: 38 }}>
                <span className={selectedIssues.length === 0 ? 'text-slate-500 text-sm truncate pr-2' : 'text-sm truncate pr-2'}
                  style={{ color: selectedIssues.length === 0 ? undefined : 'var(--text-primary)' }}>
                  {selectedIssues.length === 0 ? 'Select fault / issue…' : selectedIssues.join(', ')}
                </span>
                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${issueOpen ? 'rotate-180' : ''}`} />
              </button>
              {issueOpen && (
                <div className="absolute z-30 top-full mt-1 left-4 right-4 rounded-xl shadow-2xl overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  <div className="p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <input autoFocus className="input-field text-sm py-1.5" placeholder="Search faults…"
                      value={issueQuery}
                      onChange={e => setIssueQuery(e.target.value)}
                      onMouseDown={e => e.stopPropagation()} />
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
                    {filteredFaults.map(fault => (
                      <button key={fault} type="button"
                        onMouseDown={e => { e.preventDefault(); toggleIssue(fault) }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-500/10 transition-colors text-left"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                          selectedIssues.includes(fault) ? 'bg-violet-500 border-violet-500' : 'border-slate-600'
                        }`}>
                          {selectedIssues.includes(fault) && <Check size={10} className="text-white" />}
                        </div>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{fault}</span>
                      </button>
                    ))}
                    {filteredFaults.length === 0 && (
                      <p className="px-4 py-3 text-xs text-slate-500">No faults found</p>
                    )}
                  </div>
                  {selectedIssues.length > 0 && (
                    <button type="button" onMouseDown={e => { e.preventDefault(); setSelectedIssues([]) }}
                      className="w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors text-left border-t"
                      style={{ borderColor: 'var(--border-subtle)' }}>
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Other details grid ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 relative">
              <label className="block text-xs text-slate-400 mb-1.5">Customer Source</label>
              <button type="button" onClick={() => setSourceOpen(o => !o)}
                className="input-field w-full flex items-center justify-between text-left"
                style={{ minHeight: 38 }}>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {SOURCE_OPTIONS.find(o => o.value === form.source)?.label ?? 'Select source'}
                </span>
                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${sourceOpen ? 'rotate-180' : ''}`} />
              </button>
              {sourceOpen && (
                <div className="absolute z-30 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                  {SOURCE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onMouseDown={e => { e.preventDefault(); setForm(p => ({ ...p, source: opt.value })); setSourceOpen(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-500/10 transition-colors text-left"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div className={`w-3.5 h-3.5 rounded-full shrink-0 border-2 ${
                        form.source === opt.value ? 'border-violet-500 bg-violet-500' : 'border-slate-600'
                      }`} />
                      <span className={`text-sm ${form.source === opt.value ? opt.color : ''}`}
                        style={{ color: form.source === opt.value ? undefined : 'var(--text-primary)' }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
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
  const quoteRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [invSettings] = useState<InvoiceSettings>(() => getInvoiceSettings())

  const sendQuoteWhatsApp = () => {
    const partsTotal = repair.spareParts?.reduce((s: any, p: any) => s + p.total, 0) ?? 0
    const grandTotal = (repair.estimatedCost ?? 0) + partsTotal
    const fmt = (n: number) => `LKR ${n.toLocaleString('en-LK')}`
    const partsLines = (repair.spareParts ?? []).length > 0
      ? `\n\n*Parts:*\n` + repair.spareParts!.map((p: any) => `  - ${p.productName} x${p.quantity} - ${fmt(p.total)}`).join('\n')
      : ''
    const msg = [
      `*Repair Quote — ${invSettings.shopName || 'Service Center'}*`,
      ``,
      `*Ticket:* ${repair.ticketNumber}`,
      `*Customer:* ${repair.customerName}`,
      `*Device:* ${repair.deviceBrand} ${repair.deviceModel}`,
      repair.imei ? `*IMEI:* ${repair.imei}` : null,
      ``,
      `*Issue:* ${repair.reportedIssue}`,
      ``,
      `*Service Charge:* ${fmt(repair.estimatedCost ?? 0)}` + partsLines,
      ``,
      `*Total Estimate:* *${fmt(grandTotal)}*`,
      repair.technicianName ? `*Technician:* ${repair.technicianName}` : null,
      ``,
      `_For any queries, please contact us._`,
      invSettings.phone ? `Tel: ${invSettings.phone}` : null,
    ].filter(Boolean).join('\n')
    const phone = repair.customerPhone?.replace(/\D/g, '')
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const sendInvoiceWhatsApp = () => {
    const fmt = (n: number) => `LKR ${n.toLocaleString('en-LK')}`
    const partsTotal = repair.spareParts?.reduce((s: any, p: any) => s + p.total, 0) ?? 0
    const subtotal   = (repair.estimatedCost ?? 0) + partsTotal
    const discount   = repair.actualCost != null && repair.actualCost < subtotal ? subtotal - repair.actualCost : 0
    const grandTotal = discount > 0 ? repair.actualCost! : subtotal

    const itemLines = [
      repair.estimatedCost
        ? `  - Repair Service (${repair.deviceBrand} ${repair.deviceModel}): ${fmt(repair.estimatedCost)}`
        : null,
      ...(repair.spareParts ?? []).map((p: any) =>
        `  - ${p.productName} x${p.quantity}: ${fmt(p.total)}`),
    ].filter(Boolean).join('\n')

    const bankSection = invSettings.bankName
      ? `\n\n*Payment Details:*\n  Bank: ${invSettings.bankName}\n  Acc: ${invSettings.accNumber || '—'}\n  Name: ${invSettings.accHolder || '—'}`
      : ''

    const msg = [
      `*INVOICE — ${invSettings.shopName || 'Service Center'}*`,
      invSettings.phone ? `Tel: ${invSettings.phone}` : null,
      ``,
      `*Invoice No:* ${repair.ticketNumber}`,
      `*Customer:* ${repair.customerName}`,
      repair.customerPhone ? `*Phone:* ${repair.customerPhone}` : null,
      ``,
      `*Items:*`,
      itemLines,
      ``,
      discount > 0 ? `*Subtotal:* ${fmt(subtotal)}` : null,
      discount > 0 ? `*Discount:* -${fmt(discount)}` : null,
      `*Total: ${fmt(grandTotal)}*`,
      bankSection,
      ``,
      ...(invSettings.terms?.length ? invSettings.terms.map((t: string) => `_${t}_`) : [`_Thank you for choosing our repair services!_`]),
    ].filter(v => v !== null && v !== undefined).join('\n')

    const phone = repair.customerPhone?.replace(/\D/g, '')
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const downloadQuote = async () => {
    if (!quoteRef.current) return
    setDownloading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { jsPDF } = await import('jspdf')
      const A4_W_PX = 794, A4_W_MM = 210, A4_H_MM = 297
      const wrapper = document.createElement('div')
      wrapper.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${A4_W_PX}px;overflow:visible;`
      const clone = quoteRef.current!.cloneNode(true) as HTMLElement
      clone.style.width        = `${A4_W_PX}px`
      clone.style.maxWidth     = `${A4_W_PX}px`
      clone.style.minWidth     = `${A4_W_PX}px`
      clone.style.borderRadius = '0'
      clone.style.boxShadow    = 'none'
      clone.style.margin       = '0'
      wrapper.appendChild(clone)
      document.body.appendChild(wrapper)
      await new Promise(r => setTimeout(r, 100))
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, width: A4_W_PX, windowWidth: A4_W_PX })
      document.body.removeChild(wrapper)
      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const imgH_MM = (canvas.height / canvas.width) * A4_W_MM
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      if (imgH_MM <= A4_H_MM * 1.15) {
        /* content is ≤ 1 page (or only slightly over) — scale to fill exactly one A4 page */
        pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, Math.min(imgH_MM, A4_H_MM))
      } else {
        const scale = canvas.width / A4_W_MM
        let yMM = 0
        while (yMM < imgH_MM) {
          const sliceHMM = Math.min(A4_H_MM, imgH_MM - yMM)
          const tmp = document.createElement('canvas')
          tmp.width = canvas.width; tmp.height = Math.ceil(sliceHMM * scale)
          tmp.getContext('2d')!.drawImage(canvas, 0, yMM * scale, canvas.width, sliceHMM * scale, 0, 0, canvas.width, sliceHMM * scale)
          if (yMM > 0) pdf.addPage()
          pdf.addImage(tmp.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W_MM, sliceHMM)
          yMM += sliceHMM
        }
      }
      pdf.save(`Repair_${repair.ticketNumber}.pdf`)
      toast.success('Quote downloaded!')
    } catch { toast.error('Download failed') }
    finally { setDownloading(false) }
  }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* ══ HEADER ══ */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <Smartphone size={17} className="text-violet-500" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-violet-600 tracking-wider font-mono">{repair.ticketNumber}</p>
              <h3 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{repair.deviceBrand} {repair.deviceModel}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold ${getRepairStatusColor(repair.status)}`}>{statusLabels[repair.status]}</span>
            {repair.priority && repair.priority !== 'NORMAL' && (
              <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold ${priorityBadge(repair.priority)}`}>{repair.priority}</span>
            )}
            <button onClick={downloadQuote} disabled={downloading}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              {downloading ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
              {downloading ? 'Generating…' : 'PDF'}
            </button>
            <button onClick={sendQuoteWhatsApp}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
              <MessageSquare size={10} /> Quote
            </button>
            <button onClick={sendInvoiceWhatsApp}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-green-700 hover:bg-green-600 text-white transition-colors">
              <MessageSquare size={10} /> Invoice
            </button>
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              <Edit size={12} />Edit
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10"
              style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── Info grid (invoice-style) ── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'DATE',       value: formatDate(repair.createdAt) },
              { label: 'TECHNICIAN', value: repair.technicianName || '—' },
              { label: 'TICKET #',   value: repair.ticketNumber },
              { label: 'CUSTOMER',   value: repair.customerName },
              ...(repair.imei ? [{ label: 'IMEI', value: repair.imei }] : []),
              { label: 'SOURCE',     value: SOURCE_OPTIONS.find(o => o.value === repair.source)?.label ?? repair.source ?? 'Walk-in' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-3.5 space-y-1" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
              </div>
            ))}
            {repair.accessories && (
              <div className="col-span-2 rounded-xl p-3.5 space-y-1" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>ACCESSORIES RECEIVED</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {repair.accessories.split(', ').map((a: string) => (
                    <span key={a} className="px-2 py-0.5 rounded-md text-xs font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Progress stepper ── */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
            <div className="relative flex items-center">
              <div className="absolute left-5 right-5 top-5 h-[2px] rounded-full" style={{ background: 'var(--border-default)' }} />
              <div className="absolute left-5 top-5 h-[2px] rounded-full bg-violet-500 transition-all duration-500"
                style={{ width: currentIdx <= 0 ? '0%' : `${(currentIdx / (STATUS_FLOW.length - 1)) * 100}%` }} />
              {STATUS_FLOW.map((s, i) => {
                const StepIcon = STEP_ICONS[i]
                const done   = i < currentIdx
                const active = i === currentIdx
                return (
                  <div key={s} className="flex-1 flex flex-col items-center gap-1.5 relative z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border-2 ${
                      active ? 'bg-violet-600 border-violet-600 shadow-lg shadow-violet-500/30'
                      : done  ? 'bg-violet-500 border-violet-500'
                      : 'border-gray-300'}`}
                      style={!active && !done ? { background: 'var(--bg-card)' } : {}}>
                      {done   ? <CheckCircle size={16} className="text-white" />
                               : <StepIcon size={15} className={active ? 'text-white' : 'text-gray-400'} />}
                    </div>
                    <span className={`text-[10px] font-bold ${active ? 'text-violet-600' : done ? 'text-violet-400' : ''}`}
                      style={!active && !done ? { color: 'var(--text-muted)' } : {}}>
                      {statusLabels[s]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Action buttons ── */}
          {repair.status !== 'DELIVERED' && repair.status !== 'CANCELLED' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {repair.status === 'READY' ? (
                  <button onClick={() => setShowPayment(v => !v)} disabled={collecting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                    style={{ background: showPayment ? 'var(--bg-subtle)' : 'linear-gradient(135deg,#16a34a,#15803d)', border: showPayment ? '1px solid var(--border-default)' : 'none', color: showPayment ? 'var(--text-secondary)' : 'white' }}>
                    <DollarSign size={14} />
                    {showPayment ? 'Hide Payment' : 'Collect Payment'}
                  </button>
                ) : nextStatus ? (
                  <button onClick={handleNext} disabled={changingStatus}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                    {changingStatus ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    Move to {statusLabels[nextStatus]}
                  </button>
                ) : null}
                <button onClick={handleCancel} disabled={changingStatus}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
                  style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
                  Cancel
                </button>
              </div>

              {/* Payment panel */}
              {showPayment && repair.status === 'READY' && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                    <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Collect Payment</p>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Breakdown */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--text-secondary)' }}>Service Fee</span>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(repair.estimatedCost ?? 0)}</span>
                      </div>
                      {partsTotal > 0 && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color: 'var(--text-secondary)' }}>Spare Parts ({repair.spareParts?.length})</span>
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(partsTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(subtotal)}</span>
                      </div>
                    </div>
                    {/* Discount */}
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>Discount Amount</label>
                      <input type="number" min={0} max={subtotal} value={discount} onChange={e => setDiscount(e.target.value)}
                        placeholder="0" className="input-field" />
                    </div>
                    {discountAmt > 0 && (
                      <div className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-green-500/8 border border-green-500/20">
                        <span className="text-sm font-bold text-green-600">Final Amount</span>
                        <span className="text-lg font-black text-green-600">{formatCurrency(finalAmount)}</span>
                      </div>
                    )}
                    {/* Payment method */}
                    <div>
                      <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Payment Method</p>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { key: 'CASH',          label: 'Cash'          },
                          { key: 'CARD',          label: 'Card'          },
                          { key: 'UPI',           label: 'UPI'           },
                          { key: 'BANK_TRANSFER', label: 'Bank Transfer' },
                        ] as const).map(({ key: m, label }) => (
                          <button key={m} type="button" onClick={() => setPayMethod(m)}
                            className="py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                            style={payMethod === m
                              ? { background: '#7c3aed', border: '2px solid #7c3aed', color: '#fff' }
                              : { background: 'var(--bg-subtle)', border: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                            <span>{label}</span>
                            {payMethod === m && <CheckCircle size={11} className="ml-auto opacity-90" />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={handleCollectPayment} disabled={collecting}
                      className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                      {collecting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      {collecting ? 'Processing…' : `Confirm & Collect ${formatCurrency(finalAmount)}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Reported Issue ── */}
          <div className="rounded-xl p-4 space-y-1.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Reported Issue</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{repair.reportedIssue}</p>
          </div>

          {/* ── Items ── */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Items ({(repair.spareParts?.length ?? 0) + (repair.estimatedCost ? 1 : 0)})
              </p>
              <button onClick={() => setShowAddPart(v => !v)}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors"
                style={{ background: showAddPart ? 'rgba(239,68,68,0.08)' : 'var(--bg-card)', border: '1px solid var(--border-default)', color: showAddPart ? '#ef4444' : 'var(--text-secondary)' }}>
                {showAddPart ? <><X size={10} />Cancel</> : <><Plus size={10} />Add Part</>}
              </button>
            </div>

            {/* Add Part form */}
            {showAddPart && (
              <div className="px-4 py-3 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <div className="relative">
                  <input className="input-field text-sm" placeholder="Search inventory by name or SKU…"
                    value={selProduct ? selProduct.name : partSearch}
                    onChange={e => { setPartSearch(e.target.value); setSelProduct(null) }} />
                  {filteredProducts.length > 0 && !selProduct && (
                    <div className="absolute z-10 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                      {filteredProducts.map((p: any) => (
                        <button key={p.id} type="button"
                          onClick={() => { setSelProduct(p); setPartSearch(''); setPartCost(String(p.sellingPrice ?? p.buyingPrice ?? '')) }}
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
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <Package size={11} className="text-violet-500 shrink-0" />
                    <span className="text-xs flex-1 truncate font-semibold" style={{ color: 'var(--text-primary)' }}>{selProduct.name}</span>
                    <button onClick={() => setSelProduct(null)} style={{ color: 'var(--text-muted)' }}><X size={11} /></button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Quantity</label>
                    <input type="number" min={1} className="input-field" value={partQty} onChange={e => setPartQty(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Unit Cost <span className="font-normal opacity-60">(optional)</span></label>
                    <input type="number" min={0} className="input-field"
                      placeholder={selProduct ? String(selProduct.buyingPrice ?? '') : '0'} value={partCost} onChange={e => setPartCost(e.target.value)} />
                  </div>
                </div>
                <button onClick={handleAddPart} disabled={!selProduct || addingPart}
                  className="w-full py-2 text-sm rounded-lg text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  style={{ background: '#7c3aed' }}>
                  {addingPart ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Add to Repair
                </button>
              </div>
            )}

            {/* Service fee line item */}
            {repair.estimatedCost != null && repair.estimatedCost > 0 && (
              <div className="flex items-center px-4 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Repair Service – {repair.deviceBrand} {repair.deviceModel}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{repair.ticketNumber}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(repair.estimatedCost)}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>1 × {formatCurrency(repair.estimatedCost)}</p>
                </div>
              </div>
            )}

            {/* Spare part rows */}
            {repair.spareParts?.length > 0 ? (
              repair.spareParts.map((part: any) => (
                <div key={part.id} className="flex items-center px-4 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{part.productName}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {part.quantity} × {formatCurrency(part.unitCost ?? part.total / part.quantity)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4 flex items-center gap-3">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(part.total)}</p>
                    <button onClick={() => handleRemovePart(part.id)} disabled={removingId === part.id}
                      className="w-6 h-6 rounded-md flex items-center justify-center transition-colors disabled:opacity-40 hover:bg-red-500/10 hover:text-red-500"
                      style={{ color: 'var(--text-muted)' }}>
                      {removingId === part.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                    </button>
                  </div>
                </div>
              ))
            ) : !showAddPart && repair.estimatedCost == null && (
              <div className="py-8 text-center">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No items yet</p>
                <button onClick={() => setShowAddPart(true)} className="text-xs font-bold text-violet-500 hover:text-violet-400 mt-1">+ Add spare part</button>
              </div>
            )}

            {/* Totals */}
            <div className="px-4 py-3 space-y-1.5" style={{ background: 'var(--bg-subtle)' }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(subtotal)}</span>
              </div>
              {repair.actualCost != null && repair.actualCost !== subtotal && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
                  <span className="text-red-500">– {formatCurrency(subtotal - repair.actualCost)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-primary)' }}>Total</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(repair.actualCost ?? subtotal)}</span>
              </div>
            </div>
          </div>

          {/* ── Status History ── */}
          {repair.statusHistory?.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="px-4 py-3" style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Timeline</p>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {repair.statusHistory.map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${getRepairStatusColor(h.status)}`}>{statusLabels[h.status] ?? h.status}</span>
                    <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{h.changedBy}</span>
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>{formatDate(h.changedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5"><Calendar size={11} />Created {formatDate(repair.createdAt)}</span>
            {repair.estimatedCompletion && <span className="flex items-center gap-1.5"><Calendar size={11} />Due {formatDate(repair.estimatedCompletion)}</span>}
          </div>

          {/* Hidden PDF template */}
          <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1, width: 794 }}>
            <InvoicePrint ref={quoteRef} hideControls data={{
              companyName:    invSettings.shopName || 'Our Shop',
              companySlogan:  invSettings.slogan   || 'Repair Services',
              companyLogo:    invSettings.logo,
              companyAddress: invSettings.address  || '',
              companyPhone:   invSettings.phone    || '',
              companyEmail:   invSettings.email    || '',
              companyWebsite: invSettings.website  || '',
              invoiceNumber:  repair.ticketNumber,
              dueDate: repair.estimatedCompletion
                ? new Date(repair.estimatedCompletion).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : new Date(repair.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
              customerName:    repair.customerName,
              customerEmail:   '',
              customerAddress: repair.customerPhone || '',
              items: [
                ...(repair.estimatedCost ? [{
                  description: `Repair Service – ${repair.deviceBrand} ${repair.deviceModel}`,
                  details: repair.reportedIssue || undefined,
                  price: repair.estimatedCost,
                  qty: 1,
                }] : []),
                ...(repair.spareParts?.map((p: any) => ({
                  description: p.productName,
                  details: 'Spare Part',
                  price: p.unitCost ?? (p.total / p.quantity),
                  qty: p.quantity,
                })) ?? []),
              ],
              bankName:  invSettings.bankName  || '',
              accNumber: invSettings.accNumber || '',
              accHolder: invSettings.accHolder || '',
              swiftCode: invSettings.swiftCode || '',
              taxRate:      0,
              discountRate: repair.actualCost != null && repair.actualCost < ((repair.estimatedCost ?? 0) + (repair.spareParts?.reduce((s: number, p: any) => s + p.total, 0) ?? 0))
                ? (( (repair.estimatedCost ?? 0) + (repair.spareParts?.reduce((s: number, p: any) => s + p.total, 0) ?? 0) - repair.actualCost) / ((repair.estimatedCost ?? 0) + (repair.spareParts?.reduce((s: number, p: any) => s + p.total, 0) ?? 0))) * 100
                : 0,
              terms:          invSettings.terms.length ? invSettings.terms : ['Thank you for choosing our repair services!'],
              signatoryName:  repair.technicianName || invSettings.signatoryName || '',
              signatoryTitle: invSettings.signatoryTitle || 'Authorised Signature',
              currency:       invSettings.currency || 'LKR',
            } satisfies InvoiceData} />
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
  const [search, setSearch] = useState('')
  const allRepairs: RepairTicket[] = (repairsData?.data ?? []) as RepairTicket[]
  const repairs = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return allRepairs
    return allRepairs.filter(r =>
      r.ticketNumber?.toLowerCase().includes(q) ||
      r.customerName?.toLowerCase().includes(q) ||
      r.customerPhone?.toLowerCase().includes(q) ||
      `${r.deviceBrand} ${r.deviceModel}`.toLowerCase().includes(q) ||
      r.reportedIssue?.toLowerCase().includes(q)
    )
  }, [allRepairs, search])

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await repairsApi.updateStatus(id, status)
      toast.success(`Status → ${statusLabels[status]}`)
      refetch()
      if (detailRepair?.id === id) {
        const res: any = await repairsApi.getById(id)
        setDetailRepair(res?.data ?? detailRepair)
      }
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
        <div className="flex items-center gap-1">
          <button
            onClick={() => printRepairReceipt(row.original, getInvoiceSettings())}
            title="Thermal Print"
            className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10"
          >
            <Printer size={13} />
          </button>
          <TableActionsRow
            showAction={{ action: () => setDetailRepair(row.original) }}
            editAction={{ action: () => setEditRepair(row.original) }}
          />
        </div>
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

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          className="input-field pl-8 text-sm h-9"
          placeholder="Search ticket, customer, phone, device…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <ClientSideTable
        data={repairs}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((repairs.length || 1) / 20)}
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

