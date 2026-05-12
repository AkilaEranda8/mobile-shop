'use client'

import { useState, useRef, useMemo } from 'react'
import {
  Search, Shield, Plus, AlertTriangle, Eye, Loader2, X, Edit, Trash2,
  Phone, Calendar, Hash, CheckCircle, Clock, Package, User, Save,
  Download, Mail, Send,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { formatDate } from '@/lib/utils'
import { useWarranties, useCustomers, useProducts } from '@/lib/hooks'
import { warrantyApi } from '@/lib/api'
import toast from 'react-hot-toast'
import type { Warranty } from '@/types'

const statusColors: Record<string, string> = {
  ACTIVE:  'bg-green-500/10  border-green-500/20  text-green-400',
  EXPIRED: 'bg-slate-500/10  border-slate-500/20  text-slate-400',
  VOID:    'bg-red-500/10    border-red-500/20    text-red-400',
  CLAIMED: 'bg-blue-500/10   border-blue-500/20   text-blue-400',
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
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <h3 className="text-sm font-bold text-white">Issue New Warranty</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* ── Customer Selector ── */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Customer *</label>
            {selCustomer ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300 flex-shrink-0">
                  {selCustomer.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-violet-200 truncate">{selCustomer.name}</p>
                  <p className="text-[10px] text-violet-400">{selCustomer.phone}</p>
                </div>
                <button type="button" onClick={() => { setSelCustomer(null); setForm(p => ({ ...p, customerName: '', customerPhone: '', customerId: '' })) }}
                  className="text-slate-500 hover:text-white flex-shrink-0"><X size={12} /></button>
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
                  <div className="absolute z-20 top-full mt-1 w-full bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    {filteredCustomers.map((c: any) => (
                      <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300 flex-shrink-0">
                          {c.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-200">{c.name}</p>
                          <p className="text-[10px] text-slate-500">{c.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {custSearch.length > 0 && filteredCustomers.length === 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-[#0f1623] border border-white/10 rounded-xl shadow-xl p-3">
                    <p className="text-xs text-slate-500 text-center">No customers found</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Product Selector ── */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Product *</label>
            {selProduct ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <Package size={13} className="text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-orange-200 truncate">{selProduct.name}</p>
                  <p className="text-[10px] text-orange-400">{selProduct.brandName ?? selProduct.brand ?? ''}{selProduct.sku ? ` · ${selProduct.sku}` : ''}</p>
                </div>
                <button type="button" onClick={() => { setSelProduct(null); setForm(p => ({ ...p, productName: '', brandName: '', productId: '' })) }}
                  className="text-slate-500 hover:text-white flex-shrink-0"><X size={12} /></button>
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
                  <div className="absolute z-20 top-full mt-1 w-full bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    {filteredProducts.map((p: any) => (
                      <button key={p.id} type="button" onClick={() => selectProduct(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex items-center gap-2">
                        <Package size={13} className="text-orange-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-slate-200">{p.name}</p>
                          <p className="text-[10px] text-slate-500">{p.brandName ?? p.brand ?? ''}{p.sku ? ` · ${p.sku}` : ''} · Stock: {p.stock ?? 0}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {prodSearch.length > 1 && filteredProducts.length === 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-[#0f1623] border border-white/10 rounded-xl shadow-xl p-3">
                    <p className="text-xs text-slate-500 text-center">No products found</p>
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
                <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
                <input required={req} className="input-field" value={(form as any)[k]} onChange={f(k)} />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Start Date *</label>
              <input type="date" required className="input-field" value={form.startDate} onChange={f('startDate')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Duration (Months) *</label>
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
function WarrantyDetailsModal({ warranty, onClose, onEdit, onDelete }: {
  warranty: Warranty; onClose: () => void; onEdit: () => void; onDelete: () => void
}) {
  const now      = new Date()
  const daysLeft = Math.ceil((new Date(warranty.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const expiring = daysLeft <= 30 && daysLeft > 0 && warranty.status === 'ACTIVE'
  const certRef  = useRef<HTMLDivElement>(null)

  const [downloading, setDownloading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [emailTo, setEmailTo] = useState('')

  const downloadPdf = async () => {
    if (!certRef.current) return
    setDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default
      const canvas = await html2canvas(certRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width / 2, canvas.height / 2] })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
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
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623] z-10">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-violet-400" />
            <div>
              <p className="text-xs font-mono text-violet-400">{warranty.warrantyCode}</p>
              <h3 className="text-sm font-bold text-white">{warranty.productName}</h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onEdit} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors">
              <Edit size={11} />Edit
            </button>
            <button onClick={onDelete} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
              <Trash2 size={11} />Delete
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Status + days left */}
          <div className="flex items-center justify-between p-3 bg-white/3 rounded-xl border border-white/5">
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
            <div className="bg-white/3 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-1.5 mb-2"><User size={11} className="text-cyan-400" /><span className="text-[10px] text-slate-500 uppercase tracking-wide">Customer</span></div>
              <p className="text-xs font-semibold text-slate-200">{warranty.customerName}</p>
              <a href={`tel:${warranty.customerPhone}`} className="text-[11px] text-cyan-400 flex items-center gap-1 mt-0.5"><Phone size={9} />{warranty.customerPhone}</a>
            </div>
            <div className="bg-white/3 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-1.5 mb-2"><Package size={11} className="text-violet-400" /><span className="text-[10px] text-slate-500 uppercase tracking-wide">Product</span></div>
              <p className="text-xs font-semibold text-slate-200">{warranty.productName}</p>
              <p className="text-[11px] text-slate-500">{warranty.brandName}</p>
              {warranty.imei && <p className="text-[10px] font-mono text-slate-600 mt-0.5">{warranty.imei}</p>}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Start Date', value: formatDate(warranty.startDate), icon: Calendar },
              { label: 'End Date',   value: formatDate(warranty.endDate),   icon: Calendar },
              { label: 'Duration',   value: `${warranty.monthsDuration} mo`, icon: Clock   },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white/3 rounded-xl p-3 border border-white/5 text-center">
                <Icon size={12} className="mx-auto mb-1 text-slate-500" />
                <p className="text-xs font-semibold text-white">{value}</p>
                <p className="text-[10px] text-slate-600">{label}</p>
              </div>
            ))}
          </div>

          {/* Invoice */}
          {warranty.invoiceNumber && (
            <div className="flex items-center gap-2 p-3 bg-white/3 rounded-xl border border-white/5">
              <Hash size={11} className="text-slate-500" />
              <span className="text-xs text-slate-400">Invoice:</span>
              <span className="text-xs text-slate-200 font-mono">{warranty.invoiceNumber}</span>
            </div>
          )}

          {/* Claims */}
          {warranty.claims?.length > 0 && (
            <div className="bg-white/3 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Claims ({warranty.claims.length})</p>
              {warranty.claims.map((c: any) => (
                <div key={c.id} className="flex items-start gap-2 py-2 border-b border-white/5 last:border-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${c.status === 'RESOLVED' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}`}>{c.status}</span>
                  <p className="text-xs text-slate-300 flex-1">{c.issue}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-slate-600 flex items-center gap-1"><Calendar size={10} />Issued {formatDate(warranty.createdAt)}</p>

          {/* ── Action buttons ── */}
          <div className="pt-1 border-t border-white/5 space-y-2">
            <div className="flex gap-2">
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

          {/* ── Hidden Certificate for PDF ── */}
          <div className="overflow-hidden h-0">
            <div ref={certRef} style={{ width: 600, background: '#fff', fontFamily: 'Arial, sans-serif', borderRadius: 16, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg,#6d28d9,#7c3aed)', padding: '32px 36px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>🛡️</div>
                <p style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: .5 }}>WARRANTY CERTIFICATE</p>
                <p style={{ margin: '4px 0 0', color: '#c4b5fd', fontSize: 12 }}>Official Warranty Document</p>
                <div style={{ display: 'inline-block', margin: '14px auto 0', background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 8, padding: '8px 24px', color: '#fff', fontFamily: 'monospace', fontSize: 18, letterSpacing: 2 }}>
                  {warranty.warrantyCode}
                </div>
                <p style={{ margin: '10px 0 0', color: '#c4b5fd', fontSize: 11 }}>Issued: {formatDate(warranty.createdAt)}</p>
              </div>
              {/* Body */}
              <div style={{ padding: '24px 36px' }}>
                {/* Customer */}
                <p style={{ margin: '0 0 8px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#7c3aed', fontWeight: 700 }}>Customer Details</p>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  {[{ label: 'Name', value: warranty.customerName }, { label: 'Phone', value: warranty.customerPhone }].map(({ label, value }) => (
                    <div key={label} style={{ flex: 1, background: '#f8f5ff', border: '1px solid #ede9fe', borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ margin: '0 0 3px', fontSize: 9, color: '#8b5cf6' }}>{label}</p>
                      <p style={{ margin: 0, fontSize: 13, color: '#1e1b4b', fontWeight: 600 }}>{value}</p>
                    </div>
                  ))}
                </div>
                {/* Product */}
                <p style={{ margin: '0 0 8px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#7c3aed', fontWeight: 700 }}>Product Details</p>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  {[{ label: 'Product', value: warranty.productName }, { label: 'Brand', value: warranty.brandName || '—' }].map(({ label, value }) => (
                    <div key={label} style={{ flex: 1, background: '#f8f5ff', border: '1px solid #ede9fe', borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ margin: '0 0 3px', fontSize: 9, color: '#8b5cf6' }}>{label}</p>
                      <p style={{ margin: 0, fontSize: 13, color: '#1e1b4b', fontWeight: 600 }}>{value}</p>
                    </div>
                  ))}
                </div>
                {warranty.imei && (
                  <div style={{ background: '#f8f5ff', border: '1px solid #ede9fe', borderRadius: 8, padding: '10px 12px', marginBottom: 20 }}>
                    <p style={{ margin: '0 0 3px', fontSize: 9, color: '#8b5cf6' }}>IMEI / Serial</p>
                    <p style={{ margin: 0, fontSize: 13, color: '#1e1b4b', fontWeight: 600, fontFamily: 'monospace' }}>{warranty.imei}</p>
                  </div>
                )}
                {/* Dates */}
                <p style={{ margin: '0 0 8px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#16a34a', fontWeight: 700 }}>Warranty Period</p>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 18px' }}>
                  {[{ label: 'Start Date', value: formatDate(warranty.startDate) }, { label: 'End Date', value: formatDate(warranty.endDate) }, { label: 'Duration', value: `${warranty.monthsDuration} months` }].map(({ label, value }) => (
                    <div key={label} style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 2px', fontSize: 9, color: '#16a34a' }}>{label}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#14532d', fontWeight: 700 }}>{value}</p>
                    </div>
                  ))}
                </div>
                {warranty.invoiceNumber && (
                  <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px' }}>Invoice: <strong>{warranty.invoiceNumber}</strong></p>
                )}
              </div>
              {/* Footer */}
              <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '16px 36px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>This is an official warranty certificate. Keep this document safe and present it when making a warranty claim.</p>
              </div>
            </div>
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
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <div>
            <p className="text-[10px] font-mono text-violet-400">{warranty.warrantyCode}</p>
            <h3 className="text-sm font-bold text-white">Edit Warranty</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
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
                <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
                <input required={req} className="input-field" value={(form as any)[k]} onChange={f(k)} />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Start Date</label>
              <input type="date" className="input-field" value={form.startDate} onChange={f('startDate')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">End Date</label>
              <input type="date" className="input-field" value={form.endDate} onChange={f('endDate')} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Duration (Months)</label>
              <select className="input-field" value={form.monthsDuration} onChange={f('monthsDuration')}>
                {[1,3,6,12,18,24,36].map(m => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Status</label>
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
  const { data: warrantyData, loading, refetch } = useWarranties()
  const [tab, setTab]                     = useState<'all' | 'expiring' | 'claimed'>('all')
  const [showAdd,   setShowAdd]           = useState(false)
  const [viewW,     setViewW]             = useState<Warranty | null>(null)
  const [editW,     setEditW]             = useState<Warranty | null>(null)
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const warranties: Warranty[] = (warrantyData?.data ?? []) as Warranty[]

  const now        = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expiringCount = warranties.filter((w: Warranty) => new Date(w.endDate) <= thirtyDays && w.status === 'ACTIVE').length

  const tabFiltered = warranties.filter((w: Warranty) => {
    if (tab === 'expiring') return new Date(w.endDate) <= thirtyDays && w.status === 'ACTIVE'
    if (tab === 'claimed')  return w.status === 'CLAIMED'
    return true
  })

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
        <div className="flex items-center gap-2">
          <Shield size={13} className="text-violet-400 flex-shrink-0" />
          <span className="text-xs font-mono text-violet-300">{row.original.warrantyCode}</span>
        </div>
      ),
    },
    {
      accessorKey: 'productName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
      cell: ({ row }) => (
        <div>
          <p className="text-sm text-slate-200 truncate max-w-[180px]">{row.original.productName}</p>
          {(row.original as any).imei && <p className="text-xs text-slate-600 font-mono">{(row.original as any).imei}</p>}
        </div>
      ),
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div>
          <p className="text-sm text-slate-300">{row.original.customerName}</p>
          <p className="text-xs text-slate-500">{(row.original as any).customerPhone}</p>
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
            <span className={`text-xs ${isExpiring ? 'text-yellow-400 font-semibold' : 'text-slate-400'}`}>{formatDate(row.original.endDate)}</span>
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
          showAction={{ action: () => setViewW(row.original) }}
          editAction={{ action: () => setEditW(row.original) }}
          deleteAction={{ action: () => handleDelete(row.original), disabled: deletingId === row.original.id }}
        />
      ),
    },
  ], [deletingId, handleDelete])

  return (
    <div className="space-y-6">
      {showAdd  && <AddWarrantyModal onClose={() => setShowAdd(false)} onSaved={() => { refetch(); setShowAdd(false) }} />}
      {viewW    && <WarrantyDetailsModal warranty={viewW} onClose={() => setViewW(null)} onEdit={() => { setEditW(viewW); setViewW(null) }} onDelete={() => handleDelete(viewW)} />}
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: warranties.length,                                                  color: 'text-violet-400' },
          { label: 'Active',      value: warranties.filter((w: Warranty) => w.status === 'ACTIVE').length,  color: 'text-green-400'  },
          { label: 'Expiring 30d',value: expiringCount,                                                      color: 'text-yellow-400' },
          { label: 'Claimed',     value: warranties.filter((w: Warranty) => w.status === 'CLAIMED').length, color: 'text-blue-400'   },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/3 p-1 rounded-xl w-fit">
        {[['all', 'All'], ['expiring', `Expiring (${expiringCount})`], ['claimed', 'Claims']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${tab === key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <ClientSideTable
        data={tabFiltered}
        columns={columns}
        isLoading={loading}
        pageCount={Math.ceil((tabFiltered.length || 1) / 20)}
        searchableColumns={[
          { id: 'warrantyCode',  title: 'Code'     },
          { id: 'customerName', title: 'Customer' },
          { id: 'productName',  title: 'Product'  },
        ]}
        filterableColumns={[{
          id: 'status',
          title: 'Status',
          options: [
            { label: 'Active',  value: 'ACTIVE'  },
            { label: 'Claimed', value: 'CLAIMED' },
            { label: 'Void',    value: 'VOID'    },
            { label: 'Expired', value: 'EXPIRED' },
          ],
        }]}
      />
    </div>
  )
}
