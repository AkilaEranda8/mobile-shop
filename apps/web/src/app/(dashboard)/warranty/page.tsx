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
import { useModuleAccess, viewOnlyToast } from '@/lib/module-access'
import {
  getActiveBranchId,
  getVisibleBranches,
  hasMultipleBranches,
  isAllBranchesScope,
} from '@/lib/active-branch'

const statusColors: Record<string, string> = {
  ACTIVE:  'bg-green-500/10  border-green-500/20  text-green-400',
  EXPIRED: 'bg-slate-500/10  border-slate-500/20  text-slate-400',
  VOID:    'bg-red-500/10    border-red-500/20    text-red-400',
  CLAIMED: 'bg-blue-500/10   border-blue-500/20   text-blue-400',
}

/* ── Repair service warranty default (shop-wide) ─────────────────────── */
function RepairWarrantyDefaults() {
  const { canEdit } = useModuleAccess()
  const [months, setMonths] = useState(3)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const user = authStorage.getUser()
    if (!user?.tenantId) return
    fetchInvoiceSettings(user.tenantId).then(s => setMonths(s.repairWarrantyMonths ?? 3)).catch(() => {})
  }, [])

  const save = async () => {
    if (!canEdit) { viewOnlyToast('warranties'); return }
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
      {canEdit && <div className="flex items-center gap-2 shrink-0">
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
      </div>}
    </div>
  )
}

/* ── Add Warranty Modal ───────────────────────────────────────────────── */
function AddWarrantyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { canEdit } = useModuleAccess()
  const branches = useMemo(() => getVisibleBranches(), [])
  const showBranchPicker = hasMultipleBranches()
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerId: '',
    productName: '', brandName: '', imei: '',
    quantity: '1',
    monthsDuration: '12', startDate: new Date().toISOString().slice(0, 10),
    invoiceNumber: '', saleId: '', productId: '',
    branchId: getActiveBranchId() ?? branches[0]?.id ?? '',
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
    e.preventDefault()
    if (!canEdit) { viewOnlyToast('warranties'); return }
    setLoading(true)
    try {
      const start = new Date(form.startDate)
      const end   = new Date(start)
      end.setMonth(end.getMonth() + Number(form.monthsDuration))
      const branchId = form.branchId || getActiveBranchId() || undefined
      if (showBranchPicker && !branchId) {
        toast.error('Select a branch')
        setLoading(false)
        return
      }
      await warrantyApi.create({
        ...form,
        ...(branchId ? { branchId } : {}),
        monthsDuration: Number(form.monthsDuration),
        quantity: Math.max(1, Number(form.quantity) || 1),
        startDate: start,
        endDate: end,
      })
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

          {showBranchPicker && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Branch *</label>
              <select
                className="input-field"
                value={form.branchId}
                onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
                required
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                This warranty stays on the selected branch only
              </p>
            </div>
          )}

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
              { k: 'quantity',      label: 'Quantity',         req: true },
            ].map(({ k, label, req }) => (
              <div key={k}>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}{req ? ' *' : ''}</label>
                <input
                  required={req}
                  type={k === 'quantity' ? 'number' : 'text'}
                  min={k === 'quantity' ? 1 : undefined}
                  className="input-field"
                  value={(form as any)[k]}
                  onChange={f(k)}
                />
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
  const { canEdit } = useModuleAccess()
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
    if (!canEdit) { viewOnlyToast('warranties'); return }
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
    if (!canEdit) { viewOnlyToast('warranties'); return }
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
    if (!canEdit) { viewOnlyToast('warranties'); return }
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
    if (!canEdit) { viewOnlyToast('warranties'); return }
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const safeText = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const daysLabel =
    warranty.status === 'ACTIVE'
      ? (expiring ? `${daysLeft} days left` : `${daysLeft} days remaining`)
      : warranty.status === 'EXPIRED'
        ? 'Expired'
        : warranty.status

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-6xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <Shield size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Warranty Details ( <span className="font-mono">{safeText(warranty.warrantyCode)}</span> )
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {safeText(warranty.productName)} · {safeText(warranty.customerName)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${statusColors[warranty.status] ?? ''}`}>
              {warranty.status}
            </span>
            {warranty.status === 'ACTIVE' && (
              <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${
                expiring
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
              }`}>
                {daysLabel}
              </span>
            )}
            {canEdit && <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold text-violet-700 dark:text-violet-300 border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/20"
            >
              <Edit size={12} /> Edit
            </button>}
            {canEdit && <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-semibold text-rose-700 dark:text-rose-300 border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20"
            >
              <Trash2 size={12} /> Delete
            </button>}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Top meta row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Warranty code:</span>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(warranty.warrantyCode)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Invoice:</span>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(warranty.invoiceNumber)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Issued:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(formatDate(warranty.createdAt))}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Duration:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{warranty.monthsDuration} months</span>
              </div>
            </div>

            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <User size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(warranty.customerName)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                <a href={`tel:${warranty.customerPhone}`} className="font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
                  {safeText(warranty.customerPhone)}
                </a>
              </div>
              <div className="flex items-center gap-1.5">
                <Package size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Product:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {safeText(warranty.productName)}
                  {(warranty.quantity ?? 1) > 1 ? ` ×${warranty.quantity}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Qty covered:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{warranty.quantity ?? 1}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Brand / IMEI:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {[warranty.brandName, warranty.imei].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Coverage</span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{warranty.status}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Start</span>
                  <span className="font-medium">{safeText(formatDate(warranty.startDate))}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>End</span>
                  <span className="font-medium">{safeText(formatDate(warranty.endDate))}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Claims</span>
                  <span className="font-medium">{localClaims.length}</span>
                </div>
                <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="font-semibold">Remaining</span>
                  <span className={`font-semibold ${expiring ? 'text-amber-600 dark:text-amber-400' : warranty.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                    {daysLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Warranty info table */}
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Warranty information
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[640px] w-full text-[12px]">
                    <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th className="px-3 py-2 text-left">Field</th>
                        <th className="px-3 py-2 text-left">Value</th>
                        <th className="px-3 py-2 text-left">Field</th>
                        <th className="px-3 py-2 text-left">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Product</td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(warranty.productName)}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Brand</td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(warranty.brandName)}</td>
                      </tr>
                      <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Customer</td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(warranty.customerName)}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Phone</td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(warranty.customerPhone)}</td>
                      </tr>
                      <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>IMEI</td>
                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(warranty.imei)}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Invoice</td>
                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>{safeText(warranty.invoiceNumber)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Start / End</td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                          {safeText(formatDate(warranty.startDate))} → {safeText(formatDate(warranty.endDate))}
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>Duration</td>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{warranty.monthsDuration} months</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Claims table */}
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle size={12} /> Claims ({localClaims.length})
                  </span>
                  {canEdit && warranty.status !== 'VOID' && warranty.status !== 'EXPIRED' && (
                    <button
                      type="button"
                      onClick={() => setShowClaimForm(v => !v)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/15 hover:bg-white/25"
                    >
                      <Plus size={10} /> File claim
                    </button>
                  )}
                </div>

                {showClaimForm && (
                  <div className="p-3 border-b space-y-2" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(245,158,11,0.06)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Claim type</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setClaimType('HARDWARE')}
                        className={`flex-1 py-1.5 text-xs rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                          claimType === 'HARDWARE'
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-600 dark:text-blue-300'
                            : ''
                        }`}
                        style={claimType !== 'HARDWARE' ? { borderColor: 'var(--border-default)', color: 'var(--text-muted)' } : undefined}
                      >
                        <Wrench size={11} /> Hardware
                      </button>
                      <button type="button" onClick={() => setClaimType('SOFTWARE')}
                        className={`flex-1 py-1.5 text-xs rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                          claimType === 'SOFTWARE'
                            ? 'bg-violet-500/20 border-violet-500/40 text-violet-600 dark:text-violet-300'
                            : ''
                        }`}
                        style={claimType !== 'SOFTWARE' ? { borderColor: 'var(--border-default)', color: 'var(--text-muted)' } : undefined}
                      >
                        <Package size={11} /> Software
                      </button>
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Describe the issue</p>
                    <textarea
                      rows={3}
                      className="input-field w-full text-xs resize-none"
                      placeholder="Describe the warranty claim issue…"
                      value={claimIssue}
                      onChange={e => setClaimIssue(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowClaimForm(false); setClaimIssue(''); setClaimType('HARDWARE') }}
                        className="flex-1 py-1.5 text-xs rounded-lg border font-semibold"
                        style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={submitClaim}
                        disabled={claimLoading || !claimIssue.trim()}
                        className="flex-1 py-1.5 text-xs rounded-lg bg-amber-500 text-white hover:bg-amber-400 disabled:opacity-50 font-semibold flex items-center justify-center gap-1.5"
                      >
                        {claimLoading ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                        Submit claim
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-[12px]">
                    <thead className="border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th className="px-3 py-2 text-left w-10">#</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Issue</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localClaims.map((c: any, idx: number) => {
                        const flow = CLAIM_FLOW[c.status]
                        return (
                          <tr key={c.id} className="border-b last:border-0 align-top" style={{ borderColor: 'var(--border-subtle)' }}>
                            <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{safeText(formatDate(c.createdAt))}</td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                                c.claimType === 'SOFTWARE'
                                  ? 'bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400'
                                  : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                              }`}>
                                {c.claimType === 'SOFTWARE' ? 'Software' : 'Hardware'}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-[240px]">
                              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{safeText(c.issue)}</p>
                              {c.resolution && (
                                <p className="text-[10px] mt-1 text-emerald-600 dark:text-emerald-400">✓ {c.resolution}</p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${CLAIM_STATUS_COLOR[c.status] ?? ''}`}>
                                {safeText(c.status?.replace('_', ' '))}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {canEdit && flow && c.status !== 'RESOLVED' && c.status !== 'REJECTED' ? (
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    onClick={() => advanceClaim(c, flow.next)}
                                    disabled={!!claimUpdating}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border disabled:opacity-50 ${flow.color}`}
                                  >
                                    {claimUpdating === c.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                                    {flow.label}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onCreateRepair?.(c)}
                                    disabled={!!claimUpdating}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 disabled:opacity-50"
                                  >
                                    <Wrench size={10} /> Repair
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => rejectClaim(c)}
                                    disabled={!!claimUpdating}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 disabled:opacity-50"
                                  >
                                    <X size={10} /> Reject
                                  </button>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {localClaims.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>No claims filed yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Customer:</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
                    {safeText(warranty.customerName)}
                    {warranty.customerPhone ? ` · ${warranty.customerPhone}` : ''}
                  </p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Device:</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
                    {[warranty.productName, warranty.brandName, warranty.imei].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right summary */}
            <div className="rounded-lg border overflow-hidden h-fit" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Summary</p>
                <p className="text-[12px] font-semibold">{warranty.status}</p>
              </div>
              <div className="p-3 text-[12px] space-y-2">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Duration:</span>
                  <span className="font-medium">{warranty.monthsDuration} mo</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Start:</span>
                  <span className="font-medium">{safeText(formatDate(warranty.startDate))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>End:</span>
                  <span className="font-medium">{safeText(formatDate(warranty.endDate))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Claims:</span>
                  <span className="font-medium">{localClaims.length}</span>
                </div>
                <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Remaining:</span>
                    <span className={`font-semibold ${expiring ? 'text-amber-600 dark:text-amber-400' : warranty.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      {daysLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Code:</span>
                    <span className="font-medium font-mono text-[11px]">{safeText(warranty.warrantyCode)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-end pt-2 flex-wrap">
            <button
              type="button"
              onClick={() => printWarrantyCertificate(warranty, invSettings)}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold"
            >
              <Printer size={14} /> Print
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={downloading}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300 font-semibold disabled:opacity-60"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download PDF
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={emailLoading}
                onClick={() => setShowEmailInput(v => !v)}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-cyan-500/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-semibold disabled:opacity-60"
              >
                {emailLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Send Email
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border font-semibold"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
            >
              Close
            </button>
          </div>

          {canEdit && showEmailInput && (
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <input
                type="email"
                className="input-field flex-1 text-xs py-2 max-w-sm sm:ml-auto"
                placeholder="Enter email address…"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={sendEmail}
                disabled={emailLoading || !emailTo}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50 font-semibold"
              >
                {emailLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Send
              </button>
            </div>
          )}

          {/* Hidden certificate for PDF capture */}
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
  const { canEdit } = useModuleAccess()
  const branches = useMemo(() => getVisibleBranches(), [])
  const showBranchPicker = hasMultipleBranches()
  const [form, setForm] = useState({
    customerName:   warranty.customerName   ?? '',
    customerPhone:  warranty.customerPhone  ?? '',
    productName:    warranty.productName    ?? '',
    brandName:      warranty.brandName      ?? '',
    imei:           warranty.imei           ?? '',
    quantity:       String(warranty.quantity ?? 1),
    monthsDuration: String(warranty.monthsDuration ?? 12),
    startDate:      warranty.startDate?.slice(0, 10) ?? '',
    endDate:        warranty.endDate?.slice(0, 10)   ?? '',
    status:         warranty.status ?? 'ACTIVE',
    branchId:       warranty.branchId ?? getActiveBranchId() ?? branches[0]?.id ?? '',
  })
  const [loading, setLoading] = useState(false)
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) { viewOnlyToast('warranties'); return }
    setLoading(true)
    try {
      if (showBranchPicker && !form.branchId) {
        toast.error('Select a branch')
        setLoading(false)
        return
      }
      await warrantyApi.update(warranty.id, {
        ...form,
        monthsDuration: Number(form.monthsDuration),
        quantity: Math.max(1, Number(form.quantity) || 1),
        ...(form.branchId ? { branchId: form.branchId } : {}),
      })
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
          {showBranchPicker && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Branch *</label>
              <select
                className="input-field"
                value={form.branchId}
                onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
                required
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Move this warranty to another branch if needed
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'customerName',  label: 'Customer Name *', req: true  },
              { k: 'customerPhone', label: 'Phone *',          req: true  },
              { k: 'productName',   label: 'Product Name *',  req: true  },
              { k: 'brandName',     label: 'Brand',           req: false },
              { k: 'imei',          label: 'IMEI / Serial',   req: false },
              { k: 'quantity',      label: 'Quantity *',      req: true  },
            ].map(({ k, label, req }) => (
              <div key={k}>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
                <input
                  required={req}
                  type={k === 'quantity' ? 'number' : 'text'}
                  min={k === 'quantity' ? 1 : undefined}
                  className="input-field"
                  value={(form as any)[k]}
                  onChange={f(k)}
                />
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
  const { canEdit } = useModuleAccess()
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
    if (canEdit && (action === 'add' || action === 'new' || searchParams.get('new') === '1')) setShowAdd(true)
    const id = searchParams.get('id')
    if (!id || !warranties.length) return
    const found = warranties.find(w => w.id === id)
    if (found) setViewW(found)
  }, [canEdit, searchParams, warranties])

  const openDetail = useCallback((w: Warranty) => setViewW(w), [])
  const openEdit = useCallback((w: Warranty) => {
    if (!canEdit) { viewOnlyToast('warranties'); return }
    setEditW(w)
  }, [canEdit])

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
    if (!canEdit) { viewOnlyToast('warranties'); return }
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

  const columns = useMemo<ColumnDef<Warranty>[]>(() => {
    const showBranchCol = hasMultipleBranches() || isAllBranchesScope()
    const cols: ColumnDef<Warranty>[] = [
    {
      accessorKey: 'warrantyCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
      cell: ({ row }) => (
        <button
          type="button"
          className="flex items-center gap-2 hover:opacity-80"
          onClick={() => openDetail(row.original)}
          onDoubleClick={canEdit ? (e) => { e.preventDefault(); openEdit(row.original) } : undefined}
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
          <p className="text-sm truncate max-w-[180px]" style={{ color: 'var(--text-primary)' }}>
            {row.original.productName}
            {(row.original.quantity ?? 1) > 1 && (
              <span className="ml-1.5 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                ×{row.original.quantity}
              </span>
            )}
          </p>
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
    ]
    if (showBranchCol) {
      cols.push({
        id: 'branch',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Branch" />,
        accessorFn: (row) => row.branch?.name ?? '',
        cell: ({ row }) => (
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {row.original.branch?.name ?? '—'}
          </span>
        ),
      })
    }
    cols.push(
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
          {...(canEdit ? {
            editAction: { action: () => openEdit(row.original) },
            deleteAction: { action: () => handleDelete(row.original), disabled: deletingId === row.original.id },
          } : {})}
        />
      ),
    },
    )
    return cols
  }, [canEdit, deletingId, handleDelete, openDetail, openEdit])

  return (
    <div className="space-y-6">
      {showAdd  && <AddWarrantyModal onClose={() => setShowAdd(false)} onSaved={() => { refetch(); setShowAdd(false) }} />}
      {viewW    && <WarrantyDetailsModal warranty={viewW} onClose={() => setViewW(null)} onEdit={() => {
        if (!canEdit) { viewOnlyToast('warranties'); return }
        setEditW(viewW); setViewW(null)
      }} onDelete={() => handleDelete(viewW)}
        onCreateRepair={(claim) => {
          if (!canEdit) { viewOnlyToast('warranties'); return }
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
        {canEdit && (
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2 sm:ml-auto">
            <Plus size={14} />Issue Warranty
          </button>
        )}
      </div>

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
