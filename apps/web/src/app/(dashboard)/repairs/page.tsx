'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Plus, Clock, CheckCircle, PhoneCall, Loader2, X, Check, ChevronDown, ChevronLeft,
  Eye, Edit, ChevronRight, Smartphone, User, Wrench, DollarSign, AlertTriangle,
  Calendar, Hash, Save, ArrowRight, MessageSquare, Package, Search, UserPlus, CheckCircle2, Download, Printer,
  History, XCircle, AlertCircle, ArrowLeft, MoreVertical, Phone, Mail, MapPin,
  Shield, Upload, SlidersHorizontal, FileText, Pencil, Zap, ClipboardList, RefreshCw,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDate, getRepairStatusColor } from '@/lib/utils'
import { useRepairs, useProducts, useFeatureFlag } from '@/lib/hooks'
import { repairsApi, customersApi, deviceCatalogApi, usersApi, uploadApi } from '@/lib/api'
import { whatsappApi, formatWhatsAppPhone } from '@/lib/whatsapp-api'
import { captureElementAsPdfBase64 } from '@/lib/invoice-pdf'
import { authStorage } from '@/lib/auth'
import { getActiveBranchId } from '@/lib/active-branch'
import { getInvoiceSettings, fetchInvoiceSettings, resolveInvoiceTemplate, thermalLogoMaxHeight, thermalBodyFontWeight, type InvoiceSettings } from '@/lib/invoiceSettings'
import { buildRepairInvoiceSale, resolveRepairWarrantyMonths, REPAIR_WARRANTY_OPTIONS, repairWarrantyMonths } from '@/lib/repair-invoice.util'
import { normalizeRepairTicket, repairNextStatus, repairPartsLocked, repairPaymentSummary, repairProgressStep, repairStatusHistory, repairTicketEditable, REPAIR_PROGRESS_FLOW, REPAIR_SERVICE_ITEM_LABEL } from '@/lib/repair.util'
import { formatWarrantyPeriodLabel } from '@/components/pos/cart-rules'
import InvoiceA4View from '@/components/invoice/InvoiceA4View'
import EditRepairModal from '@/components/repairs/EditRepairModal'
import RepairDetailsModal from '@/components/repairs/RepairDetailsModal'
import type { Customer } from '@/types'
import toast from 'react-hot-toast'
import type { RepairTicket } from '@/types'

function calcRepairTotals(repair: Pick<RepairTicket, 'estimatedCost' | 'spareParts'>) {
  const partsTotal = (repair.spareParts ?? []).reduce(
    (sum, p) => sum + (Number((p as { total?: number }).total) || 0),
    0,
  )
  const estimatedCost = Number(repair.estimatedCost ?? 0) || 0
  const serviceFee = estimatedCost
  return { serviceFee, partsTotal, estimatedTotal: estimatedCost, subtotal: estimatedCost, estimatedCost }
}

/* Thermal Receipt Printer */
function printRepairReceipt(repair: RepairTicket, settings: InvoiceSettings) {
  const paperWidth = settings.thermalWidthRepair || '80mm'
  const bodyWidth  = paperWidth === '58mm' ? '216px' : '302px'
  const fmt = (n: number) => `LKR ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
  const { serviceFee, subtotal } = calcRepairTotals(repair)
  const partsRows = (repair.spareParts ?? []).length > 0
    ? `<div class="line"></div><div class="bold med">PARTS USED</div>${(repair.spareParts ?? []).map((p: any) => `<div class="row"><span>${p.productName}</span><span>x${p.quantity}</span></div>`).join('')}`
    : ''
  const warrantyMonths = resolveRepairWarrantyMonths(repair, settings)
  const warrantyLine = warrantyMonths > 0
    ? `<div class="row"><span>Warranty:</span><span>${warrantyMonths} month${warrantyMonths === 1 ? '' : 's'} on repair service</span></div>`
    : ''
  const logoHeight = thermalLogoMaxHeight(settings.thermalLogoSize)
  const bodyWeight = thermalBodyFontWeight(settings.thermalFontBold)
  const logoBlock = settings.thermalShowLogo !== false && settings.logo
    ? `<div class="center" style="margin-bottom:4px"><img src="${settings.logo}" alt="logo" style="max-height:${logoHeight}px;max-width:90%;object-fit:contain"/></div>`
    : ''
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Repair Receipt</title>
<style>
  @page { size: ${paperWidth} auto; margin: 4mm 3mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; font-weight: ${bodyWeight}; color:#000; width:${bodyWidth}; }
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
${logoBlock}
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
  <tr><td>${REPAIR_SERVICE_ITEM_LABEL}</td><td style="text-align:right">1</td><td style="text-align:right">${fmt(serviceFee)}</td></tr>
  <tr class="total-row"><td colspan="2">TOTAL</td><td>${fmt(subtotal)}</td></tr>
</tbody></table>
${partsRows}
${repair.technicianName ? `<div class="line"></div><div class="row"><span>Technician:</span><span>${repair.technicianName}</span></div>` : ''}
${warrantyLine}
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
  { value: 'WALK_IN',        label: 'Walk-in',        color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  { value: 'WARRANTY_CLAIM', label: 'Warranty Claim', color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/25'  },
  { value: 'WHATSAPP',       label: 'WhatsApp',       color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/25'   },
  { value: 'FACEBOOK',       label: 'Facebook',       color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25'    },
  { value: 'INSTAGRAM',      label: 'Instagram',      color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/25'    },
  { value: 'PHONE_CALL',     label: 'Phone Call',     color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25'   },
  { value: 'REFERRAL',       label: 'Referral',       color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/25'  },
  { value: 'ONLINE',         label: 'Online',         color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/25'    },
]

function NewTicketModal({ onClose, onSaved, prefill }: { onClose: () => void; onSaved: () => void; prefill?: { customerName?: string; customerPhone?: string; deviceBrand?: string; deviceModel?: string; imei?: string; warrantyClaimId?: string } }) {
  // customer search state
  const [customerMode, setCustomerMode] = useState<'search' | 'new'>('search')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [searching, setSearching]       = useState(false)
  const [showDrop, setShowDrop]         = useState(false)
  const [newCust, setNewCust]           = useState({ name: '', phone: '', email: '' })
  const [registeringCust, setRegisteringCust] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // ticket form state
  const [form, setForm] = useState({
    deviceBrand: prefill?.deviceBrand || '', deviceModel: prefill?.deviceModel || '', imei: prefill?.imei || '',
    priority: 'NORMAL', estimatedCost: '',
    technicianId: '', technicianName: '',
    source: prefill?.warrantyClaimId ? 'WARRANTY_CLAIM' : 'WALK_IN',
    estimatedCompletion: '',
  })
  const [accessories, setAccessories] = useState<string[]>([])
  const [accOpen, setAccOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueQuery, setIssueQuery] = useState('')
  const [selectedIssues, setSelectedIssues] = useState<string[]>([])
  const [tenantFaults, setTenantFaults] = useState<string[]>([])
  const FAULT_OPTIONS = [
    'DISPLAY CHANGE','DISPLAY FIXING ONLY','PIN REPLACEMENT','BATTERY SHORT FIX',
    'KEYBOARD ISSUE','TOUCH CHANGE','REPAIR SERVICE','CAMERA GLASS CHANGE',
    'TEMPERED GLASS','GREEN SCREEN','HOUSING REPLACEMENT','ON OFF FLEX',
    'NO SERVICE','PHONE FIXING','FRP','BACK GLASS','UNLOCKING','MAIN FLEX',
    'AUDIO IC','GLUE FIX','SOFTWARE','WATER DAMAGE','BOARD REPAIR','BATTERY CHANGE',
    'FLEX BONDING','MIC REPLACEMENT','MICRO CHARGING PIN REPLACEMENT','FINGER',
    'RINGER','ANTENNA CABLE','WHITE SCREEN',
  ]
  const normalizeFault = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase()
  const allFaultOptions = useMemo(() => {
    const uniq = new Set<string>()
    ;[...FAULT_OPTIONS, ...tenantFaults].forEach(f => {
      const n = normalizeFault(f)
      if (n) uniq.add(n)
    })
    return Array.from(uniq)
  }, [tenantFaults])
  const filteredFaults = issueQuery.trim()
    ? allFaultOptions.filter(o => o.toLowerCase().includes(issueQuery.toLowerCase()))
    : allFaultOptions
  const addCustomFault = async (raw: string) => {
    const f = normalizeFault(raw)
    if (!f) return
    try {
      await repairsApi.createFaultOption(f)
      setTenantFaults(prev => (prev.includes(f) ? prev : [...prev, f]))
    } catch {
      // ignore: fallback to local list if server rejects/duplicates
      setTenantFaults(prev => (prev.includes(f) ? prev : [...prev, f]))
    }
    setSelectedIssues(prev => (prev.includes(f) ? prev : [...prev, f]))
    setIssueQuery('')
    setIssueOpen(false)
  }
  const toggleIssue = (v: string) => setSelectedIssues(p =>
    p.includes(v) ? p.filter(x => x !== v) : [...p, v]
  )

  useEffect(() => {
    let alive = true
    repairsApi.faultOptions().then((res: any) => {
      if (!alive) return
      const rows = (res?.data?.data ?? res?.data ?? res ?? []) as Array<{ name?: string }>
      const names = rows.map(r => normalizeFault(r.name ?? '')).filter(Boolean)
      setTenantFaults(Array.from(new Set(names)))
    }).catch(() => {})
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const ACCESSORY_OPTIONS = ['Phone Only','Charger','Box','SIM','Memory Card','Back Cover','Battery','Stylus','Earphones'] as const
  const toggleAccessory = (a: string) => setAccessories(prev =>
    prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  // technician staff state
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

  // device catalog state
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

  // pre-fill from props
  useEffect(() => {
    if (prefill?.deviceBrand) setBrandQuery(prefill.deviceBrand)
    if (prefill?.deviceModel) setModelQuery(prefill.deviceModel)
    if (prefill?.customerName) setSearchQuery(prefill.customerName)

    const phone = prefill?.customerPhone?.trim()
    if (!phone) return
    let cancelled = false
    customersApi.search(phone).then((res: any) => {
      if (cancelled) return
      const list: Customer[] = res.data ?? res ?? []
      const match = list.find(c => c.phone === phone) ?? list[0]
      if (match) {
        setSelectedCustomer(match)
        setSearchQuery(match.name)
        setCustomerMode('search')
      } else if (prefill?.customerName) {
        setNewCust({ name: prefill.customerName, phone, email: '' })
        setCustomerMode('new')
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [prefill])

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
    if (!form.deviceBrand.trim() || !form.deviceModel.trim()) { setError('Please select a device brand and model'); return }
    if (selectedIssues.length === 0) { setError('Please select at least one issue'); return }
    setLoading(true); setError('')
    try {
      const user = authStorage.getUser()
      await repairsApi.create({
        ...form,
        customerId:    selectedCustomer?.id,
        customerName:  selectedCustomer?.name  ?? newCust.name,
        customerPhone: selectedCustomer?.phone ?? newCust.phone,
        estimatedCost: form.estimatedCost !== '' ? Number(form.estimatedCost) : 0,
        reportedIssue: selectedIssues.join(', '),
        accessories:   accessories.length > 0 ? accessories.join(', ') : undefined,
        branchId: getActiveBranchId(),
        createdBy: user?.name || 'Staff',
        warrantyClaimId: prefill?.warrantyClaimId,
      })
      onSaved(); onClose()
    } catch (err: any) { setError(err.message || 'Failed to create ticket') }
    finally { setLoading(false) }
  }

  const summaryRows = [
    { icon: User,          label: 'Customer',  value: selectedCustomer?.name ?? newCust.name },
    { icon: Phone,         label: 'Phone',     value: selectedCustomer?.phone ?? newCust.phone },
    { icon: Smartphone,    label: 'Device',    value: form.deviceBrand || form.deviceModel ? `${form.deviceBrand} ${form.deviceModel}`.trim() : '' },
    { icon: Hash,          label: 'IMEI',      value: form.imei },
    { icon: AlertTriangle, label: 'Issue',     value: selectedIssues.join(', ') },
    { icon: Wrench,        label: 'Technician',value: form.technicianName },
    { icon: Clock,         label: 'Priority',  value: form.priority },
    { icon: DollarSign,    label: 'Estimated Cost', value: form.estimatedCost ? formatCurrency(Number(form.estimatedCost)) : '' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-6xl max-h-[96vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-purple-600 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-20 flex-shrink-0" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
              <FileText size={16} className="text-violet-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>New Repair Ticket</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Customer → device → fault → review</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Body */}
          <div className="grid grid-cols-12 gap-6 p-8">

            {/* Left column — step content */}
            <div className="col-span-12 lg:col-span-8">

              {/* STEP 1 — Customer */}
              {(
                <div className="rounded-xl border overflow-visible" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                    <User size={18} className="text-violet-500" />
                    <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Customer Information</h4>
                  </div>
                  <div className="p-5 space-y-4">
                    {customerMode === 'search' ? (
                      selectedCustomer ? (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                          <div className="w-9 h-9 rounded-full bg-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-300 shrink-0">
                            {selectedCustomer.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{selectedCustomer.name}</p>
                            <p className="text-xs [color:var(--text-muted)]">{selectedCustomer.phone}</p>
                            <p className="text-[10px] text-violet-400 mt-0.5">{selectedCustomer.totalRepairs ?? 0} previous repairs</p>
                          </div>
                          <button type="button" onClick={clearCustomer} className="p-1.5 rounded-lg [color:var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <div className="relative flex-1" ref={dropRef}>
                            <div className="relative">
                              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 [color:var(--text-muted)]" />
                              {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 [color:var(--text-muted)] animate-spin" />}
                              <input
                                className="input-field pl-11 h-12"
                                placeholder="Search customer by name or phone number..."
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setSelectedCustomer(null) }}
                                onFocus={() => searchResults.length > 0 && setShowDrop(true)}
                                autoComplete="off"
                              />
                            </div>
                            {showDrop && (
                              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-2xl z-50 overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                                {searchResults.length > 0 ? (
                                  <>
                                    {searchResults.map(c => (
                                      <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-violet-500/10 transition-colors text-left">
                                        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
                                          {c.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                                        </div>
                                        <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>{c.totalRepairs ?? 0} repairs</span>
                                      </button>
                                    ))}
                                    <div className="border-t" style={{ borderColor: 'var(--border-subtle)' }} />
                                  </>
                                ) : (
                                  <p className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>No customers found</p>
                                )}
                                <button type="button" onClick={() => { setCustomerMode('new'); setShowDrop(false); setNewCust(p => ({ ...p, name: searchQuery })) }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-emerald-500/10 transition-colors text-left">
                                  <UserPlus size={13} className="text-emerald-400" />
                                  <span className="text-xs text-emerald-400">Register as new customer</span>
                                </button>
                              </div>
                            )}
                          </div>
                          <button type="button" onClick={() => { setCustomerMode('new'); clearCustomer() }}
                            className="h-12 px-4 rounded-xl border text-sm font-semibold flex items-center gap-2 text-violet-500 bg-violet-500/5 hover:bg-violet-500/10 transition-colors"
                            style={{ borderColor: 'var(--sidebar-active-border)' }}>
                            <Plus size={15} /> New Customer
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-5">
                          <div>
                            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Customer Name <span className="text-red-500">*</span></label>
                            <div className="relative">
                              <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 [color:var(--text-muted)]" />
                              <input required className="input-field pl-11 h-12" placeholder="Enter customer name" value={newCust.name}
                                onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Phone Number <span className="text-red-500">*</span></label>
                            <div className="relative">
                              <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 [color:var(--text-muted)]" />
                              <div className="absolute left-10 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                <span>ðŸ‡±ðŸ‡°</span><span>+94</span>
                              </div>
                              <input required className="input-field pl-24 pr-11 h-12" placeholder="Enter phone number" value={newCust.phone}
                                onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))} />
                              <MessageSquare size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Email <span style={{ color: 'var(--text-muted)' }}>(Optional)</span></label>
                            <div className="relative max-w-md">
                              <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 [color:var(--text-muted)]" />
                              <input className="input-field pl-11 h-12" placeholder="Enter email address" value={newCust.email}
                                onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))} />
                            </div>
                          </div>
                        </div>
                        <button type="button" onClick={registerNewCustomer} disabled={registeringCust || !newCust.name || !newCust.phone}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-all disabled:opacity-50">
                          {registeringCust ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          Register & Select Customer
                        </button>
                        <button type="button" onClick={() => setCustomerMode('search')} className="text-xs font-semibold text-violet-500">Search existing customer instead</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2 — Device */}
              {(
                <div className="rounded-xl border overflow-visible mt-6" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                    <Smartphone size={18} className="text-violet-500" />
                    <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Device Information</h4>
                  </div>
                  <div className="p-5 grid grid-cols-2 gap-5">
                    <div className="relative">
                      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Device Brand <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Smartphone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 [color:var(--text-muted)] pointer-events-none" />
                        <input required className="input-field pl-9 h-12" placeholder="Select brand"
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
                    <div className="relative">
                      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Device Model <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 [color:var(--text-muted)] pointer-events-none" />
                        <input required className="input-field pl-9 h-12" placeholder="Select model"
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
                    <div className="col-span-2">
                      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>IMEI <span style={{ color: 'var(--text-muted)' }}>(Optional)</span></label>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <Hash size={15} className="absolute left-4 top-1/2 -translate-y-1/2 [color:var(--text-muted)]" />
                          <input className="input-field pl-11 h-12 font-mono" placeholder="Enter 15-digit IMEI number" maxLength={17} value={form.imei} onChange={f('imei')} />
                        </div>
                        <button type="button" className="h-12 px-4 rounded-xl border text-sm font-semibold flex items-center gap-2 text-violet-500 bg-violet-500/5" style={{ borderColor: 'var(--sidebar-active-border)' }}>
                          <Hash size={16} /> Scan IMEI
                        </button>
                      </div>
                    </div>
                    <div className="col-span-2 relative">
                      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Accessories Received</label>
                      <button type="button" onClick={() => setAccOpen(o => !o)}
                        className="input-field w-full h-12 flex items-center justify-between text-left">
                        <span className={accessories.length === 0 ? '[color:var(--text-muted)] text-sm' : 'text-sm'}
                          style={{ color: accessories.length === 0 ? undefined : 'var(--text-primary)' }}>
                          {accessories.length === 0 ? 'Select accessories…' : accessories.join(', ')}
                        </span>
                        <ChevronDown size={14} className={`[color:var(--text-muted)] shrink-0 transition-transform ${accOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {accOpen && (
                        <div className="absolute z-30 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                          {ACCESSORY_OPTIONS.map(a => (
                            <button key={a} type="button"
                              onMouseDown={e => { e.preventDefault(); toggleAccessory(a) }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-500/10 transition-colors text-left"
                              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${accessories.includes(a) ? 'bg-violet-500 border-violet-500' : 'border-slate-600'}`}>
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
                  </div>
                </div>
              )}

              {/* STEP 3 — Issue */}
              {(
                <div className="rounded-xl border overflow-visible mt-6" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                    <AlertTriangle size={18} className="text-violet-500" />
                    <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Reported Issue / Fault</h4>
                  </div>
                  <div className="p-5 space-y-4 relative">
                    <div className="relative">
                      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Select Fault(s) <span className="text-red-500">*</span></label>
                      <button type="button" onClick={() => setIssueOpen(o => !o)}
                        className="input-field w-full h-12 flex items-center justify-between text-left">
                        <span className={selectedIssues.length === 0 ? '[color:var(--text-muted)] text-sm truncate pr-2' : 'text-sm truncate pr-2'}
                          style={{ color: selectedIssues.length === 0 ? undefined : 'var(--text-primary)' }}>
                          {selectedIssues.length === 0 ? 'Select fault / issue…' : selectedIssues.join(', ')}
                        </span>
                        <ChevronDown size={14} className={`[color:var(--text-muted)] shrink-0 transition-transform ${issueOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {issueOpen && (
                        <div className="absolute z-30 top-full mt-1 left-0 right-0 rounded-xl shadow-2xl overflow-hidden"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                          <div className="p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                            <input autoFocus className="input-field text-sm py-1.5" placeholder="Search faults…"
                              value={issueQuery}
                              onChange={e => setIssueQuery(e.target.value)}
                              onMouseDown={e => e.stopPropagation()} />
                          </div>
                          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
                            {issueQuery.trim() && !allFaultOptions.includes(normalizeFault(issueQuery)) && (
                              <button
                                type="button"
                                onMouseDown={e => { e.preventDefault(); void addCustomFault(issueQuery) }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-500/10 transition-colors text-left"
                                style={{ borderBottom: '1px solid var(--border-subtle)' }}
                              >
                                <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 border border-emerald-500/30 bg-emerald-500/10">
                                  <Plus size={10} className="text-emerald-400" />
                                </div>
                                <span className="text-sm text-emerald-400">
                                  Add new fault: <span className="font-semibold">{normalizeFault(issueQuery)}</span>
                                </span>
                              </button>
                            )}
                            {filteredFaults.map(fault => (
                              <button key={fault} type="button"
                                onMouseDown={e => { e.preventDefault(); toggleIssue(fault) }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-500/10 transition-colors text-left"
                                style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${selectedIssues.includes(fault) ? 'bg-violet-500 border-violet-500' : 'border-slate-600'}`}>
                                  {selectedIssues.includes(fault) && <Check size={10} className="text-white" />}
                                </div>
                                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{fault}</span>
                              </button>
                            ))}
                            {filteredFaults.length === 0 && !issueQuery.trim() && (
                              <p className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>No faults found</p>
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
                    {selectedIssues.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedIssues.map(issue => (
                          <span key={issue} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400">
                            {issue}
                            <button type="button" onClick={() => toggleIssue(issue)} className="hover:text-red-400 transition-colors"><X size={10} /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4 — Details */}
              {(
                <div className="rounded-xl border mt-6" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                    <Wrench size={18} className="text-violet-500" />
                    <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Job Details</h4>
                  </div>
                  <div className="p-5 grid grid-cols-2 gap-5">
                    <div className="relative">
                      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Technician</label>
                      <div className="relative">
                        <Wrench size={13} className="absolute left-3 top-1/2 -translate-y-1/2 [color:var(--text-muted)] pointer-events-none" />
                        <input className="input-field pl-9 h-12"
                          placeholder={technicians.length === 0 ? 'No technicians found' : 'Select technician…'}
                          value={techQuery}
                          onChange={e => { setTechQuery(e.target.value); setForm(p => ({ ...p, technicianId: '', technicianName: e.target.value })); setTechOpen(true) }}
                          onFocus={() => setTechOpen(true)}
                          onBlur={() => setTimeout(() => setTechOpen(false), 150)}
                        />
                        {techQuery && (
                          <button type="button" onClick={() => { setTechQuery(''); setForm(p => ({ ...p, technicianId: '', technicianName: '' })) }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 [color:var(--text-muted)] hover:[color:var(--text-secondary)]">
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
                    <div className="relative">
                      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Customer Source</label>
                      <button type="button" onClick={() => setSourceOpen(o => !o)}
                        className="input-field w-full h-12 flex items-center justify-between text-left">
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {SOURCE_OPTIONS.find(o => o.value === form.source)?.label ?? 'Select source'}
                        </span>
                        <ChevronDown size={14} className={`[color:var(--text-muted)] shrink-0 transition-transform ${sourceOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {sourceOpen && (
                        <div className="absolute z-30 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                          {SOURCE_OPTIONS.map(opt => (
                            <button key={opt.value} type="button"
                              onMouseDown={e => { e.preventDefault(); setForm(p => ({ ...p, source: opt.value })); setSourceOpen(false) }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-500/10 transition-colors text-left"
                              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <div className={`w-3.5 h-3.5 rounded-full shrink-0 border-2 ${form.source === opt.value ? 'border-violet-500 bg-violet-500' : 'border-slate-600'}`} />
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
                      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Priority</label>
                      <select className="input-field h-12" value={form.priority} onChange={f('priority')}>
                        <option value="LOW">Low</option>
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Estimated Cost (LKR) <span className="font-normal" style={{ color: 'var(--text-muted)' }}>— optional</span></label>
                      <input type="number" min="0" step="0.01" className="input-field h-12" placeholder="Set later in job details" value={form.estimatedCost} onChange={f('estimatedCost')} />
                      <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>Leave blank to set later in the repair details view. Parts are tracked separately.</p>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Estimated Completion</label>
                      <div className="relative">
                        <Calendar size={15} className="absolute left-4 top-1/2 -translate-y-1/2 [color:var(--text-muted)]" />
                        <input type="date" className="input-field pl-11 h-12" value={form.estimatedCompletion} onChange={f('estimatedCompletion')} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Right column — always visible */}
            <div className="col-span-12 lg:col-span-4 space-y-5">
              <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
                <div className="flex items-center gap-3 mb-5">
                  <FileText size={18} className="text-violet-500" />
                  <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Ticket Summary</h4>
                </div>
                <div className="space-y-3">
                  {summaryRows.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <Icon size={14} style={{ color: 'var(--text-muted)' }} />
                      <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <span className="max-w-[140px] truncate text-xs font-semibold text-right" style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>{value || '—'}</span>
                    </div>
                  ))}
                </div>
                {form.estimatedCompletion && (
                  <div className="mt-5 rounded-xl border p-3 bg-violet-500/5" style={{ borderColor: 'var(--sidebar-active-border)' }}>
                    <div className="flex items-center gap-2 text-violet-500 text-xs font-semibold mb-1">
                      <Clock size={13} /> Estimated Completion
                    </div>
                    <p className="text-sm font-bold text-violet-500">{form.estimatedCompletion}</p>
                  </div>
                )}
              </div>
              <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Need Help?</h4>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                      Fill required fields and click <span className="font-semibold">Create Ticket</span>. Required fields are marked with <span className="text-red-500">*</span>
                    </p>
                    <button type="button" className="text-xs font-bold text-violet-500 flex items-center gap-1.5">View Ticket Guidelines <ArrowRight size={13} /></button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {error && <p className="px-8 pb-2 text-xs text-red-400">{error}</p>}

          <div className="px-8 pb-8 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-8 rounded-xl border text-sm font-semibold transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-11 px-12 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-violet-500/20 transition-all hover:opacity-90"
              style={{ background: 'var(--brand-gradient)' }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Create Ticket</>}
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

const STATUS_FLOW = REPAIR_PROGRESS_FLOW

const priorityBadge = (p: string) => {
  const map: Record<string, string> = {
    URGENT: 'bg-red-500/10 border-red-500/20 text-red-400',
    HIGH:   'bg-orange-500/10 border-orange-500/20 text-orange-400',
    NORMAL: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    LOW:    'bg-green-500/10 border-green-500/20 text-green-400',
  }
  return map[p] || 'bg-slate-500/10 border-slate-500/20 [color:var(--text-muted)]'
}

type RepairStatusFilter =
  | 'all' | 'active' | 'urgent'
  | 'RECEIVED' | 'DIAGNOSED' | 'IN_REPAIR' | 'QC' | 'READY' | 'DELIVERED' | 'CANCELLED'

const REP_FILTERS_KEY = 'hexalyte:repairs-filters'

const STATUS_CHIPS: { id: RepairStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'In progress' },
  { id: 'RECEIVED', label: 'Received' },
  { id: 'IN_REPAIR', label: 'In repair' },
  { id: 'READY', label: 'Ready' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'urgent', label: 'Urgent' },
]

const ACTIVE_STATUSES = ['RECEIVED', 'DIAGNOSED', 'IN_REPAIR', 'QC']


export default function RepairsPage() {
  const hasAccess = useFeatureFlag('REPAIRS')
  const searchParams = useSearchParams()
  const { data: repairsData, loading, refetch } = useRepairs()
  const [showAddModal, setShowAddModal]     = useState(false)
  const [prefillData, setPrefillData]       = useState<any>(null)
  const [detailRepair, setDetailRepair]     = useState<RepairTicket | null>(null)
  const [editRepair,   setEditRepair]       = useState<RepairTicket | null>(null)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState<RepairStatusFilter>('all')
  const [filtersReady, setFiltersReady] = useState(false)

  const openDetail = useCallback((repair: RepairTicket) => setDetailRepair(repair), [])
  const openEdit = useCallback((repair: RepairTicket) => {
    if (!repairTicketEditable(repair.status)) {
      toast.error('Completed or cancelled repairs cannot be edited')
      return
    }
    setEditRepair(repair)
  }, [])

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(REP_FILTERS_KEY)
      if (saved) {
        const f = JSON.parse(saved)
        if (typeof f.search === 'string') setSearch(f.search)
        if (f.statusFilter) setStatusFilter(f.statusFilter)
      }
    } catch { /* ignore */ }
    setFiltersReady(true)
  }, [])

  useEffect(() => {
    if (!filtersReady) return
    sessionStorage.setItem(REP_FILTERS_KEY, JSON.stringify({ search, statusFilter }))
  }, [filtersReady, search, statusFilter])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setSearch(q)
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('fromWarranty') === '1') {
      setPrefillData({
        customerName:    searchParams.get('customerName')    || undefined,
        customerPhone:   searchParams.get('customerPhone')   || undefined,
        deviceBrand:     searchParams.get('deviceBrand')     || undefined,
        deviceModel:     searchParams.get('deviceModel')     || undefined,
        imei:            searchParams.get('imei')            || undefined,
        warrantyClaimId: searchParams.get('warrantyClaimId') || undefined,
      })
      setShowAddModal(true)
    } else if (searchParams.get('action') === 'new' || searchParams.get('new') === '1') {
      setShowAddModal(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allRepairs: RepairTicket[] = useMemo(
    () => ((repairsData?.data ?? []) as unknown[]).map((r) => normalizeRepairTicket(r)),
    [repairsData],
  )

  useEffect(() => {
    const id = searchParams.get('id') || searchParams.get('ticketId')
    if (!id) return
    const found = allRepairs.find(r => r.id === id)
    if (found) {
      setDetailRepair(found)
      return
    }
    if (!allRepairs.length && loading) return
    repairsApi.getById(id).then((res: any) => {
      const ticket = normalizeRepairTicket(res?.data ?? res)
      if (ticket?.id) setDetailRepair(ticket)
    }).catch(() => {})
  }, [searchParams, allRepairs, loading])

  const stats = useMemo(() => ({
    total:     allRepairs.length,
    active:    allRepairs.filter(r => ['RECEIVED','DIAGNOSED','IN_REPAIR','QC'].includes(r.status)).length,
    ready:     allRepairs.filter(r => r.status === 'READY').length,
    delivered: allRepairs.filter(r => r.status === 'DELIVERED').length,
    urgent:    allRepairs.filter(r => r.priority === 'URGENT').length,
    revenue:   allRepairs.filter(r => r.status === 'DELIVERED').reduce((s, r) => s + (Number(r.paidAmount) ?? (Number(r.actualCost) || calcRepairTotals(r).subtotal)), 0),
  }), [allRepairs])

  const repairs = useMemo(() => {
    let rows = allRepairs
    if (statusFilter === 'active') {
      rows = rows.filter(r => ACTIVE_STATUSES.includes(r.status))
    } else if (statusFilter === 'urgent') {
      rows = rows.filter(r => r.priority === 'URGENT')
    } else if (statusFilter !== 'all') {
      rows = rows.filter(r => r.status === statusFilter)
    }
    const q = search.toLowerCase().trim()
    if (!q) return rows
    return rows.filter(r =>
      r.ticketNumber?.toLowerCase().includes(q) ||
      r.customerName?.toLowerCase().includes(q) ||
      r.customerPhone?.toLowerCase().includes(q) ||
      `${r.deviceBrand} ${r.deviceModel}`.toLowerCase().includes(q) ||
      r.reportedIssue?.toLowerCase().includes(q)
    )
  }, [allRepairs, search, statusFilter])

  const hasActiveFilters = statusFilter !== 'all' || search.trim().length > 0
  const clearFilters = () => { setStatusFilter('all'); setSearch('') }

  const columns = useMemo<ColumnDef<RepairTicket>[]>(() => [
    {
      accessorKey: 'ticketNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Ticket #" />,
      cell: ({ row }) => (
        <button
          type="button"
          className="text-xs font-mono text-violet-600 dark:text-violet-400 hover:underline text-left"
          onClick={() => openDetail(row.original)}
          onDoubleClick={(e) => { e.preventDefault(); openEdit(row.original) }}
        >
          {row.original.ticketNumber}
        </button>
      ),
    },
    {
      id: 'device',
      accessorFn: (row) => `${row.deviceBrand} ${row.deviceModel}`,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Device" />,
      cell: ({ row }) => (
        <button
          type="button"
          className="text-left"
          onClick={() => openDetail(row.original)}
          onDoubleClick={(e) => { e.preventDefault(); openEdit(row.original) }}
        >
          <p className="text-sm font-medium transition-colors hover:text-violet-600 dark:hover:text-violet-400" style={{ color: 'var(--text-primary)' }}>{row.original.deviceBrand} {row.original.deviceModel}</p>
        </button>
      ),
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-violet-500/15 flex items-center justify-center text-[10px] font-bold text-violet-600 dark:text-violet-400">
            {row.original.customerName.charAt(0)}
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{row.original.customerName}</p>
            <a href={`tel:${row.original.customerPhone}`} className="text-[10px] hover:text-violet-600 dark:hover:text-violet-400" style={{ color: 'var(--text-muted)' }}>{row.original.customerPhone}</a>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'reportedIssue',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Issue" />,
      cell: ({ row }) => <p className="text-xs max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}>{row.original.reportedIssue}</p>,
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
      cell: ({ row }) => <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => printRepairReceipt(row.original, getInvoiceSettings())}
            title="Thermal Print"
            className="p-1.5 rounded-lg transition-colors hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-500/10"
            style={{ color: 'var(--text-muted)' }}
          >
            <Printer size={13} />
          </button>
          <TableActionsRow
            showAction={{ action: () => openDetail(row.original) }}
            editAction={{ action: () => openEdit(row.original) }}
          />
        </div>
      ),
    },
  ], [openDetail, openEdit])

  if (!hasAccess) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--brand-glow)' }}>
        <Wrench size={26} className="text-violet-500" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Repair Jobs</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>This feature is not enabled for your account.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {showAddModal  && <NewTicketModal onClose={() => { setShowAddModal(false); setPrefillData(null) }} onSaved={refetch} prefill={prefillData ?? undefined} />}
      {detailRepair  && (
        <RepairDetailsModal
          repair={detailRepair}
          allRepairs={allRepairs}
          onClose={() => setDetailRepair(null)}
          onEdit={() => { setEditRepair(detailRepair); setDetailRepair(null) }}
          onStatusChange={async (id, status) => {
            try {
              await repairsApi.updateStatus(id, status)
              toast.success(`Status → ${statusLabels[status]}`)
              refetch()
              if (detailRepair?.id === id) {
                const res: any = await repairsApi.getById(id)
                setDetailRepair(normalizeRepairTicket(res?.data ?? detailRepair))
              }
            } catch (err: any) { toast.error(err?.message ?? 'Status update failed') }
          }}
          onRepairUpdate={setDetailRepair}
          onRefresh={async () => {
            refetch()
            if (!detailRepair?.id) return
            const res: any = await repairsApi.getById(detailRepair.id)
            setDetailRepair(normalizeRepairTicket(res?.data ?? detailRepair))
          }}
        />
      )}
      {editRepair    && <EditRepairModal   repair={editRepair}   onClose={() => setEditRepair(null)}   onSaved={() => { refetch(); setEditRepair(null) }} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Repair Jobs</h1>
          <p className="page-subtitle">{stats.total} tickets · {stats.active} in progress · {stats.ready} ready for pickup</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button type="button" onClick={() => refetch()} disabled={loading}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button type="button" onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />New Ticket
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {([
          { icon: Wrench,      label: 'Total Jobs',  value: String(stats.total),           color: 'var(--brand-primary-light)', bg: 'var(--brand-glow)', border: 'var(--sidebar-active-border)', filter: 'all' as RepairStatusFilter },
          { icon: Clock,       label: 'In Progress', value: String(stats.active),          color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)',  border: 'rgba(29,78,216,0.20)',  filter: 'active' as RepairStatusFilter },
          { icon: CheckCircle, label: 'Ready',       value: String(stats.ready),           color: '#15803d', bg: 'rgba(21,128,61,0.08)',  border: 'rgba(21,128,61,0.20)',  filter: 'READY' as RepairStatusFilter },
          { icon: Smartphone,  label: 'Delivered',   value: String(stats.delivered),       color: '#0e7490', bg: 'rgba(14,116,144,0.08)', border: 'rgba(14,116,144,0.20)', filter: 'DELIVERED' as RepairStatusFilter },
          { icon: AlertCircle, label: 'Urgent',      value: String(stats.urgent),          color: '#b91c1c', bg: 'rgba(185,28,28,0.08)',  border: 'rgba(185,28,28,0.20)',  filter: 'urgent' as RepairStatusFilter },
          { icon: DollarSign,  label: 'Revenue',     value: formatCurrency(stats.revenue), color: '#b45309', bg: 'rgba(180,83,9,0.08)',   border: 'rgba(180,83,9,0.20)',   filter: 'DELIVERED' as RepairStatusFilter },
        ]).map(({ icon: Icon, label, value, color, bg, border, filter }) => (
          <button
            key={label}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`card p-4 flex items-center gap-3 text-left w-full transition-all hover:opacity-95 ${statusFilter === filter ? 'ring-2 ring-violet-500/40' : ''}`}
            style={{ borderColor: border, background: bg }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ color, background: bg, border: `1px solid ${border}` }}>
              <Icon size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Status filters */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl flex-wrap border w-fit" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
          {STATUS_CHIPS.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
              style={statusFilter === opt.id
                ? { background: 'var(--brand-primary-light)', color: '#fff' }
                : { color: 'var(--text-muted)' }}>
              {opt.label}
            </button>
          ))}
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover:text-violet-600 dark:hover:text-violet-400"
            style={{ color: 'var(--text-muted)' }}>
            Clear filters
          </button>
        )}
      </div>

      <ToolbarSearch
        value={search}
        onChange={setSearch}
        placeholder="Search ticket, customer, phone, device…"
        className="max-w-md"
      />

      {/* Table or empty */}
      {!loading && allRepairs.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No repair tickets yet"
          description="Create a ticket when a customer drops off a device. Track diagnosis, parts, status, and payment through to delivery."
          accentColor="violet"
          actions={[{ label: 'Create First Ticket', onClick: () => setShowAddModal(true), primary: true }]}
          hints={[
            'Assign a technician and set priority when creating the ticket.',
            'Add spare parts from inventory and collect payment on delivery.',
            'Print a thermal receipt or send quotes via WhatsApp from the ticket detail view.',
          ]}
        />
      ) : (
        <ClientSideTable
          data={repairs}
          columns={columns}
          isLoading={loading}
          pageCount={Math.ceil((repairs.length || 1) / 20)}
          searchableColumns={[]}
          showFilter={false}
        />
      )}
    </div>
  )
}

