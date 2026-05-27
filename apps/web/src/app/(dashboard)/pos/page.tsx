'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Search, Plus, Minus, CreditCard, Banknote, Smartphone, Receipt,
  ScanLine, X, Loader2, UserPlus, Edit2, Check, Download, Tag, Printer,
  Heart, Trash2, ChevronRight, ChevronLeft, ChevronDown, Gift, Archive,
  FileText, FilePlus2, Calculator, SlidersHorizontal, Package, Tablet,
  Headphones, Wrench, PackageSearch, ShoppingBag, User, CheckCircle2, Shield,
} from 'lucide-react'
import { useProducts, useFeatureFlag } from '@/lib/hooks'
import { salesApi, customersApi, productsApi, imeiApi, warrantyApi, servicesApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { getInvoiceSettings, fetchInvoiceSettings, type InvoiceSettings } from '@/lib/invoiceSettings'
import InvoicePrint, { type InvoiceData } from '@/components/invoice/InvoicePrint'
import { printThermalReceipt } from '@/components/invoice/ThermalReceipt'

interface CartItem {
  cartId: string
  productId: string | null
  name: string
  sku: string
  price: number
  originalPrice: number
  quantity: number
  imei?: string
  isService?: boolean
}

/* ── Invoice Template ───────────────────────────────────────────────────── */
const IV = {
  hdr:    '#0d2b22',
  teal:   '#00c896',
  teal2:  '#00a87e',
  dark:   '#0f1f18',
  body:   '#ffffff',
  light:  '#f4faf7',
  border: '#d6ede6',
  muted:  '#5a7a6e',
  row1:   '#ffffff',
  row2:   '#f0faf5',
}

function InvoiceTemplate({ sale, shopName, settings }: { sale: any; shopName: string; settings: InvoiceSettings }) {
  const fc = formatCurrency
  const now = sale.createdAt ? new Date(sale.createdAt) : new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const displayName = settings.shopName || shopName
  const isPaid = !sale.dueAmount || sale.dueAmount === 0

  return (
    <div style={{ width: 740, background: IV.body, fontFamily: "'Segoe UI', system-ui, Arial, sans-serif", color: IV.dark, boxShadow: '0 0 0 1px #d6ede6' }}>

      {/* ═══ TOP ACCENT BAR ════════════════════════════════════════════════ */}
      <div style={{ height: 5, background: `linear-gradient(90deg, ${IV.teal} 0%, ${IV.teal2} 100%)` }} />

      {/* ═══ HEADER ════════════════════════════════════════════════════════ */}
      <div style={{ background: IV.hdr, padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Left — Brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: IV.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 900 }}>{displayName.charAt(0).toUpperCase()}</span>
            </div>
            <p style={{ margin: 0, color: '#ffffff', fontSize: 22, fontWeight: 800, letterSpacing: 0.3 }}>{displayName}</p>
          </div>
          <p style={{ margin: 0, color: '#6aaf96', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>{settings.slogan || 'Sales & Service'}</p>
          {(settings.phone || settings.email) && (
            <p style={{ margin: '8px 0 0', color: '#3d6b5a', fontSize: 10 }}>
              {settings.phone}{settings.phone && settings.email ? '  ·  ' : ''}{settings.email}
            </p>
          )}
        </div>
        {/* Right — Invoice ID */}
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, color: IV.teal, fontSize: 32, fontWeight: 900, letterSpacing: 2, lineHeight: 1 }}>INVOICE</p>
          <p style={{ margin: '8px 0 0', color: '#9dd4bf', fontSize: 12, fontFamily: 'monospace', letterSpacing: 0.5 }}>{sale.invoiceNumber}</p>
          <p style={{ margin: '3px 0 0', color: '#3d6b5a', fontSize: 10 }}>{dateStr} · {timeStr}</p>
        </div>
      </div>

      {/* ═══ META STRIP ════════════════════════════════════════════════════ */}
      <div style={{ background: IV.light, borderTop: `3px solid ${IV.teal}`, borderBottom: `1px solid ${IV.border}`, padding: '14px 40px', display: 'flex', gap: 40, alignItems: 'center' }}>
        {[
          { label: 'Issue Date', value: dateStr },
          { label: 'Cashier',    value: sale.cashierName || '—' },
          { label: 'Payment',    value: sale.payments?.map((p: any) => p.method).join(' + ') || '—' },
        ].map(({ label, value }) => (
          <div key={label}>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: IV.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 600, color: IV.dark }}>{value}</p>
          </div>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: isPaid ? IV.teal : '#f59e0b',
            color: '#fff', fontSize: 10, fontWeight: 800,
            padding: '5px 14px', borderRadius: 99, letterSpacing: 1,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', display: 'inline-block' }} />
            {isPaid ? 'PAID' : 'PARTIAL'}
          </span>
        </div>
      </div>

      {/* ═══ BILL FROM / BILL TO ═══════════════════════════════════════════ */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${IV.border}` }}>
        {[
          {
            label: 'Bill From',
            name: displayName,
            lines: [settings.address, settings.phone, settings.email].filter(Boolean),
            color: IV.teal,
          },
          {
            label: 'Bill To',
            name: sale.customerName || 'Walk-in Customer',
            lines: [sale.customerPhone].filter(Boolean),
            color: '#6366f1',
          },
        ].map((col, i) => (
          <div key={i} style={{ flex: 1, padding: '20px 40px', borderRight: i === 0 ? `1px solid ${IV.border}` : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, background: col.color }} />
              <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: col.color, textTransform: 'uppercase', letterSpacing: 1.2 }}>{col.label}</p>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: IV.dark }}>{col.name}</p>
            {col.lines.map((line, j) => (
              <p key={j} style={{ margin: '2px 0', fontSize: 11, color: IV.muted }}>{line}</p>
            ))}
          </div>
        ))}
      </div>

      {/* ═══ ITEMS TABLE ═══════════════════════════════════════════════════ */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: IV.hdr }}>
            <th style={{ padding: '11px 40px', color: '#6aaf96', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left', width: '45%' }}>Description</th>
            <th style={{ padding: '11px 16px', color: '#6aaf96', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>Unit Price</th>
            <th style={{ padding: '11px 16px', color: '#6aaf96', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>Qty</th>
            <th style={{ padding: '11px 40px 11px 16px', color: IV.teal, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items?.map((item: any, idx: number) => (
            <tr key={item.id ?? idx} style={{ background: idx % 2 === 0 ? IV.row1 : IV.row2, borderBottom: `1px solid ${IV.border}` }}>
              <td style={{ padding: '13px 40px' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: IV.dark }}>{item.productName}</p>
                {(item.sku || item.imei) && (
                  <p style={{ margin: '3px 0 0', fontSize: 9.5, color: IV.muted, fontFamily: 'monospace' }}>
                    {item.sku && `SKU: ${item.sku}`}{item.imei ? '  ·  IMEI: ' + item.imei : ''}
                  </p>
                )}
              </td>
              <td style={{ padding: '13px 16px', fontSize: 12, color: IV.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>{fc(item.unitPrice)}</td>
              <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                <span style={{ display: 'inline-block', background: `${IV.teal}20`, color: IV.teal2, fontWeight: 800, fontSize: 11, padding: '2px 10px', borderRadius: 99 }}>{item.quantity}</span>
              </td>
              <td style={{ padding: '13px 40px 13px 16px', fontSize: 13, fontWeight: 700, color: IV.dark, textAlign: 'right', whiteSpace: 'nowrap' }}>{fc(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ═══ TOTALS + NOTES ROW ════════════════════════════════════════════ */}
      <div style={{ display: 'flex', borderTop: `2px solid ${IV.border}` }}>

        {/* Left — payment note */}
        <div style={{ flex: 1.4, padding: '22px 40px', borderRight: `1px solid ${IV.border}` }}>
          <p style={{ margin: '0 0 10px', fontSize: 9.5, fontWeight: 700, color: IV.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Payment Info</p>
          {sale.payments?.map((p: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: IV.teal, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: IV.dark, fontWeight: 600 }}>{p.method}</span>
              <span style={{ fontSize: 12, color: IV.muted, marginLeft: 'auto' }}>{fc(p.amount)}</span>
            </div>
          ))}
          {settings.bankDetails && (
            <p style={{ margin: '10px 0 0', fontSize: 10, color: IV.muted, lineHeight: 1.6, borderTop: `1px solid ${IV.border}`, paddingTop: 8 }}>{settings.bankDetails}</p>
          )}
        </div>

        {/* Right — totals */}
        <div style={{ flex: 1, padding: '22px 40px', background: IV.light }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: IV.muted }}>
            <span>Subtotal</span>
            <span style={{ fontWeight: 600, color: IV.dark }}>{fc(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#e53935' }}>
              <span>Discount</span>
              <span style={{ fontWeight: 600 }}>− {fc(sale.discount)}</span>
            </div>
          )}
          <div style={{ height: 1, background: IV.border, margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: IV.muted }}>Total due</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: IV.teal }}>{fc(sale.total)}</span>
          </div>
          {sale.dueAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '6px 10px', background: '#fff8ec', borderRadius: 6, fontSize: 11, color: '#b45309', fontWeight: 700 }}>
              <span>Outstanding</span><span>{fc(sale.dueAmount)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ FOOTER ════════════════════════════════════════════════════════ */}
      <div style={{ background: IV.hdr, padding: '14px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 10.5, color: '#6aaf96', fontStyle: 'italic' }}>{settings.footerNote || 'Thank you for your business!'}</p>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {settings.website && <p style={{ margin: 0, fontSize: 9.5, color: '#3d6b5a' }}>{settings.website}</p>}
          {settings.phone   && <p style={{ margin: 0, fontSize: 9.5, color: '#3d6b5a' }}>{settings.phone}</p>}
          <p style={{ margin: 0, fontSize: 9, color: '#1e4035' }}>Powered by Hexalyte</p>
        </div>
      </div>

      {/* ═══ BOTTOM ACCENT BAR ═════════════════════════════════════════════ */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${IV.teal2} 0%, ${IV.teal} 50%, ${IV.teal2} 100%)` }} />
    </div>
  )
}

/* ── Register Customer Modal ─────────────────────────────────────────────── */
function RegisterCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: any) => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name || !form.phone) return toast.error('Name and phone required')
    setLoading(true)
    try {
      const res: any = await customersApi.create(form)
      toast.success('Customer registered')
      onCreated(res?.data)
      onClose()
    } catch (e: any) {
      if (e?.status === 409 || e?.message?.toLowerCase().includes('already')) {
        try {
          const found: any = await customersApi.search(form.phone)
          const existing = found?.data?.[0] ?? found?.[0]
          if (existing) {
            toast.success(`Existing customer selected: ${existing.name}`)
            onCreated(existing)
            onClose()
            return
          }
        } catch { /* fall through */ }
      }
      toast.error(e?.message ?? 'Failed')
    }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <UserPlus size={15} className="text-violet-400" />
            <h3 className="text-sm font-bold text-white">Register Customer</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Full Name *</label>
            <input className="input-field w-full" placeholder="Customer name"
              value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Phone *</label>
            <input className="input-field w-full" placeholder="Phone number"
              value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Email (optional)</label>
            <input className="input-field w-full" placeholder="email@example.com" type="email"
              value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button onClick={submit} disabled={loading} className="btn-primary flex-1 text-sm disabled:opacity-50">
              {loading ? <Loader2 size={13} className="animate-spin mx-auto" /> : 'Register'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main POS Page ──────────────────────────────────────────────────────── */
export default function POSPage() {
  const [cart, setCart]                         = useState<CartItem[]>([])
  const [search, setSearch]                     = useState('')
  const [paymentMethod, setPaymentMethod]       = useState<'CASH' | 'CARD' | 'UPI'>('UPI')
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  const [discountPct, setDiscountPct]           = useState(0)
  const [discountFlat, setDiscountFlat]         = useState(0)
  const [discountMode, setDiscountMode]         = useState<'%' | 'flat'>('%')
  const [completedSale, setCompletedSale]       = useState<any>(null)
  const [checkoutLoading, setCheckoutLoading]   = useState(false)
  const [checkoutError, setCheckoutError]       = useState('')
  const [showRegister, setShowRegister]         = useState(false)
  const [editPriceId, setEditPriceId]           = useState<string | null>(null)
  const [editPriceVal, setEditPriceVal]         = useState('')
  const [downloading, setDownloading]           = useState(false)
  const [showA4Invoice, setShowA4Invoice]       = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [categories, setCategories]             = useState<{ id: string; name: string }[]>([])
  const [services, setServices]                 = useState<any[]>([])
  const [imeiScan, setImeiScan]                 = useState('')
  const [imeiScanning, setImeiScanning]         = useState(false)
  const a4Ref                                   = useRef<HTMLDivElement>(null)

  const [page, setPage]               = useState(1)
  const [perPage, setPerPage]         = useState(15)
  const [favorites, setFavorites]     = useState<Set<string>>(new Set())
  const [showScanInput, setShowScanInput]         = useState(false)
  const [showCustDrop, setShowCustDrop]           = useState(false)
  const [custSearch, setCustSearch]               = useState('')
  const [showRecentInvoices, setShowRecentInvoices] = useState(false)
  const [recentSales, setRecentSales]             = useState<any[]>([])
  const [recentLoading, setRecentLoading]         = useState(false)
  const [showHeldCarts, setShowHeldCarts]         = useState(false)
  const [heldCarts, setHeldCarts]                 = useState<{ id: string; label: string; time: string; items: CartItem[]; customer: any; discountPct: number; discountFlat: number; discountMode: '%'|'flat' }[]>(() => {
    try { return JSON.parse(localStorage.getItem('pos_held_carts') ?? '[]') } catch { return [] }
  })
  const [showDocPreview, setShowDocPreview]       = useState<'QUOTE'|'DRAFT'|null>(null)
  const [addWarranty, setAddWarranty]             = useState(false)
  const [warrantyMonths, setWarrantyMonths]       = useState(12)
  const [showCalc, setShowCalc]                   = useState(false)
  const [mobileView, setMobileView]               = useState<'products' | 'cart'>('products')
  const [isDesktop, setIsDesktop]                 = useState(false)
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const [calcDisplay, setCalcDisplay]             = useState('0')
  const [calcPrev, setCalcPrev]                   = useState<string|null>(null)
  const [calcOp, setCalcOp]                       = useState<string|null>(null)
  const [calcReset, setCalcReset]                 = useState(false)
  const searchRef                                 = useRef<HTMLInputElement>(null)

  const calcInput = (val: string) => {
    if (calcDisplay === '0' || calcReset) { setCalcDisplay(val); setCalcReset(false) }
    else setCalcDisplay(prev => prev.length < 14 ? prev + val : prev)
  }
  const calcDot = () => { if (calcReset) { setCalcDisplay('0.'); setCalcReset(false); return }; if (!calcDisplay.includes('.')) setCalcDisplay(p => p + '.') }
  const calcClear = () => { setCalcDisplay('0'); setCalcPrev(null); setCalcOp(null); setCalcReset(false) }
  const calcBackspace = () => setCalcDisplay(p => p.length > 1 ? p.slice(0,-1) : '0')
  const calcSetOp = (op: string) => { setCalcPrev(calcDisplay); setCalcOp(op); setCalcReset(true) }
  const calcEqual = () => {
    if (!calcOp || calcPrev === null) return
    const a = parseFloat(calcPrev), b = parseFloat(calcDisplay)
    let r = 0
    if (calcOp === '+') r = a + b
    else if (calcOp === '-') r = a - b
    else if (calcOp === '×') r = a * b
    else if (calcOp === '÷') r = b !== 0 ? a / b : 0
    const s = parseFloat(r.toFixed(8)).toString()
    setCalcDisplay(s); setCalcPrev(null); setCalcOp(null); setCalcReset(true)
  }
  const calcPercent = () => setCalcDisplay(p => parseFloat((parseFloat(p) / 100).toFixed(8)).toString())
  const calcSign = () => setCalcDisplay(p => p.startsWith('-') ? p.slice(1) : '-' + p)

  const saveHeldCarts = (list: typeof heldCarts) => {
    setHeldCarts(list)
    localStorage.setItem('pos_held_carts', JSON.stringify(list))
  }

  const holdCart = () => {
    if (cart.length === 0) return
    const id = `HC-${Date.now()}`
    const entry = { id, label: `Cart #${heldCarts.length + 1}`, time: new Date().toISOString(), items: cart, customer: selectedCustomer, discountPct, discountFlat, discountMode }
    saveHeldCarts([entry, ...heldCarts])
    setCart([]); setSelectedCustomer(null); setDiscountPct(0); setDiscountFlat(0)
    toast.success(`Cart held — ${entry.label}`, { icon: '📦' })
  }

  const restoreHeldCart = (entry: typeof heldCarts[0]) => {
    setCart(entry.items)
    setSelectedCustomer(entry.customer)
    setDiscountPct(entry.discountPct)
    setDiscountFlat(entry.discountFlat)
    setDiscountMode(entry.discountMode)
    saveHeldCarts(heldCarts.filter(h => h.id !== entry.id))
    setShowHeldCarts(false)
    toast.success(`${entry.label} restored`)
  }

  const genDocNumber = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*9000+1000)}`

  const fetchRecentSales = async () => {
    setRecentLoading(true)
    try {
      const res: any = await salesApi.list({ limit: '30', sort: 'createdAt', order: 'desc' })
      setRecentSales((res?.data ?? res) as any[])
    } catch { setRecentSales([]) }
    finally { setRecentLoading(false) }
  }

  const openDrawer = () => {
    try {
      const ESC = '\x1B'
      const drawerKick = ESC + 'p' + '\x00' + '\x19' + '\x19'
      const win = window.open('', '_blank', 'width=1,height=1')
      if (win) {
        win.document.write(`<html><body><script>window.onload=function(){window.print();window.close()}<\/script><pre style="font-family:monospace">${drawerKick}</pre></body></html>`)
        win.document.close()
      }
    } catch {}
    toast.success('Cash drawer signal sent', { icon: '🗄️', duration: 2000 })
  }

  const { data: productsData } = useProducts({ limit: '500' })
  const [customers, setCustomers]     = useState<any[]>([])
  const [custLoading, setCustLoading] = useState(false)

  const products: any[] = (productsData as any)?.data ?? []

  const refetchCustomers = useCallback(async () => {
    setCustLoading(true)
    try {
      const res: any = await customersApi.list({ limit: '5000' })
      const raw = res?.data ?? res
      setCustomers(Array.isArray(raw) ? raw : [])
    } catch (e) { console.error('Customer load error:', e); setCustomers([]) }
    finally { setCustLoading(false) }
  }, [])

  useEffect(() => { refetchCustomers() }, [refetchCustomers])

  useEffect(() => {
    if (!custSearch.trim()) return
    const t = setTimeout(async () => {
      try {
        const res: any = await customersApi.search(custSearch.trim())
        const raw = res?.data ?? res
        if (Array.isArray(raw) && raw.length > 0) setCustomers(prev => {
          const ids = new Set(raw.map((c: any) => c.id))
          return [...raw, ...prev.filter((c: any) => !ids.has(c.id))]
        })
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custSearch])

  useEffect(() => {
    productsApi.categories().then((res: any) => {
      const cats = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
      setCategories(cats)
    }).catch(() => {})
  }, [])

  const hasServices = useFeatureFlag('SERVICES')
  useEffect(() => {
    if (hasServices) {
      servicesApi.list({ active: 'true' }).then((res: any) => {
        setServices((res?.data ?? res) ?? [])
      }).catch(() => {})
    }
  }, [hasServices])

  useEffect(() => { setPage(1) }, [search, selectedCategory])

  const filtered = products.filter((p: any) => {
    const matchCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory || p.categoryName === selectedCategory
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const filteredServices = services.filter((s: any) => {
    const matchCat = selectedCategory === 'SERVICES' || selectedCategory === 'ALL'
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const displayItems = selectedCategory === 'SERVICES' ? filteredServices : filtered
  const totalPages    = Math.max(1, Math.ceil(displayItems.length / perPage))
  const pagedProducts = displayItems.slice((page - 1) * perPage, page * perPage)

  const filteredCustomers = custSearch
    ? customers.filter((c: any) => c.name?.toLowerCase().includes(custSearch.toLowerCase()) || c.phone?.includes(custSearch))
    : customers

  const getCategoryIcon = (name: string) => {
    const n = (name ?? '').toLowerCase()
    if (n.includes('mobile') || n.includes('phone') || n.includes('smartphone')) return Smartphone
    if (n.includes('accessor') || n.includes('earphone') || n.includes('headphone') || n.includes('audio')) return Headphones
    if (n.includes('part') || n.includes('battery') || n.includes('screen') || n.includes('display') || n.includes('repair')) return Wrench
    if (n.includes('tablet') || n.includes('ipad')) return Tablet
    return Package
  }

  const isImeiProduct = (product: any) => {
    const cat = (product.categoryName ?? '').toLowerCase()
    return cat.includes('mobile') || cat.includes('phone') || cat.includes('smartphone') || cat.includes('tablet')
  }

  const getProductCardStyle = (product: any) => {
    const cat = (product.categoryName ?? '').toLowerCase()
    if (cat.includes('mobile') || cat.includes('phone') || cat.includes('smartphone'))
      return { gradient: 'linear-gradient(135deg, #3b1fa5 0%, #1d2fb5 100%)', iconColor: '#818cf8', Icon: Smartphone }
    if (cat.includes('tablet') || cat.includes('ipad'))
      return { gradient: 'linear-gradient(135deg, #0e4f6e 0%, #0e6e5a 100%)', iconColor: '#34d399', Icon: Tablet }
    if (cat.includes('accessor') || cat.includes('earphone') || cat.includes('headphone') || cat.includes('audio'))
      return { gradient: 'linear-gradient(135deg, #5b1fa5 0%, #8b1fa5 100%)', iconColor: '#c084fc', Icon: Headphones }
    if (cat.includes('part') || cat.includes('battery') || cat.includes('screen') || cat.includes('display'))
      return { gradient: 'linear-gradient(135deg, #7c2d12 0%, #a16207 100%)', iconColor: '#fb923c', Icon: Wrench }
    return { gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', iconColor: '#64748b', Icon: Package }
  }

  const addToCart = (product: any, imei?: string) => {
    const price = product.sellingPrice ?? product.price
    const isService = product.sellingPrice === undefined && product.price !== undefined
    setCart(prev => {
      if (!imei) {
        const existing = prev.find(i => i.productId === (isService ? null : product.id) && i.name === product.name && !i.imei)
        if (existing) return prev.map(i => i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { cartId: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, productId: isService ? null : product.id, name: product.name, sku: product.sku ?? product.category ?? '', price, originalPrice: price, quantity: 1, imei, isService }]
    })
  }

  const handleImeiScan = async (scanned: string) => {
    const imei = scanned.trim()
    if (!imei) return
    setImeiScanning(true)
    try {
      const res: any = await imeiApi.lookup(imei)
      const rec = res?.data?.record
      const productId = rec?.productId
      const product = products.find((p: any) => p.id === productId)
      if (product) {
        addToCart(product, imei)
        toast.success(`Added: ${product.name} — IMEI linked`)
      } else {
        const targetIdx = cart.findIndex(i => !i.imei)
        if (targetIdx !== -1) {
          setCart(prev => prev.map((item, idx) => idx === targetIdx ? { ...item, imei } : item))
          toast(`IMEI attached to ${cart[targetIdx].name}`)
        } else {
          toast.error('IMEI not found. Add a product to cart first, then scan.')
        }
      }
    } catch {
      const targetIdx = cart.findIndex(i => !i.imei)
      if (targetIdx !== -1) {
        setCart(prev => prev.map((item, idx) => idx === targetIdx ? { ...item, imei } : item))
        toast(`IMEI attached to ${cart[targetIdx].name}`)
      } else {
        toast.error('IMEI not registered. Add a product to cart first.')
      }
    } finally {
      setImeiScanning(false)
      setImeiScan('')
    }
  }

  const updateQty = (cartId: string, delta: number) =>
    setCart(prev => prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0))

  const setQty = (cartId: string, qty: number) =>
    setCart(prev => prev.map(i => i.cartId === cartId ? { ...i, quantity: Math.max(1, qty) } : i))

  const saveEditPrice = (cartId: string) => {
    const val = parseFloat(editPriceVal)
    if (!isNaN(val) && val > 0) setCart(prev => prev.map(i => i.cartId === cartId ? { ...i, price: val } : i))
    setEditPriceId(null)
  }

  const subtotal       = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const discountAmount = discountMode === '%' ? (subtotal * discountPct) / 100 : Math.min(discountFlat, subtotal)
  const afterDiscount  = subtotal - discountAmount
  const tax            = 0
  const total          = afterDiscount

  const currentUser = authStorage.getUser()
  const shopName = currentUser?.name?.split(' ')[0] + ' Shop' || 'Our Shop'
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() => getInvoiceSettings())

  useEffect(() => {
    if (!currentUser?.tenantId) return
    fetchInvoiceSettings(currentUser.tenantId).then(s => setInvoiceSettings(s)).catch(() => {})
  }, [currentUser?.tenantId])

  useEffect(() => {
    if (!completedSale) return
    const timer = setTimeout(() => { downloadInvoice() }, 400)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSale])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select() }
      if (e.key === 'F12') { e.preventDefault(); setShowCalc(p => !p) }
      if (e.key === 'F6') { e.preventDefault(); setShowHeldCarts(true) }
      if (e.key === 'F7') { e.preventDefault(); if (cart.length > 0) setShowDocPreview('QUOTE') }
      if (e.key === 'F8') { e.preventDefault(); if (cart.length > 0) setShowDocPreview('DRAFT') }
      if (e.key === 'F9' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault()
        if (cart.length > 0 && !checkoutLoading && !completedSale) handleCheckout()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, checkoutLoading, completedSale])

  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (addWarranty && !selectedCustomer) {
      setCheckoutError('Please select a customer to add warranty')
      return
    }
    setCheckoutLoading(true)
    setCheckoutError('')
    try {
      const user = authStorage.getUser()
      const res: any = await salesApi.create({
        branchId:      user?.branchIds?.[0],
        customerId:    selectedCustomer?.id || undefined,
        customerName:  selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone || '',
        subtotal,
        discount:      discountAmount,
        tax,
        total,
        paidAmount:    total,
        dueAmount:     0,
        status:        'PAID',
        items: cart.map(i => ({
          productId:   i.isService ? undefined : i.productId,
          productName: i.name,
          sku:         i.sku,
          quantity:    i.quantity,
          unitPrice:   i.price,
          total:       i.price * i.quantity,
          imei:        i.imei,
        })),
        payments: [{ method: paymentMethod, amount: total }],
      })
      // ── Create warranties if user opted in ──
      const createdWarrantyCodes: string[] = []
      if (addWarranty && cart.length > 0) {
        const start = new Date()
        const end   = new Date(start)
        end.setMonth(end.getMonth() + warrantyMonths)
        for (const item of cart) {
          try {
            const prod = products.find((p: any) => p.id === item.productId)
            const w: any = await warrantyApi.create({
              customerId:     selectedCustomer?.id,
              customerName:   selectedCustomer?.name  || 'Walk-in Customer',
              customerPhone:  selectedCustomer?.phone || '',
              productId:      item.productId,
              productName:    item.name,
              brandName:      prod?.brandName || prod?.brand || '',
              imei:           item.imei   || '',
              saleId:         res.data?.id || '',
              invoiceNumber:  res.data?.invoiceNumber || '',
              startDate:      start.toISOString(),
              endDate:        end.toISOString(),
              monthsDuration: warrantyMonths,
            })
            const code = w?.data?.warrantyCode || w?.warrantyCode
            if (code) createdWarrantyCodes.push(code)
          } catch (e) { console.error('Warranty creation failed:', e) }
        }
        if (createdWarrantyCodes.length > 0)
          toast.success(`${createdWarrantyCodes.length} warranty${createdWarrantyCodes.length > 1 ? 's' : ''} created`, { icon: '🛡️' })
      }
      setMobileView('cart')
      setCompletedSale({
        ...res.data,
        items: cart.map(i => ({ productName: i.name, sku: i.sku, imei: i.imei, quantity: i.quantity, unitPrice: i.price, total: i.price * i.quantity })),
        payments: [{ method: paymentMethod, amount: total }],
        customerName:  selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone || '',
        cashierName:   user?.name || 'Staff',
        warrantyNumbers: createdWarrantyCodes,
        warrantyMonths:  addWarranty ? warrantyMonths : undefined,
      })
    } catch (e: any) {
      setCheckoutError(e.message || 'Checkout failed')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const buildA4Data = (): InvoiceData | null => {
    if (!completedSale) return null
    const s = invoiceSettings
    return {
      companyName:     s.shopName    || shopName,
      companySlogan:   s.slogan      || 'Sales & Service',
      companyLogo:     s.logo        || undefined,
      companyAddress:  s.address     || '',
      companyPhone:    s.phone       || '',
      companyEmail:    s.email       || '',
      companyWebsite:  s.website     || '',
      invoiceNumber:   completedSale.invoiceNumber || `INV-${Date.now()}`,
      dueDate:         completedSale.createdAt
        ? new Date(completedSale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      customerName:    completedSale.customerName  || 'Walk-in Customer',
      customerEmail:   completedSale.customerEmail || '',
      customerAddress: completedSale.customerPhone ? `Phone: ${completedSale.customerPhone}` : '',
      items: completedSale.items?.map((i: any) => ({
        description: i.productName,
        details:     i.sku ? `SKU: ${i.sku}${i.imei ? '  ·  IMEI: ' + i.imei : ''}` : undefined,
        price:       i.unitPrice,
        qty:         i.quantity,
      })) ?? [],
      bankName:  s.bankName  || '',
      accNumber: s.accNumber || '',
      accHolder: s.accHolder || s.shopName || shopName,
      swiftCode: s.swiftCode || '',
      currency:      s.currency     || 'LKR',
      taxRate:       s.taxRate      ?? 0,
      discountRate:  subtotal > 0 ? Math.round((discountAmount / subtotal) * 100) : (s.discountRate ?? 0),
      terms:         [
        ...(s.terms?.length ? s.terms : [
          'Payment is due upon receipt of this invoice.',
          'All sales are final unless otherwise agreed.',
          s.footerNote || 'Thank you for your business!',
        ]),
        ...(completedSale.warrantyNumbers?.length
          ? [`Warranty: ${completedSale.warrantyNumbers.join(', ')} (${completedSale.warrantyMonths} months)`]
          : []),
      ],
      signatoryName:  s.signatoryName  || s.shopName || shopName,
      signatoryTitle: s.signatoryTitle || 'Authorized Signatory',
    }
  }

  const downloadInvoice = async () => {
    if (!a4Ref.current) return
    setDownloading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { jsPDF }               = await import('jspdf')
      const A4_W_MM = 210, A4_H_MM = 297
      const canvas = await html2canvas(a4Ref.current, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
      })
      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const imgH_MM = (canvas.height / canvas.width) * A4_W_MM
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      if (imgH_MM <= A4_H_MM) {
        pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, imgH_MM)
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
      pdf.save(`Invoice_${completedSale?.invoiceNumber}.pdf`)
      toast.success('Invoice downloaded')
    } catch { toast.error('Download failed') }
    finally { setDownloading(false) }
  }

  const handleNewSale = () => {
    setCart([]); setCompletedSale(null); setSearch('')
    setDiscountPct(0); setDiscountFlat(0); setSelectedCustomer(null); setCheckoutError('')
    setAddWarranty(false); setWarrantyMonths(12); setMobileView('products')
  }

  const handleCustomerCreated = useCallback((c: any) => {
    refetchCustomers?.()
    setSelectedCustomer(c)
  }, [refetchCustomers])

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 4.5rem)' }}>
      {/* Modals */}
      {showRegister && <RegisterCustomerModal onClose={() => setShowRegister(false)} onCreated={handleCustomerCreated} />}
      {showA4Invoice && completedSale && (() => {
        const a4Data = buildA4Data()
        if (!a4Data) return null
        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-[#0a0f1a]/95 border-b border-white/10 backdrop-blur">
              <div className="flex items-center gap-2">
                <Receipt size={15} className="text-violet-400" />
                <span className="text-sm font-bold text-white">A4 Invoice</span>
                <span className="text-xs text-slate-500 font-mono">{completedSale.invoiceNumber}</span>
              </div>
              <button onClick={() => setShowA4Invoice(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded-lg border border-white/10 transition-colors">
                <X size={13} /> Close
              </button>
            </div>
            <InvoicePrint data={a4Data} />
          </div>
        )
      })()}

      {/* ══ TOP BAR ══ */}
      <div className="flex flex-wrap items-center gap-2 px-3 md:px-4 py-2 flex-shrink-0" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="relative w-full md:flex-1" style={{ minWidth: 0 }}>
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          <input ref={searchRef} type="text" placeholder="Search products, SKU, IMEI…"
            className="w-full h-9 pl-10 pr-9 rounded-xl border text-sm outline-none"
            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            value={search} onChange={e => setSearch(e.target.value)} />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] px-1 py-0.5 rounded border pointer-events-none hidden md:block" style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>F1</kbd>
        </div>
        {showScanInput ? (
          <div className="relative flex-shrink-0">
            <ScanLine size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
            <input autoFocus type="text" placeholder="Scan IMEI…"
              className="pl-8 w-40 h-9 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(59,130,246,.4)', color: 'var(--text-primary)' }}
              value={imeiScan} onChange={e => setImeiScan(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { handleImeiScan(imeiScan); setShowScanInput(false) } if (e.key === 'Escape') { setShowScanInput(false); setImeiScan('') } }}
              onBlur={() => { if (!imeiScan) setShowScanInput(false) }} />
            {imeiScanning && <Loader2 size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-blue-400" />}
          </div>
        ) : (
          <button onClick={() => setShowScanInput(true)}
            className="h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 flex-shrink-0"
            style={{ background: 'rgba(59,130,246,.08)', borderColor: 'rgba(59,130,246,.25)', color: '#60a5fa' }}>
            <ScanLine size={13} />Scan
          </button>
        )}
        <div className="relative flex-shrink-0">
          <button onClick={() => { setShowCustDrop(o => !o); setCustSearch('') }}
            className="h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-medium"
            style={{ background: selectedCustomer ? 'rgba(139,92,246,.1)' : 'var(--bg-subtle)', borderColor: selectedCustomer ? 'rgba(139,92,246,.35)' : 'var(--border-default)', color: 'var(--text-primary)' }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
              style={{ background: selectedCustomer ? 'rgba(139,92,246,.25)' : 'var(--bg-card)', color: selectedCustomer ? '#c4b5fd' : 'var(--text-muted)' }}>
              {selectedCustomer ? selectedCustomer.name[0]?.toUpperCase() : <User size={9} />}
            </div>
            <span className="max-w-[90px] truncate">{selectedCustomer ? selectedCustomer.name : 'Walk-in'}</span>
            <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} />
          </button>
          {showCustDrop && (
            <div className="absolute top-full mt-1.5 right-0 z-40 w-64 rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div className="p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <input autoFocus className="input-field text-xs py-1.5 w-full" placeholder="Search customer…" value={custSearch} onChange={e => setCustSearch(e.target.value)} />
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                <button onClick={() => { setSelectedCustomer(null); setShowCustDrop(false); setAddWarranty(false) }} className="w-full px-3 py-2.5 text-xs text-left border-b transition-colors hover:bg-violet-500/5" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>Walk-in Customer</button>
                <button onClick={() => { setShowCustDrop(false); setShowRegister(true) }} className="w-full px-3 py-2 text-xs text-left border-b flex items-center gap-1.5 transition-colors hover:bg-violet-500/5" style={{ color: '#a78bfa', borderColor: 'var(--border-subtle)' }}><Plus size={10} />New Customer</button>
                {custLoading ? <div className="flex items-center justify-center py-5 gap-2"><Loader2 size={13} className="animate-spin text-violet-400" /><span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</span></div>
                  : filteredCustomers.length === 0 ? <div className="flex items-center justify-center py-4"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{custSearch ? 'No results' : 'No customers'}</p></div>
                  : filteredCustomers.slice(0, 100).map((c: any) => (
                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustDrop(false) }} className="w-full px-3 py-2 text-left border-b transition-colors hover:bg-violet-500/5" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-violet-500/15 text-violet-400 text-[9px] font-extrabold flex items-center justify-center flex-shrink-0">{c.name?.[0]?.toUpperCase()}</div>
                        <div><p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</p><p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.phone}</p></div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
        <div className="w-px h-5 flex-shrink-0" style={{ background: 'var(--border-subtle)' }} />
        <button onClick={() => { setShowRecentInvoices(true); fetchRecentSales() }} className="h-9 w-9 rounded-xl border flex items-center justify-center flex-shrink-0 hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }} title="Recent Invoices"><Receipt size={14} /></button>
        <button onClick={() => setShowHeldCarts(true)} className="relative h-9 w-9 rounded-xl border flex items-center justify-center flex-shrink-0 hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }} title="Held Carts">
          <Archive size={14} />{heldCarts.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">{heldCarts.length}</span>}
        </button>
        <button onClick={() => setShowCalc(p => !p)} className="h-9 w-9 rounded-xl border flex items-center justify-center flex-shrink-0 transition-all" style={{ background: showCalc ? 'rgba(139,92,246,.12)' : 'var(--bg-subtle)', borderColor: showCalc ? 'rgba(139,92,246,.35)' : 'var(--border-default)', color: showCalc ? '#a78bfa' : 'var(--text-muted)' }} title="Calculator (F12)"><Calculator size={14} /></button>
      </div>

      {/* ── MAIN AREA: Products + Cart ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Products Panel ── */}
        <div className="flex-1 flex-col min-w-0 overflow-hidden"
          style={{ display: isDesktop || mobileView === 'products' ? 'flex' : 'none' }}>

          {/* ── Category Bar ── */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-b flex-shrink-0 overflow-x-auto scrollbar-none" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
            {[
              { id: 'ALL', name: 'All', icon: Package },
              ...(hasServices ? [{ id: 'SERVICES', name: 'Services', icon: Wrench }] : []),
              ...categories.map(c => ({ ...c, icon: getCategoryIcon(c.name) }))
            ].map(({ id, name, icon: Icon }) => (
              <button key={id} onClick={() => setSelectedCategory(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0 whitespace-nowrap"
                style={selectedCategory === id
                  ? { background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', color: '#fff', boxShadow: '0 2px 10px rgba(124,58,237,.35)', border: 'none' }
                  : { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <Icon size={11} />{name}
              </button>
            ))}
            <span className="ml-auto text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{displayItems.length} items</span>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
            {pagedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 opacity-30">
                <PackageSearch size={32} className="text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">{selectedCategory === 'SERVICES' ? 'No services found' : products.length === 0 ? 'Loading products…' : 'No products found'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {pagedProducts.map((item: any) => {
                  const isService = selectedCategory === 'SERVICES'
                  const isLow  = !isService && item.stock > 0 && item.stock <= 4
                  const isHot  = !isService && item.stock >= 25
                  const isOut  = !isService && item.stock === 0
                  const { gradient, iconColor, Icon: CardIcon } = isService ? { gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)', iconColor: '#34d399', Icon: Wrench } : getProductCardStyle(item)
                  const initials = (item.name as string).split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                  const isFav  = favorites.has(item.id)
                  return (
                    <div key={item.id}
                      className={`relative flex flex-col rounded-2xl overflow-hidden border transition-all group cursor-pointer select-none ${isOut ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5'}`}
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
                      onClick={() => !isOut && addToCart(item)}>

                      {/* ── IMAGE ZONE ── */}
                      <div className="relative overflow-hidden" style={{ paddingBottom: '72%' }}>
                        {/* Gradient bg (always rendered as fallback) */}
                        <div className="absolute inset-0" style={{ background: gradient }}>
                          {/* Shine */}
                          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 65% 20%, rgba(255,255,255,0.18) 0%, transparent 55%)' }} />
                          {/* Grid pattern overlay */}
                          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                        </div>

                        {item.imageUrl ? (
                          /* Actual product photo */
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          /* Icon + initials centred fallback */
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(4px)' }}>
                              <CardIcon size={22} style={{ color: iconColor }} />
                            </div>
                            <span className="text-[11px] font-extrabold tracking-widest" style={{ color: iconColor, opacity: 0.55 }}>{initials}</span>
                          </div>
                        )}

                        {/* Hover "add" overlay */}
                        {!isOut && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.32)' }}>
                            <div className="w-11 h-11 rounded-full flex items-center justify-center border-2 border-white/60" style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)' }}>
                              <Plus size={20} className="text-white" />
                            </div>
                          </div>
                        )}

                        {/* HOT / LOW STOCK badge */}
                        {isHot && !isLow && (
                          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide" style={{ background: 'linear-gradient(90deg,#f97316,#ef4444)', color: '#fff', boxShadow: '0 2px 8px rgba(239,68,68,.5)' }}>
                            🔥 HOT
                          </div>
                        )}
                        {isLow && (
                          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide border border-red-400/40" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                            ⚠ LOW STOCK
                          </div>
                        )}

                        {/* Favourite button */}
                        <button type="button" onClick={e => { e.stopPropagation(); setFavorites(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n }) }}
                          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${isFav ? 'opacity-100 bg-red-500/30 text-red-400' : 'opacity-0 group-hover:opacity-100 bg-black/30 text-white/70 hover:text-red-400'}`}>
                          <Heart size={12} fill={isFav ? 'currentColor' : 'none'} />
                        </button>

                      </div>

                      {/* ── INFO ZONE ── */}
                      <div className="flex flex-col p-2.5 gap-1">
                        <p className="text-[11px] font-bold leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          <div>
                            <p className="text-sm font-extrabold" style={{ color: '#a78bfa' }}>{formatCurrency(isService ? item.price : item.sellingPrice)}</p>
                            {!isService && (
                              <p className={`text-[9px] font-semibold flex items-center gap-0.5 ${isOut ? 'text-slate-500' : isLow ? 'text-red-400' : 'text-emerald-400'}`}>
                                <span className={`w-1 h-1 rounded-full inline-block ${isOut ? 'bg-slate-500' : isLow ? 'bg-red-400' : 'bg-emerald-400'}`} />
                                {isOut ? 'Out of stock' : `Qty: ${item.stock}`}
                              </p>
                            )}
                          </div>
                          <button type="button" disabled={isOut}
                            onClick={e => { e.stopPropagation(); if (!isOut) addToCart(item) }}
                            className="w-7 h-7 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30 hover:scale-110 active:scale-95 flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 2px 8px rgba(124,58,237,.4)' }}>
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-2 border-t flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total {displayItems.length} items</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/5 disabled:opacity-30 text-slate-400 transition-colors">
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center border transition-colors ${page === p ? 'bg-violet-500 border-violet-500 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>{p}</button>
                )
              })}
              {totalPages > 5 && page < totalPages - 2 && <>
                <span className="text-slate-600 text-xs px-0.5">…</span>
                <button onClick={() => setPage(totalPages)} className="w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center border border-white/10 text-slate-400 hover:bg-white/5 transition-colors">{totalPages}</button>
              </>}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="w-7 h-7 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/5 disabled:opacity-30 text-slate-400 transition-colors">
                <ChevronRight size={12} />
              </button>
            </div>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}
              className="input-field text-xs py-1 h-7 rounded-lg" style={{ width: 90 }}>
              {[15, 20, 30, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>
        </div>

        {/* ── Cart Panel ── */}
        <div className="flex-col overflow-hidden"
          style={{ display: isDesktop || mobileView === 'cart' ? 'flex' : 'none', width: isDesktop ? 360 : '100%', flexShrink: isDesktop ? 0 : 1, borderLeft: isDesktop ? '1px solid var(--border-subtle)' : 'none', borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>

          {completedSale ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-500/15 border border-green-500/20 flex items-center justify-center">
                    <Check size={13} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Sale Complete</p>
                    <p className="text-[10px] text-slate-500 font-mono">{completedSale.invoiceNumber}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-white">{formatCurrency(total)}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="bg-white/3 rounded-xl border border-white/5 p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Customer</p>
                  <p className="text-xs font-semibold text-slate-200">{completedSale.customerName}</p>
                  {completedSale.customerPhone && <p className="text-[10px] text-slate-500">{completedSale.customerPhone}</p>}
                </div>
                {completedSale.warrantyNumbers?.length > 0 && (
                  <div className="rounded-xl border p-3 space-y-1" style={{ background: 'rgba(245,158,11,.06)', borderColor: 'rgba(245,158,11,.25)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Shield size={12} className="text-amber-400" />
                      <p className="text-[9px] uppercase font-bold tracking-wider text-amber-400">Warranty Certificate</p>
                    </div>
                    {completedSale.warrantyNumbers.map((code: string, i: number) => (
                      <p key={i} className="text-xs font-bold font-mono text-amber-300">{code}</p>
                    ))}
                    <p className="text-[10px] text-amber-500/70">Valid {completedSale.warrantyMonths} month{completedSale.warrantyMonths !== 1 ? 's' : ''} from purchase date</p>
                  </div>
                )}
                <div className="bg-white/3 rounded-xl border border-white/5 overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/5"><p className="text-[10px] text-slate-500 uppercase tracking-wide">Items</p></div>
                  {completedSale.items?.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-white/3 last:border-0">
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{item.productName}</p>
                        <p className="text-[10px] text-slate-500">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                      </div>
                      <p className="text-xs font-bold text-white">{formatCurrency(item.total)}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white/3 rounded-xl border border-white/5 p-3 space-y-1">
                  <div className="flex justify-between text-xs text-slate-400"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-xs text-green-400"><span>Discount</span><span>-{formatCurrency(discountAmount)}</span></div>}
                  <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-white/5"><span>Total</span><span>{formatCurrency(total)}</span></div>
                </div>
              </div>
              <div className="p-4 border-t border-white/5 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowA4Invoice(true)} className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10 transition-colors">
                    <Receipt size={12} /> A4 Invoice
                  </button>
                  <button onClick={() => printThermalReceipt({ invoiceNumber: completedSale.invoiceNumber, createdAt: completedSale.createdAt, customerName: completedSale.customerName, customerPhone: completedSale.customerPhone, items: completedSale.items ?? [], subtotal, discountAmount, total, paymentMethod: completedSale.paymentMethod, cashReceived: completedSale.cashReceived, changeAmount: completedSale.changeAmount, warrantyNumbers: completedSale.warrantyNumbers, warrantyMonths: completedSale.warrantyMonths }, invoiceSettings)} className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">
                    <Printer size={12} /> Thermal Print
                  </button>
                </div>
                <button onClick={downloadInvoice} disabled={downloading} className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 transition-colors disabled:opacity-50">
                  {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {downloading ? 'Generating PDF…' : 'Download Invoice PDF'}
                </button>
                <button onClick={handleNewSale} className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.99]" style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', boxShadow: '0 4px 20px rgba(124,58,237,.4)' }}>+ New Sale</button>
              </div>
              {completedSale && (() => { const d = buildA4Data(); return d ? <div style={{ position: 'fixed', left: '-9999px', top: 0, width: 794, pointerEvents: 'none' }}><InvoicePrint ref={a4Ref} data={d} hideControls /></div> : null })()}
            </div>
          ) : (
            <>
              {/* Cart Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMobileView('products')} className="md:hidden flex items-center gap-1 text-xs mr-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}>
                    <ChevronLeft size={14} /><span>Products</span>
                  </button>
                  <ShoppingBag size={14} style={{ color: cart.length > 0 ? '#a78bfa' : 'var(--text-muted)' }} />
                  <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Cart</span>
                  {cart.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-400">{cart.length}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  {selectedCustomer && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border" style={{ borderColor: 'rgba(139,92,246,.25)', background: 'rgba(139,92,246,.06)' }}>
                      <div className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-400 text-[8px] font-extrabold flex items-center justify-center">{selectedCustomer.name[0]?.toUpperCase()}</div>
                      <span className="text-[10px] font-semibold text-violet-400 max-w-[80px] truncate">{selectedCustomer.name}</span>
                    </div>
                  )}
                  {cart.length > 0 && (
                    <button onClick={() => setCart([])} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors text-red-400 hover:bg-red-500/10 border-red-500/20">
                      <Trash2 size={10} />Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 min-h-0">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-20 select-none">
                    <ShoppingBag size={44} className="mb-3" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Cart is empty</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Click a product to add</p>
                  </div>
                ) : cart.map((item) => (
                  <div key={item.cartId} className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                    {(() => {
                      const cartProduct = products.find((p: any) => p.id === item.productId)
                      const { gradient, iconColor, Icon: TIcon } = getProductCardStyle(cartProduct ?? {})
                      return (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative" style={{ background: gradient }}>
                          <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.4) 0%, transparent 60%)' }} />
                          <TIcon size={16} style={{ color: iconColor }} />
                        </div>
                      )
                    })()}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                      {item.imei && <p className="text-[10px] font-mono text-violet-400">IMEI: {item.imei}</p>}
                      {editPriceId === item.cartId ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <input autoFocus type="number" min="0" className="w-20 bg-white/5 border border-violet-500/40 rounded px-1.5 py-0.5 text-xs text-white"
                            value={editPriceVal} onChange={e => setEditPriceVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEditPrice(item.cartId); if (e.key === 'Escape') setEditPriceId(null) }} />
                          <button onClick={() => saveEditPrice(item.cartId)} className="text-green-400"><Check size={11} /></button>
                          <button onClick={() => setEditPriceId(null)} className="text-slate-500"><X size={11} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditPriceId(item.cartId); setEditPriceVal(String(item.price)) }}
                          className="flex items-center gap-0.5 text-[10px] hover:text-violet-400 transition-colors" style={{ color: 'var(--text-muted)' }}>
                          {formatCurrency(item.price)} each {item.price !== item.originalPrice && <span className="text-green-400">✓</span>}
                          <Edit2 size={9} className="ml-0.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => updateQty(item.cartId, -1)} className="w-6 h-6 rounded-md bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors"><Minus size={10} /></button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setQty(item.cartId, v) }}
                        onFocus={e => e.target.select()}
                        className="w-8 h-6 text-center text-xs font-bold rounded border bg-white/5 border-white/10 focus:outline-none focus:border-violet-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        style={{ color: 'var(--text-primary)' }}
                      />
                      <button onClick={() => updateQty(item.cartId, 1)} className="w-6 h-6 rounded-md bg-white/5 hover:bg-green-500/20 text-slate-400 hover:text-green-400 flex items-center justify-center transition-colors"><Plus size={10} /></button>
                    </div>
                    <span className="text-xs font-bold w-16 text-right flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.price * item.quantity)}</span>
                    <button onClick={() => setCart(prev => prev.filter(i => i.cartId !== item.cartId))}
                      className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"><X size={11} /></button>
                  </div>
                ))}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && (
                <div className="p-4 border-t flex-shrink-0 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>Subtotal ({cart.length} item{cart.length !== 1 ? 's' : ''})</span>
                    <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>Discount</span>
                    <input type="number" min="0" placeholder="0.00"
                      className="w-20 input-field text-sm text-center py-1 h-8"
                      value={discountMode === '%' ? (discountPct || '') : (discountFlat || '')}
                      onChange={e => discountMode === '%' ? setDiscountPct(Math.min(100, Number(e.target.value))) : setDiscountFlat(Number(e.target.value))} />
                    <div className="flex rounded-lg border overflow-hidden text-[10px] font-bold flex-shrink-0" style={{ borderColor: 'var(--border-default)' }}>
                      <button onClick={() => setDiscountMode('%')} className={`px-2.5 py-1.5 transition-colors ${discountMode === '%' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-500 hover:text-white'}`}>%</button>
                      <button onClick={() => setDiscountMode('flat')} className={`px-2.5 py-1.5 transition-colors ${discountMode === 'flat' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-500 hover:text-white'}`}>Rs</button>
                    </div>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-green-400">
                      <span>Saving</span><span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Total</span>
                    <span className="text-2xl font-extrabold" style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{formatCurrency(total)}</span>
                  </div>
                  {/* Warranty Section */}
                  <div className="rounded-xl border p-2.5" style={{ borderColor: addWarranty ? 'rgba(245,158,11,.4)' : 'var(--border-subtle)', background: addWarranty ? 'rgba(245,158,11,.04)' : 'var(--bg-card)', opacity: !selectedCustomer ? 0.5 : 1 }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Shield size={13} className="text-amber-400" />
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Add Warranty</span>
                        {addWarranty && selectedCustomer && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-400">{warrantyMonths < 12 ? `${warrantyMonths}mo` : `${warrantyMonths/12}yr`}</span>}
                        {!selectedCustomer && <span className="text-[9px] text-slate-500">Select customer first</span>}
                      </div>
                      <button onClick={() => { if (selectedCustomer) setAddWarranty(p => !p) }}
                        className="relative w-9 h-5 rounded-full transition-all flex-shrink-0"
                        style={{ background: addWarranty && selectedCustomer ? '#f59e0b' : 'var(--border-default, #cbd5e1)', cursor: !selectedCustomer ? 'not-allowed' : 'pointer' }}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: addWarranty && selectedCustomer ? '18px' : '2px' }} />
                      </button>
                    </div>
                    {addWarranty && selectedCustomer && (
                      <div className="grid grid-cols-4 gap-1 mt-2">
                        {[3, 6, 12, 24].map(m => (
                          <button key={m} onClick={() => setWarrantyMonths(m)}
                            className="py-1.5 rounded-lg text-[10px] font-bold border transition-all"
                            style={warrantyMonths === m
                              ? { background: 'rgba(245,158,11,.2)', borderColor: 'rgba(245,158,11,.45)', color: '#fbbf24' }
                              : { background: 'transparent', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                            {m < 12 ? `${m} mo` : `${m/12} yr`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Payment method */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { method: 'CASH' as const, label: 'Cash',   Icon: Banknote,   active: { background: 'rgba(34,197,94,.15)',  borderColor: 'rgba(34,197,94,.35)',  color: '#4ade80' } },
                      { method: 'CARD' as const, label: 'Card',   Icon: CreditCard, active: { background: 'rgba(59,130,246,.15)', borderColor: 'rgba(59,130,246,.35)', color: '#60a5fa' } },
                      { method: 'UPI'  as const, label: 'Online', Icon: Smartphone, active: { background: 'rgba(139,92,246,.15)', borderColor: 'rgba(139,92,246,.35)', color: '#a78bfa' } },
                    ]).map(({ method, label, Icon: MI, active }) => (
                      <button key={method} onClick={() => setPaymentMethod(method)}
                        className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
                        style={paymentMethod === method
                          ? { ...active, border: `1px solid ${active.borderColor}` }
                          : { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', opacity: 0.6 }}>
                        <MI size={15} />{label}
                      </button>
                    ))}
                  </div>
                  {checkoutError && <p className="text-xs text-red-400 text-center">{checkoutError}</p>}
                  <button onClick={handleCheckout} disabled={checkoutLoading}
                    className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-white font-bold text-sm transition-all disabled:opacity-60 active:scale-[.99]"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', boxShadow: checkoutLoading ? 'none' : '0 6px 24px rgba(124,58,237,.45)' }}>
                    <span>{checkoutLoading ? 'Processing…' : `Charge ${formatCurrency(total)}`}</span>
                    {checkoutLoading ? <Loader2 size={15} className="animate-spin" /> : <span className="text-violet-200 text-[11px] flex items-center gap-1">F9 <ChevronRight size={13} /></span>}
                  </button>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button onClick={holdCart}
                      className="relative flex flex-col items-center gap-0.5 py-2 rounded-xl border text-center transition-colors hover:border-amber-500/30 hover:text-amber-400 hover:bg-amber-500/5"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                      {heldCarts.length > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[7px] font-bold flex items-center justify-center">{heldCarts.length}</span>}
                      <Archive size={11} />
                      <span className="text-[9px] leading-tight">Hold</span>
                      <kbd className="text-[8px] opacity-40">F6</kbd>
                    </button>
                    <button onClick={() => cart.length > 0 && setShowDocPreview('QUOTE')}
                      className="flex flex-col items-center gap-0.5 py-2 rounded-xl border text-center transition-colors hover:border-blue-500/30 hover:text-blue-400 hover:bg-blue-500/5"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <FileText size={12} />
                      <span className="text-[9px] leading-tight">Save Quote</span>
                      <kbd className="text-[9px] opacity-50">F7</kbd>
                    </button>
                    <button onClick={() => cart.length > 0 && setShowDocPreview('DRAFT')}
                      className="flex flex-col items-center gap-0.5 py-2 rounded-xl border text-center transition-colors hover:border-violet-500/30 hover:text-violet-400 hover:bg-violet-500/5"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <FilePlus2 size={12} />
                      <span className="text-[9px] leading-tight">Draft Invoice</span>
                      <kbd className="text-[9px] opacity-50">F8</kbd>
                    </button>
                  </div>
                  {selectedCustomer && (
                    <div className="flex items-center justify-between p-3 rounded-xl border transition-colors" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center flex-shrink-0">
                          <Gift size={14} className="text-violet-400" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Loyalty Points</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Available Points: {(selectedCustomer as any).loyaltyPoints ?? 0}</p>
                        </div>
                      </div>
                      <ChevronRight size={13} className="text-slate-500 flex-shrink-0" />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Mobile Cart FAB ── */}
      {mobileView === 'products' && cart.length > 0 && (
        <div className="fixed bottom-4 left-3 right-3 z-30 md:hidden">
          <button onClick={() => setMobileView('cart')}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl font-bold"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', boxShadow: '0 8px 30px rgba(124,58,237,.55)', color: '#ffffff' }}>
            <div className="flex items-center gap-2" style={{ color: '#ffffff' }}>
              <ShoppingBag size={17} color="#ffffff" />
              <span className="text-sm" style={{ color: '#ffffff' }}>{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: '#ffffff' }}>
              <span className="text-base font-extrabold" style={{ color: '#ffffff' }}>{formatCurrency(total)}</span>
              <ChevronRight size={16} color="#ffffff" />
            </div>
          </button>
        </div>
      )}

      {/* ── Calculator ── */}
      {showCalc && (
        <div className="fixed bottom-4 right-4 z-50 w-72 rounded-2xl shadow-2xl overflow-hidden border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-2">
              <Calculator size={13} className="text-violet-400" />
              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Calculator</span>
            </div>
            <button onClick={() => setShowCalc(false)} className="p-1 rounded hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}><X size={13} /></button>
          </div>
          {/* Display */}
          <div className="px-4 py-4" style={{ background: 'var(--bg-subtle)' }}>
            {calcOp && calcPrev !== null && <p className="text-right text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{calcPrev} {calcOp}</p>}
            <p className="text-right text-3xl font-extrabold tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>{calcDisplay}</p>
          </div>
          {/* Buttons */}
          <div className="grid grid-cols-4 gap-1 p-3">
            {[
              { l: 'AC',  fn: calcClear,     cls: 'text-red-400 hover:bg-red-500/10' },
              { l: '+/-', fn: calcSign,      cls: 'text-slate-400 hover:bg-white/5' },
              { l: '%',   fn: calcPercent,   cls: 'text-slate-400 hover:bg-white/5' },
              { l: '÷',   fn: () => calcSetOp('÷'), cls: 'text-violet-400 bg-violet-500/10 hover:bg-violet-500/20' },
              { l: '7',   fn: () => calcInput('7'), cls: 'hover:bg-white/5' },
              { l: '8',   fn: () => calcInput('8'), cls: 'hover:bg-white/5' },
              { l: '9',   fn: () => calcInput('9'), cls: 'hover:bg-white/5' },
              { l: '×',   fn: () => calcSetOp('×'), cls: 'text-violet-400 bg-violet-500/10 hover:bg-violet-500/20' },
              { l: '4',   fn: () => calcInput('4'), cls: 'hover:bg-white/5' },
              { l: '5',   fn: () => calcInput('5'), cls: 'hover:bg-white/5' },
              { l: '6',   fn: () => calcInput('6'), cls: 'hover:bg-white/5' },
              { l: '−',   fn: () => calcSetOp('-'), cls: 'text-violet-400 bg-violet-500/10 hover:bg-violet-500/20' },
              { l: '1',   fn: () => calcInput('1'), cls: 'hover:bg-white/5' },
              { l: '2',   fn: () => calcInput('2'), cls: 'hover:bg-white/5' },
              { l: '3',   fn: () => calcInput('3'), cls: 'hover:bg-white/5' },
              { l: '+',   fn: () => calcSetOp('+'), cls: 'text-violet-400 bg-violet-500/10 hover:bg-violet-500/20' },
              { l: '⌫',   fn: calcBackspace,  cls: 'hover:bg-white/5 text-slate-400' },
              { l: '0',   fn: () => calcInput('0'), cls: 'hover:bg-white/5' },
              { l: '.',   fn: calcDot,        cls: 'hover:bg-white/5' },
              { l: '=',   fn: calcEqual,      cls: 'text-white bg-violet-600 hover:bg-violet-500' },
            ].map(({ l, fn, cls }) => (
              <button key={l} onClick={fn}
                className={`h-12 rounded-xl text-sm font-bold transition-all active:scale-95 ${cls}`}
                style={{ color: cls.includes('text-') ? undefined : 'var(--text-primary)' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Held Carts Modal ── */}
      {showHeldCarts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Archive size={15} className="text-amber-400" />
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Held Carts ({heldCarts.length})</h3>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button onClick={holdCart} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20 transition-colors">
                    <Archive size={12} /> Hold Current Cart
                  </button>
                )}
                <button onClick={() => setShowHeldCarts(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
              </div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
              {heldCarts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 opacity-30">
                  <p className="text-sm text-slate-500">No held carts</p>
                </div>
              ) : heldCarts.map(h => (
                <div key={h.id} className="flex items-center gap-3 px-5 py-3.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Archive size={14} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{h.label}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{h.customer?.name ?? 'Walk-in'} · {h.items.length} item(s) · {new Date(h.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-[10px] font-bold text-violet-400">{formatCurrency(h.items.reduce((s, i) => s + i.price * i.quantity, 0))}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => restoreHeldCart(h)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 transition-colors">Restore</button>
                    <button onClick={() => saveHeldCarts(heldCarts.filter(x => x.id !== h.id))} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"><X size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Quote / Draft Invoice Preview ── */}
      {showDocPreview && (() => {
        const docNum = genDocNumber(showDocPreview === 'QUOTE' ? 'QT' : 'DFT')
        const label  = showDocPreview === 'QUOTE' ? 'QUOTE' : 'DRAFT INVOICE'
        const color  = showDocPreview === 'QUOTE' ? '#2563eb' : '#7c3aed'
        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-black/80 border-b border-white/10 backdrop-blur">
              <div className="flex items-center gap-2">
                {showDocPreview === 'QUOTE' ? <FileText size={15} className="text-blue-400" /> : <FilePlus2 size={15} className="text-violet-400" />}
                <span className="text-sm font-bold text-white">{label}</span>
                <span className="text-xs text-slate-500 font-mono">{docNum}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors" style={{ background: color, color: '#fff' }}>
                  <Printer size={12} /> Print
                </button>
                <button onClick={() => setShowDocPreview(null)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded-lg border border-white/10 transition-colors">
                  <X size={13} /> Close
                </button>
              </div>
            </div>
            <div className="flex justify-center py-6 px-4">
              <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden print:shadow-none">
                {/* Doc header */}
                <div className="px-10 py-8 flex items-start justify-between" style={{ background: color }}>
                  <div>
                    <p className="text-white/70 text-xs font-semibold tracking-widest uppercase">{label}</p>
                    <p className="text-white text-2xl font-extrabold mt-1">{docNum}</p>
                    <p className="text-white/60 text-xs mt-1">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-sm">{invoiceSettings.shopName || 'Our Shop'}</p>
                    {invoiceSettings.phone && <p className="text-white/70 text-xs">{invoiceSettings.phone}</p>}
                    {invoiceSettings.address && <p className="text-white/70 text-xs">{invoiceSettings.address}</p>}
                  </div>
                </div>
                {/* Customer */}
                <div className="px-10 py-5 border-b border-gray-100">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Customer</p>
                  <p className="font-bold text-gray-800">{selectedCustomer?.name ?? 'Walk-in Customer'}</p>
                  {selectedCustomer?.phone && <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>}
                </div>
                {/* Items */}
                <div className="px-10 py-4">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-xs text-gray-400 uppercase font-semibold">Item</th>
                      <th className="text-center py-2 text-xs text-gray-400 uppercase font-semibold">Qty</th>
                      <th className="text-right py-2 text-xs text-gray-400 uppercase font-semibold">Price</th>
                      <th className="text-right py-2 text-xs text-gray-400 uppercase font-semibold">Total</th>
                    </tr></thead>
                    <tbody>{cart.map(item => (
                      <tr key={item.cartId} className="border-b border-gray-50">
                        <td className="py-2.5">
                          <p className="font-semibold text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-400">{item.sku}{item.imei ? ` · IMEI: ${item.imei}` : ''}</p>
                        </td>
                        <td className="py-2.5 text-center text-gray-600">{item.quantity}</td>
                        <td className="py-2.5 text-right text-gray-600">{formatCurrency(item.price)}</td>
                        <td className="py-2.5 text-right font-semibold text-gray-800">{formatCurrency(item.price * item.quantity)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {/* Totals */}
                <div className="px-10 py-5 bg-gray-50 border-t border-gray-100">
                  <div className="flex justify-between text-sm text-gray-500 mb-1"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-sm text-green-600 mb-1"><span>Discount</span><span>-{formatCurrency(discountAmount)}</span></div>}
                  <div className="flex justify-between text-base font-extrabold mt-2 pt-2 border-t border-gray-200" style={{ color }}><span>Total</span><span>{formatCurrency(total)}</span></div>
                </div>
                <div className="px-10 py-4 text-center">
                  <p className="text-xs text-gray-400 italic">{invoiceSettings.footerNote || 'Thank you for your business!'}</p>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Recent Invoices Slide-over ── */}
      {showRecentInvoices && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setShowRecentInvoices(false)} />
          <div className="w-[480px] flex flex-col shadow-2xl" style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Receipt size={15} className="text-violet-400" />
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Recent Invoices</h3>
              </div>
              <button onClick={() => setShowRecentInvoices(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {recentLoading ? (
                <div className="flex items-center justify-center h-32"><Loader2 size={20} className="animate-spin text-violet-400" /></div>
              ) : recentSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 opacity-30">
                  <Receipt size={28} className="text-slate-600 mb-2" />
                  <p className="text-sm text-slate-500">No invoices found</p>
                </div>
              ) : recentSales.map((sale: any) => (
                <div key={sale.id} className="flex items-center gap-3 px-5 py-3.5 border-b hover:bg-white/3 transition-colors" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center flex-shrink-0">
                    <Receipt size={14} className="text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{sale.invoiceNumber}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${sale.status === 'PAID' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>{sale.status}</span>
                    </div>
                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{sale.customerName ?? 'Walk-in Customer'} · {new Date(sale.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-violet-400">{formatCurrency(sale.total)}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{(sale.items?.length ?? sale.itemCount ?? 0)} item(s)</p>
                  </div>
                  <button onClick={() => {
                    if (!sale.items) return
                    printThermalReceipt({ invoiceNumber: sale.invoiceNumber, createdAt: sale.createdAt, customerName: sale.customerName ?? 'Walk-in Customer', customerPhone: sale.customerPhone ?? '', items: sale.items ?? [], subtotal: sale.subtotal ?? sale.total, discountAmount: sale.discount ?? 0, total: sale.total, paymentMethod: sale.payments?.[0]?.method, cashReceived: undefined, changeAmount: undefined }, invoiceSettings)
                  }} title="Reprint" className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-violet-500/15 hover:text-violet-400 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    <Printer size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
