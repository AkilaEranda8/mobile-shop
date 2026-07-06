'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search, Shield, Plus, AlertTriangle, Eye, Loader2, X, Edit, Trash2,
  Phone, Calendar, Hash, CheckCircle, Clock, Package, User, Save,
  Download, Mail, Send, Wrench,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { formatDate } from '@/lib/utils'
import { useWarranties, useCustomers, useProducts } from '@/lib/hooks'
import { warrantyApi } from '@/lib/api'
import toast from 'react-hot-toast'
import type { Warranty } from '@/types'
import WarrantyCertificate, { printWarrantyCertificate } from '@/components/invoice/WarrantyCertificate'
import { type InvoiceSettings, fetchInvoiceSettings, pushInvoiceSettings, DEFAULT_INVOICE_SETTINGS } from '@/lib/invoiceSettings'
import { REPAIR_WARRANTY_OPTIONS } from '@/lib/repair-invoice.util'
import { parseRepairWarrantyDevice } from '@/lib/repair.util'
import { formatWarrantyPeriodLabel } from '@/components/pos/cart-rules'
import { authStorage } from '@/lib/auth'
import { Printer } from 'lucide-react'

const statusColors: Record<string, string> = {
  ACTIVE:  'bg-green-500/10  border-green-500/20  text-green-400',
  EXPIRED: 'bg-slate-500/10  border-slate-500/20  text-slate-400',
  VOID:    'bg-red-500/10    border-red-500/20    text-red-400',
  CLAIMED: 'bg-blue-500/10   border-blue-500/20   text-blue-400',
}

/* ── Repair service warranty default (shop-wide) ─────────────────────── */
function RepairWarrantyDefaults() {
  const [months, setMonths] = useState(3)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const user = authStorage.getUser()
    if (!user?.tenantId) return
    fetchInvoiceSettings(user.tenantId).then(s => setMonths(s.repairWarrantyMonths ?? 3)).catch(() => {})
  }, [])

  const save = async () => {
    const user = authStorage.getUser()
    if (!user?.tenantId) return
    setSaving(true)
    try {
      const cur = await fetchInvoiceSettings(user.tenantId)
      await pushInvoiceSettings(user.tenantId, { ...cur, repairWarrantyMonths: months })
      toast.success('Default repair warranty saved')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-4 border border-violet-500/15 bg-violet-500/5">
      <div className="flex items-start gap-3 flex-1">
        <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
          <Wrench size={16} className="text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Repair Service Warranty</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            On payment, one combined warranty record is created in Warranty Management (when WARRANTY feature is on).
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <select
          className="input-field h-9 text-sm min-w-[130px]"
          value={months}
          onChange={e => setMonths(Number(e.target.value))}
        >
          {REPAIR_WARRANTY_OPTIONS.map(m => (
            <option key={m} value={m}>{m === 0 ? 'No warranty' : formatWarrantyPeriodLabel(m)}</option>
          ))}
        </select>
        <button type="button" onClick={save} disabled={saving} className="btn-primary text-xs h-9 px-4 disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
        </button>
      </div>
    </div>
  )
}

/* ── Add Warranty Modal ───────────────────────────────────────────────── */
function AddWarrantyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerId: '',
    productName: '', brandName: '', imei: '',
    monthsDuration: '12', startDate: new Date().toISOString().slice(0, 10),
    invoiceNumber: '', saleId: '', productId: '',
  })
  const [loading,      setLoading]      = useState(false)
  const [custSearch,   setCustSearch]   = useState('')
  const [selCustomer,  setSelCustomer]  = useState<any>(null)
  const [prodSearch,   setProdSearch]   = useState('')
  const [selProduct,   setSelProduct]   = useState<any>(null)

  const { data: custData }  = useCustomers()
  const { data: prodData }  = useProducts()
  const allCustomers: any[] = (custData?.data ?? []) as any[]
  const allProducts:  any[] = (prodData?.data  ?? []) as any[]

  const filteredCustomers = custSearch.length > 0
    ? allCustomers.filter(c =>
        c.name?.toLowerCase().includes(custSearch.toLowerCase()) ||
        c.phone?.toLowerCase().includes(custSearch.toLowerCase())
      ).slice(0, 8)
    : []

  const filteredProducts = prodSearch.length > 1
    ? allProducts.filter(p =>
        p.name?.toLowerCase().includes(prodSearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(prodSearch.toLowerCase())
      ).slice(0, 8)
    : []

  const selectCustomer = (c: any) => {
    setSelCustomer(c)
    setForm(p => ({ ...p, customerName: c.name, customerPhone: c.phone ?? '', customerId: c.id }))
    setCustSearch('')
  }

  const selectProduct = (p: any) => {
    setSelProduct(p)
    setForm(prev => ({ ...prev, productName: p.name, brandName: p.brandName ?? p.brand ?? '', productId: p.id }))
    setProdSearch('')
  }

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      const start = new Date(form.startDate)
      const end   = new Date(start)
      end.setMonth(end.getMonth() + Number(form.monthsDuration))
      await warrantyApi.create({ ...form, monthsDuration: Number(form.monthsDuration), startDate: start, endDate: end })
      toast.success('Warranty issued'); onSaved(); onClose()
    } catch (err: any) { toast.error(err?.message ?? 'Failed to issue warranty') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Issue New Warranty</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* ── Customer Selector ── */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Customer *</label>
            {selCustomer ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300 flex-shrink-0">
                  {selCustomer.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-violet-500 truncate">{selCustomer.name}</p>
                  <p className="text-[10px] text-violet-400">{selCustomer.phone}</p>
                </div>
                <button type="button" onClick={() => { setSelCustomer(null); setForm(p => ({ ...p, customerName: '', customerPhone: '', customerId: '' })) }}
                  className="transition-colors flex-shrink-0" style={{ color: 'var(--text-muted)' }}><X size={12} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className="input-field pl-8"
                  placeholder="Search by name or phone…"
                  value={custSearch}
                  onChange={e => setCustSearch(e.target.value)}
                />
                {filteredCustomers.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                    {filteredCustomers.map((c: any) => (
                      <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-violet-500/10 transition-colors border-b last:border-0 flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-500 flex-shrink-0">
                          {c.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {custSearch.length > 0 && filteredCustomers.length === 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full rounded-xl shadow-xl p-3 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                    <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>No customers found</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Product Selector ── */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Product *</label>
            {selProduct ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <Package size={13} className="text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-orange-500 truncate">{selProduct.name}</p>
                  <p className="text-[10px] text-orange-400">{selProduct.brandName ?? selProduct.brand ?? ''}{selProduct.sku ? ` · ${selProduct.sku}` : ''}</p>
                </div>
                <button type="button" onClick={() => { setSelProduct(null); setForm(p => ({ ...p, productName: '', brandName: '', productId: '' })) }}
                  className="transition-colors flex-shrink-0" style={{ color: 'var(--text-muted)' }}><X size={12} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className="input-field pl-8"
                  placeholder="Search by product name or SKU…"
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                />
                {filteredProducts.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                    {filteredProducts.map((p: any) => (
                      <button key={p.id} type="button" onClick={() => selectProduct(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-orange-500/10 transition-colors border-b last:border-0 flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                        <Package size={13} className="text-orange-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.brandName ?? p.brand ?? ''}{p.sku ? ` · ${p.sku}` : ''} · Stock: {p.stock ?? 0}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {prodSearch.length > 1 && filteredProducts.length === 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full rounded-xl shadow-xl p-3 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                    <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>No products found</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'imei',          label: 'IMEI / Serial',   req: false },
              { k: 'invoiceNumber', label: 'Invoice No.',      req: false },
            ].map(({ k, label, req }) => (
              <div key={k}>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
                <input required={req} className="input-field" value={(form as any)[k]} onChange={f(k)} />
              </div>
            ))}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Start Date *</label>
              <input type="date" required className="input-field" value={form.startDate} onChange={f('startDate')} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Duration (Months) *</label>
              <select required className="input-field" value={form.monthsDuration} onChange={f('monthsDuration')}>
                {[1,3,6,12,18,24,36].map(m => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={loading || !selCustomer || !selProduct} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}Issue Warranty
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── View Details Modal ───────────────────────────────────────────────── */
function WarrantyDetailsModal({ warranty, onClose, onEdit, onDelete, onCreateRepair }: {
  warranty: Warranty; onClose: () => void; onEdit: () => void; onDelete: () => void; onCreateRepair?: (claim: any) => void
}) {
  const now      = new Date()
  const daysLeft = Math.ceil((new Date(warranty.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const expiring = daysLeft <= 30 && daysLeft > 0 && warranty.status === 'ACTIVE'
  const certRef  = useRef<HTMLDivElement>(null)
  const [invSettings, setInvSettings] = useState<InvoiceSettings>(DEFAULT_INVOICE_SETTINGS)

  useEffect(() => {
    const user = authStorage.getUser()
    if (user?.tenantId) fetchInvoiceSettings(user.tenantId).then(setInvSettings).catch(() => {})
  }, [])

  const [downloading, setDownloading]     = useState(false)
  const [emailLoading, setEmailLoading]   = useState(false)
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [emailTo, setEmailTo]             = useState('')
  const [showClaimForm, setShowClaimForm] = useState(false)
  const [claimIssue, setClaimIssue]       = useState('')
  const [claimType, setClaimType]         = useState<'HARDWARE' | 'SOFTWARE'>('HARDWARE')
  const [claimLoading, setClaimLoading]   = useState(false)
  const [claimUpdating, setClaimUpdating] = useState<string | null>(null)
  const [localClaims, setLocalClaims]     = useState<any[]>(warranty.claims ?? [])

  const CLAIM_FLOW: Record<string, { next: string; label: string; color: string }> = {
    OPEN:      { next: 'ASSESSED',  label: 'Mark Assessed',  color: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border-blue-500/20' },
    ASSESSED:  { next: 'IN_REPAIR', label: 'Send to Repair', color: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border-amber-500/20' },
    IN_REPAIR: { next: 'RESOLVED',  label: 'Mark Resolved',  color: 'bg-green-500/15 text-green-400 hover:bg-green-500/25 border-green-500/20' },
  }
  const CLAIM_STATUS_COLOR: Record<string, string> = {
    OPEN:      'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    ASSESSED:  'bg-blue-500/10   border-blue-500/20   text-blue-400',
    IN_REPAIR: 'bg-amber-500/10  border-amber-500/20  text-amber-400',
    RESOLVED:  'bg-green-500/10  border-green-500/20  text-green-400',
    REJECTED:  'bg-red-500/10    border-red-500/20    text-red-400',
  }

  const submitClaim = async () => {
    if (!claimIssue.trim()) return
    setClaimLoading(true)
    try {
      const res: any = await warrantyApi.addClaim(warranty.id, { issue: claimIssue, claimType })
      setLocalClaims(prev => [...prev, res.data ?? res])
      setClaimIssue(''); setShowClaimForm(false); setClaimType('HARDWARE')
      toast.success('Claim submitted')
    } catch (err: any) { toast.error(err?.message ?? 'Failed to submit claim') }
    finally { setClaimLoading(false) }
  }

  const advanceClaim = async (claim: any, newStatus: string) => {
    setClaimUpdating(claim.id)
    try {
      const res: any = await warrantyApi.updateClaim(warranty.id, claim.id, { status: newStatus })
      const updated = res.data ?? res
      setLocalClaims(prev => prev.map(c => c.id === claim.id ? { ...c, ...updated } : c))
      toast.success(`Claim ${newStatus.toLowerCase().replace('_', ' ')}`)
    } catch (err: any) { toast.error(err?.message ?? 'Update failed') }
    finally { setClaimUpdating(null) }
  }

  const rejectClaim = async (claim: any) => {
    setClaimUpdating(claim.id)
    try {
      const res: any = await warrantyApi.updateClaim(warranty.id, claim.id, { status: 'REJECTED' })
      const updated = res.data ?? res
      setLocalClaims(prev => prev.map(c => c.id === claim.id ? { ...c, ...updated } : c))
      toast.success('Claim rejected')
    } catch (err: any) { toast.error(err?.message ?? 'Update failed') }
    finally { setClaimUpdating(null) }
  }

  const downloadPdf = async () => {
    if (!certRef.current) return
    setDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default
      const canvas = await html2canvas(certRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' })
      const pw = pdf.internal.pageSize.getWidth()
      const ph = pdf.internal.pageSize.getHeight()
      const iw = canvas.width / 2
      const ih = canvas.height / 2
      const scale = Math.min(pw / iw, ph / ih)
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, iw * scale, ih * scale)
      pdf.save(`Warranty_${warranty.warrantyCode}.pdf`)
      toast.success('PDF downloaded')
    } catch { toast.error('PDF generation failed') }
    finally { setDownloading(false) }
  }

  const sendEmail = async () => {
    setEmailLoading(true)
    try {
      const res: any = await warrantyApi.sendEmail(warranty.id, emailTo || undefined)
      toast.success(`Sent to ${res?.data?.sentTo ?? emailTo}`)
      setShowEmailInput(false); setEmailTo('')
    } catch (err: any) {
      if (err?.message?.includes('No email')) setShowEmailInput(true)
      toast.error(err?.message ?? 'Email failed')
    }
    finally { setEmailLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0 z-10" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-violet-400" />
            <div>
              <p className="text-xs font-mono text-violet-400">{warranty.warrantyCode}</p>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{warranty.productName}</h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onEdit} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors">
              <Edit size={11} />Edit
            </button>
            <button onClick={onDelete} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
              <Trash2 size={11} />Delete
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Status + days left */}
          <div className="flex items-center justify-between p-3 rounded-xl border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
            <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${statusColors[warranty.status]}`}>
              {warranty.status}
            </span>
            {expiring
              ? <span className="text-xs text-yellow-400 flex items-center gap-1"><AlertTriangle size={11} />{daysLeft} days left</span>
              : warranty.status === 'ACTIVE'
                ? <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={11} />{daysLeft} days remaining</span>
                : null}
          </div>

          {/* Customer + Product */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5 mb-2"><User size={11} className="text-cyan-400" /><span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Customer</span></div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{warranty.customerName}</p>
              <a href={`tel:${warranty.customerPhone}`} className="text-[11px] text-cyan-400 flex items-center gap-1 mt-0.5"><Phone size={9} />{warranty.customerPhone}</a>
            </div>
            <div className="rounded-xl p-3 border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5 mb-2"><Package size={11} className="text-violet-400" /><span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Product</span></div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{warranty.productName}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{warranty.brandName}</p>
              {warranty.imei && <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{warranty.imei}</p>}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Start Date', value: formatDate(warranty.startDate), icon: Calendar },
              { label: 'End Date',   value: formatDate(warranty.endDate),   icon: Calendar },
              { label: 'Duration',   value: `${warranty.monthsDuration} mo`, icon: Clock   },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl p-3 border text-center" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                <Icon size={12} className="mx-auto mb-1" style={{ color: 'var(--text-muted)' }} />
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Invoice */}
          {warranty.invoiceNumber && (
            <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
              <Hash size={11} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Invoice:</span>
              <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{warranty.invoiceNumber}</span>
            </div>
          )}

          {/* ── Claims Management ── */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} className="text-amber-400" />
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Claims ({localClaims.length})</p>
              </div>
              {warranty.status !== 'VOID' && warranty.status !== 'EXPIRED' && (
                <button onClick={() => setShowClaimForm(v => !v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors">
                  <Plus size={10} />File Claim
                </button>
              )}
            </div>

            {/* File Claim Form */}
            {showClaimForm && (
              <div className="p-3 border-b border-amber-500/20 bg-amber-500/5 space-y-2">
                <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">Claim Type</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setClaimType('HARDWARE')}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      claimType === 'HARDWARE'
                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                        : 'border-white/10 text-slate-400 hover:bg-white/5'
                    }`}>
                    <Wrench size={11} />Hardware
                  </button>
                  <button type="button" onClick={() => setClaimType('SOFTWARE')}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      claimType === 'SOFTWARE'
                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                        : 'border-white/10 text-slate-400 hover:bg-white/5'
                    }`}>
                    <Package size={11} />Software
                  </button>
                </div>
                <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">Describe the Issue</p>
                <textarea rows={3} className="input-field w-full text-xs resize-none"
                  placeholder="Describe the warranty claim issue…"
                  value={claimIssue} onChange={e => setClaimIssue(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => { setShowClaimForm(false); setClaimIssue(''); setClaimType('HARDWARE') }}
                    className="flex-1 py-1.5 text-xs rounded-lg border transition-colors" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>Cancel</button>
                  <button onClick={submitClaim} disabled={claimLoading || !claimIssue.trim()}
                    className="flex-1 py-1.5 text-xs rounded-lg bg-amber-500 text-white hover:bg-amber-400 disabled:opacity-50 font-semibold flex items-center justify-center gap-1.5 transition-colors">
                    {claimLoading ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}Submit Claim
                  </button>
                </div>
              </div>
            )}

            {/* Claims List */}
            {localClaims.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No claims filed yet</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {localClaims.map((c: any) => {
                  const flow = CLAIM_FLOW[c.status]
                  return (
                    <div key={c.id} className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 font-semibold ${CLAIM_STATUS_COLOR[c.status] ?? ''}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                        {c.claimType && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 font-semibold ${
                            c.claimType === 'SOFTWARE'
                              ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                          }`}>
                            {c.claimType === 'SOFTWARE' ? '💻 Software' : '🔧 Hardware'}
                          </span>
                        )}
                        <p className="text-xs flex-1 leading-relaxed" style={{ color: 'var(--text-primary)' }}>{c.issue}</p>
                      </div>
                      {c.resolution && (
                        <p className="text-[11px] text-green-400 bg-green-500/10 rounded-lg px-2.5 py-1.5 border border-green-500/15">
                          ✓ {c.resolution}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] flex-1" style={{ color: 'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleDateString('en-GB')}</p>
                        {flow && c.status !== 'RESOLVED' && c.status !== 'REJECTED' && (
                          <>
                            <button onClick={() => advanceClaim(c, flow.next)} disabled={!!claimUpdating}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors disabled:opacity-50 ${flow.color}`}>
                              {claimUpdating === c.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                              {flow.label}
                            </button>
                            <button onClick={() => onCreateRepair?.(c)} disabled={!!claimUpdating}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-colors disabled:opacity-50">
                              <Wrench size={10} />Repair Job
                            </button>
                            <button onClick={() => rejectClaim(c)} disabled={!!claimUpdating}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50">
                              <X size={10} />Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Calendar size={10} />Issued {formatDate(warranty.createdAt)}</p>

          {/* ── Action buttons ── */}
          <div className="pt-1 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex gap-2">
              <button onClick={() => printWarrantyCertificate(warranty, invSettings)}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors font-semibold">
                <Printer size={12} />Print
              </button>
              <button onClick={downloadPdf} disabled={downloading}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-xl bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 transition-colors disabled:opacity-50 font-semibold">
                {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}Download PDF
              </button>
              <button
                disabled={emailLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors disabled:opacity-50 font-semibold"
                onClick={() => setShowEmailInput(v => !v)}>
                {emailLoading ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}Send Email
              </button>
            </div>
            {showEmailInput && (
              <div className="flex gap-2">
                <input type="email" className="input-field flex-1 text-xs py-1.5" placeholder="Enter email address…"
                  value={emailTo} onChange={e => setEmailTo(e.target.value)} autoFocus />
                <button onClick={sendEmail} disabled={emailLoading || !emailTo}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50 font-semibold transition-colors">
                  {emailLoading ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}Send
                </button>
              </div>
            )}
          </div>

          {/* ── Hidden Certificate for PDF capture ── */}
          <div className="overflow-hidden" style={{ height: 0, position: 'absolute', left: -9999, top: 0, width: 794 }}>
            <WarrantyCertificate ref={certRef} warranty={warranty} settings={invSettings} hideControls />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Edit Warranty Modal ──────────────────────────────────────────────── */
function EditWarrantyModal({ warranty, onClose, onSaved }: {
  warranty: Warranty; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    customerName:   warranty.customerName   ?? '',
    customerPhone:  warranty.customerPhone  ?? '',
    productName:    warranty.productName    ?? '',
    brandName:      warranty.brandName      ?? '',
    imei:           warranty.imei           ?? '',
    monthsDuration: String(warranty.monthsDuration ?? 12),
    startDate:      warranty.startDate?.slice(0, 10) ?? '',
    endDate:        warranty.endDate?.slice(0, 10)   ?? '',
    status:         warranty.status ?? 'ACTIVE',
  })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      await warrantyApi.update(warranty.id, { ...form, monthsDuration: Number(form.monthsDuration) })
      toast.success('Warranty updated'); onSaved(); onClose()
    } catch (err: any) { toast.error(err?.message ?? 'Update failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div>
            <p className="text-[10px] font-mono text-violet-400">{warranty.warrantyCode}</p>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Edit Warranty</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'customerName',  label: 'Customer Name *', req: true  },
              { k: 'customerPhone', label: 'Phone *',          req: true  },
              { k: 'productName',   label: 'Product Name *',  req: true  },
              { k: 'brandName',     label: 'Brand',           req: false },
              { k: 'imei',          label: 'IMEI / Serial',   req: false },
            ].map(({ k, label, req }) => (
              <div key={k}>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
                <input required={req} className="input-field" value={(form as any)[k]} onChange={f(k)} />
              </div>
            ))}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Start Date</label>
              <input type="date" className="input-field" value={form.startDate} onChange={f('startDate')} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>End Date</label>
              <input type="date" className="input-field" value={form.endDate} onChange={f('endDate')} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Duration (Months)</label>
              <select className="input-field" value={form.monthsDuration} onChange={f('monthsDuration')}>
                {[1,3,6,12,18,24,36].map(m => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Status</label>
              <select className="input-field" value={form.status} onChange={f('status')}>
                {['ACTIVE','EXPIRED','CLAIMED','VOID'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
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

/* ── Main Page ────────────────────────────────────────────────────────── */
export default function WarrantyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: warrantyData, loading, refetch } = useWarranties()
  const [tab, setTab]                     = useState<'all' | 'expiring' | 'claimed'>('all')
  const [textSearch, setTextSearch]       = useState('')
  const [showAdd,   setShowAdd]           = useState(false)
  const [viewW,     setViewW]             = useState<Warranty | null>(null)
  const [editW,     setEditW]             = useState<Warranty | null>(null)
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const warranties: Warranty[] = (warrantyData?.data ?? []) as Warranty[]

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refetch() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refetch])

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'add' || action === 'new' || searchParams.get('new') === '1') setShowAdd(true)
    const id = searchParams.get('id')
    if (!id || !warranties.length) return
    const found = warranties.find(w => w.id === id)
    if (found) setViewW(found)
  }, [searchParams, warranties])

  const openDetail = useCallback((w: Warranty) => setViewW(w), [])
  const openEdit = useCallback((w: Warranty) => setEditW(w), [])

  const now        = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expiringCount = warranties.filter((w: Warranty) => new Date(w.endDate) <= thirtyDays && w.status === 'ACTIVE').length

  const tabFiltered = useMemo(() => {
    let rows = warranties.filter((w: Warranty) => {
      if (tab === 'expiring') return new Date(w.endDate) <= thirtyDays && w.status === 'ACTIVE'
      if (tab === 'claimed')  return w.status === 'CLAIMED'
      return true
    })
    const q = textSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((w: Warranty) =>
      w.warrantyCode?.toLowerCase().includes(q) ||
      w.customerName?.toLowerCase().includes(q) ||
      w.productName?.toLowerCase().includes(q) ||
      ((w as any).imei ?? '').toLowerCase().includes(q)
    )
  }, [warranties, tab, textSearch, thirtyDays])

  const handleDelete = async (w: Warranty) => {
    if (!confirm(`Delete warranty ${w.warrantyCode}? This cannot be undone.`)) return
    setDeletingId(w.id)
    try {
      await warrantyApi.remove(w.id)
      toast.success('Warranty deleted')
      refetch()
      if (viewW?.id === w.id) setViewW(null)
    } catch (err: any) { toast.error(err?.message ?? 'Delete failed') }
    finally { setDeletingId(null) }
  }

  const columns = useMemo<ColumnDef<Warranty>[]>(() => [
    {
      accessorKey: 'warrantyCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
      cell: ({ row }) => (
        <button
          type="button"
          className="flex items-center gap-2 hover:opacity-80"
          onClick={() => openDetail(row.original)}
          onDoubleClick={(e) => { e.preventDefault(); openEdit(row.original) }}
        >
          <Shield size={13} className="text-violet-400 flex-shrink-0" />
          <span className="text-xs font-mono text-violet-500 hover:underline">{row.original.warrantyCode}</span>
        </button>
      ),
    },
    {
      accessorKey: 'productName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
      cell: ({ row }) => (
        <div>
          <p className="text-sm truncate max-w-[180px]" style={{ color: 'var(--text-primary)' }}>{row.original.productName}</p>
          {(row.original as any).imei && <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{(row.original as any).imei}</p>}
        </div>
      ),
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{row.original.customerName}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{(row.original as any).customerPhone}</p>
        </div>
      ),
    },
    {
      accessorKey: 'endDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Expires" />,
      cell: ({ row }) => {
        const today = new Date()
        const daysLeft = Math.ceil((new Date(row.original.endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const isExpiring = daysLeft <= 30 && daysLeft > 0 && row.original.status === 'ACTIVE'
        return (
          <div>
            <span className={`text-xs ${isExpiring ? 'text-yellow-400 font-semibold' : ''}`} style={!isExpiring ? { color: 'var(--text-secondary)' } : undefined}>{formatDate(row.original.endDate)}</span>
            {isExpiring && <p className="text-[10px] text-yellow-500 flex items-center gap-0.5 mt-0.5"><AlertTriangle size={9} />{daysLeft}d left</p>}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusColors[(row.original as any).status] || ''}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <TableActionsRow
          showAction={{ action: () => openDetail(row.original) }}
          editAction={{ action: () => openEdit(row.original) }}
          deleteAction={{ action: () => handleDelete(row.original), disabled: deletingId === row.original.id }}
        />
      ),
    },
  ], [deletingId, handleDelete, openDetail, openEdit])

  return (
    <div className="space-y-6">
      {showAdd  && <AddWarrantyModal onClose={() => setShowAdd(false)} onSaved={() => { refetch(); setShowAdd(false) }} />}
      {viewW    && <WarrantyDetailsModal warranty={viewW} onClose={() => setViewW(null)} onEdit={() => { setEditW(viewW); setViewW(null) }} onDelete={() => handleDelete(viewW)}
        onCreateRepair={(claim) => {
          const w = viewW
          const { deviceBrand, deviceModel } = parseRepairWarrantyDevice(w?.productName, (w as any)?.brandName)
          const params = new URLSearchParams({
            fromWarranty: '1',
            warrantyClaimId: claim.id,
            customerName:  w?.customerName  || '',
            customerPhone: w?.customerPhone || '',
            deviceBrand,
            deviceModel,
            imei:          (w as any)?.imei || '',
          })
          setViewW(null)
          router.push(`/dashboard/repairs?${params.toString()}`)
        }}
      />}
      {editW    && <EditWarrantyModal   warranty={editW} onClose={() => setEditW(null)}  onSaved={() => { refetch(); setEditW(null) }} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Warranty Management</h1>
          <p className="page-subtitle">{warranties.length} warranties · {expiringCount} expiring soon</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2 sm:ml-auto">
          <Plus size={14} />Issue Warranty
        </button>
      </div>

      {/* Repair warranty default */}
      <RepairWarrantyDefaults />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Warranties', value: warranties.length,                                                  icon: Shield,        color: 'violet', tabKey: 'all' as const },
          { label: 'Active',           value: warranties.filter((w: Warranty) => w.status === 'ACTIVE').length,  icon: CheckCircle,   color: 'green',  tabKey: 'all' as const },
          { label: 'Expiring 30d',     value: expiringCount,                                                      icon: AlertTriangle, color: 'yellow', tabKey: 'expiring' as const },
          { label: 'Claimed',          value: warranties.filter((w: Warranty) => w.status === 'CLAIMED').length, icon: Clock,         color: 'blue',   tabKey: 'claimed' as const },
        ].map(({ label, value, icon: Icon, color, tabKey }) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(tabKey)}
            className={`card p-4 flex items-center gap-3 text-left transition-all hover:border-violet-500/30 w-full ${tab === tabKey ? 'ring-2 ring-violet-500/40' : ''}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
              <Icon size={15} className={`text-${color}-400`} />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit border" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
        {[['all', 'All'], ['expiring', `Expiring (${expiringCount})`], ['claimed', 'Claims']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${tab === key ? 'bg-violet-600 text-white' : 'hover:text-violet-500'}`}
            style={tab !== key ? { color: 'var(--text-muted)' } : undefined}>
            {label}
          </button>
        ))}
      </div>

      <ToolbarSearch
        value={textSearch}
        onChange={setTextSearch}
        placeholder="Search code, customer, product, IMEI…"
        className="max-w-md"
      />

      {/* Table */}
      <ClientSideTable
        data={tabFiltered}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((tabFiltered.length || 1) / 20)}
        searchableColumns={[]}
        showFilter={false}
      />
    </div>
  )
}
