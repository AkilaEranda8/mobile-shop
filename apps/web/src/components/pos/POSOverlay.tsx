'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, Plus, Minus, CreditCard, Banknote, Smartphone, Receipt,
  ScanLine, X, Loader2, UserPlus, Edit2, Check, Download, Tag, Printer,
  Heart, Trash2, ChevronRight, ChevronLeft, ChevronDown, Archive,
  FileText, FilePlus2, Calculator, SlidersHorizontal, Package, Tablet,
  Headphones, Wrench, PackageSearch, ShoppingBag, User, CheckCircle2, Shield,
  Menu, ShoppingCart, Bell, Wifi, Cloud, TrendingUp, MoreHorizontal,
  Grid3X3, List as ListIcon, MessageCircle, Star, RefreshCw, RotateCcw,
  LayoutGrid, Hash, Wallet, Users, PhoneCall,
} from 'lucide-react'
import { HexaPosLayout, POS_THEME, categoryIcon, type PosNavItem } from './HexaPosLayout'
import { PosReturnModal } from './PosReturnModal'
import { PosReloadPanel, type ReloadProvider } from './PosReloadPanel'
import { useUIStore } from '@/stores/ui-store'
import { useProducts, useFeatureFlag } from '@/lib/hooks'
import { salesApi, customersApi, productsApi, imeiApi, warrantyApi, servicesApi, financeApi, dailyReloadApi, tenantApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { getInvoiceSettings, fetchInvoiceSettings, shopContextFromTenant, type InvoiceSettings, type ShopContext } from '@/lib/invoiceSettings'
import InvoicePrint, { type InvoiceData } from '@/components/invoice/InvoicePrint'
import { printThermalReceipt } from '@/components/invoice/ThermalReceipt'
import { whatsappApi } from '@/lib/whatsapp-api'

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
  isReload?: boolean
  reloadProvider?: string
  cost?: number
  serviceId?: string
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
function POSContent({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { pendingCustomer, clearPendingCustomer } = useUIStore()
  const [cart, setCart]                         = useState<CartItem[]>([])
  const [search, setSearch]                     = useState('')
  const [paymentMethod, setPaymentMethod]       = useState<'CASH' | 'CARD' | 'UPI'>('CASH')
  const [customerPaid, setCustomerPaid]         = useState('')
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
  const [favorites, setFavorites]                 = useState<Set<string>>(new Set())
  const [showScanInput, setShowScanInput]         = useState(false)
  const [showCustDrop, setShowCustDrop]           = useState(false)
  const [showCartCustDrop, setShowCartCustDrop]   = useState(false)
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
  const [showOpeningCash, setShowOpeningCash]     = useState(false)
  const [openingCashAmount, setOpeningCashAmount] = useState('')
  const [openingCashLoading, setOpeningCashLoading] = useState(false)
  const [showCashFlow, setShowCashFlow]           = useState(false)
  const [cashFlowMode, setCashFlowMode]           = useState<'IN' | 'OUT'>('IN')
  const [cashFlowAmount, setCashFlowAmount]       = useState('')
  const [cashFlowNote, setCashFlowNote]           = useState('')
  const [cashFlowLoading, setCashFlowLoading]     = useState(false)
  const [showMoreMenu, setShowMoreMenu]           = useState(false)
  const [showReturnModal, setShowReturnModal]     = useState(false)
  const [showFilters, setShowFilters]             = useState(false)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [activeNavId, setActiveNavId]             = useState('products')
  const [waSending, setWaSending]                 = useState(false)
  const [cartView, setCartView]                       = useState<'items' | 'checkout'>('items')
  const [manualTotalMode, setManualTotalMode]     = useState(false)
  const [manualTotal, setManualTotal]             = useState('')
  const [customerOutstanding, setCustomerOutstanding] = useState(0)
  const [includeOutstanding, setIncludeOutstanding] = useState(false)
  const [outstandingPayAmount, setOutstandingPayAmount] = useState('')
  const [amountPaying, setAmountPaying] = useState('')
  const hasCustomerCredit = useFeatureFlag('CUSTOMER_CREDIT')
  const hasRepairs = useFeatureFlag('REPAIRS')
  const hasIMEI = useFeatureFlag('IMEI')
  const hasFinance = useFeatureFlag('FINANCE')
  const hasWhatsApp = useFeatureFlag('WHATSAPP')
  const hasDailyReload = useFeatureFlag('DAILY_RELOAD')
  const hasServices = useFeatureFlag('SERVICES')
  const [mobileView, setMobileView]               = useState<'products' | 'cart'>('products')
  const [isDesktop, setIsDesktop]                 = useState(false)
  const [hideOutOfStock, setHideOutOfStock]       = useState(false)
  const [now, setNow]                             = useState(() => new Date())
  const [gridView, setGridView]                   = useState(true)
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const [calcDisplay, setCalcDisplay]             = useState('0')
  const [calcPrev, setCalcPrev]                   = useState<string|null>(null)
  const [calcOp, setCalcOp]                       = useState<string|null>(null)
  const [calcReset, setCalcReset]                 = useState(false)
  const searchRef                                 = useRef<HTMLInputElement>(null)
  const payNowRef                                 = useRef<HTMLInputElement>(null)
  const prevSaleTotalRef                          = useRef(0)

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

  const getBranchId = () => authStorage.getUser()?.branchIds?.[0] ?? ''

  const recordCashTransaction = async (opts: { type: 'INCOME' | 'EXPENSE'; category: string; amount: number; description: string }) => {
    const branchId = getBranchId()
    if (!branchId) {
      toast.error('No branch on your account — contact admin')
      return false
    }
    await financeApi.create({
      branchId,
      type: opts.type,
      category: opts.category,
      amount: opts.amount,
      description: opts.description,
      paymentMethod: 'CASH',
    })
    return true
  }

  const holdCart = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty — add items first')
      return false
    }
    const id = `HC-${Date.now()}`
    const entry = { id, label: `Cart #${heldCarts.length + 1}`, time: new Date().toISOString(), items: cart, customer: selectedCustomer, discountPct, discountFlat, discountMode }
    saveHeldCarts([entry, ...heldCarts])
    setCart([]); setSelectedCustomer(null); setDiscountPct(0); setDiscountFlat(0)
    toast.success(`Cart held — ${entry.label}`, { icon: '📦' })
    return true
  }

  const handleHoldSales = () => {
    if (cart.length > 0) holdCart()
    else { setShowHeldCarts(true); toast('Showing held carts', { icon: '📦' }) }
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

  const submitOpeningCash = async () => {
    const amount = parseFloat(openingCashAmount)
    if (!amount || amount <= 0) { toast.error('Enter a valid opening cash amount'); return }
    setOpeningCashLoading(true)
    try {
      const ok = await recordCashTransaction({
        type: 'INCOME',
        category: 'Opening Cash',
        amount,
        description: `POS opening cash — ${new Date().toLocaleDateString('en-GB')}`,
      })
      if (!ok) return
      const key = `pos_opening_cash_${new Date().toISOString().slice(0, 10)}`
      localStorage.setItem(key, String(amount))
      openDrawer()
      toast.success(`Opening cash recorded: ${formatCurrency(amount)}`, { icon: '💵' })
      setShowOpeningCash(false)
      setOpeningCashAmount('')
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to record opening cash')
    } finally { setOpeningCashLoading(false) }
  }

  const submitCashFlow = async () => {
    const amount = parseFloat(cashFlowAmount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    const note = cashFlowNote.trim() || (cashFlowMode === 'IN' ? 'Cash added to drawer' : 'Cash removed from drawer')
    setCashFlowLoading(true)
    try {
      const ok = await recordCashTransaction({
        type: cashFlowMode === 'IN' ? 'INCOME' : 'EXPENSE',
        category: cashFlowMode === 'IN' ? 'Cash In' : 'Cash Out',
        amount,
        description: `POS ${cashFlowMode === 'IN' ? 'cash in' : 'cash out'} — ${note}`,
      })
      if (!ok) return
      if (cashFlowMode === 'OUT') openDrawer()
      toast.success(cashFlowMode === 'IN' ? `Cash in: ${formatCurrency(amount)}` : `Cash out: ${formatCurrency(amount)}`, { icon: '💰' })
      setShowCashFlow(false)
      setCashFlowAmount('')
      setCashFlowNote('')
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to record cash movement')
    } finally { setCashFlowLoading(false) }
  }

  const reprintSale = async (sale: any) => {
    try {
      let saleData = sale
      if (!saleData?.items?.length) {
        const res: any = await salesApi.getById(sale.id)
        saleData = res?.data ?? res
      }
      printThermalReceipt({
        invoiceNumber: saleData.invoiceNumber,
        createdAt: saleData.createdAt,
        customerName: saleData.customerName ?? 'Walk-in Customer',
        customerPhone: saleData.customerPhone ?? '',
        items: saleData.items ?? [],
        subtotal: saleData.subtotal ?? saleData.total,
        discountAmount: saleData.discount ?? 0,
        total: saleData.total,
        paymentMethod: saleData.payments?.[0]?.method,
        cashReceived: undefined,
        changeAmount: undefined,
      }, invoiceSettings, thermalShopCtx)
      toast.success('Receipt sent to printer')
    } catch {
      toast.error('Could not print invoice')
    }
  }

  const restoreHeldCart = (entry: typeof heldCarts[0]) => {
    setCart(entry.items)
    setDiscountPct(entry.discountPct)
    setDiscountFlat(entry.discountFlat)
    setDiscountMode(entry.discountMode)
    saveHeldCarts(heldCarts.filter(h => h.id !== entry.id))
    setShowHeldCarts(false)
    selectCustomer(entry.customer)
    toast.success(`${entry.label} restored`)
  }

  const genDocNumber = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*9000+1000)}`

  const fetchRecentSales = async () => {
    setRecentLoading(true)
    try {
      const res: any = await salesApi.list({ limit: '30' })
      const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
      setRecentSales(rows)
      if (rows.length === 0) toast('No recent sales found', { icon: '🧾' })
    } catch (e: any) {
      setRecentSales([])
      toast.error(e?.message ?? 'Failed to load recent sales')
    } finally { setRecentLoading(false) }
  }

  const openRecentSales = () => {
    setShowRecentInvoices(true)
    fetchRecentSales()
  }

  const { data: productsData, refetch: refetchProducts } = useProducts({ limit: '500' })
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
    refetchProducts()
  }, [refetchProducts])

  useEffect(() => {
    if (!pendingCustomer) return
    setSelectedCustomer(pendingCustomer)
    clearPendingCustomer()
  }, [pendingCustomer, clearPendingCustomer])

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
    const matchStock = !hideOutOfStock || (p.stock ?? 0) > 0
    const matchFav = !showFavoritesOnly || favorites.has(p.id)
    return matchCat && matchSearch && matchStock && matchFav
  })

  const filteredServices = services.filter((s: any) => {
    const matchCat = selectedCategory === 'SERVICES' || selectedCategory === 'ALL'
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const addReloadToCart = useCallback((provider: ReloadProvider, amount: number) => {
    setCart(prev => [...prev, {
      cartId: `reload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: null,
      name: `${provider} Reload`,
      sku: `RELOAD-${provider.toUpperCase()}`,
      price: amount,
      originalPrice: amount,
      quantity: 1,
      isReload: true,
      reloadProvider: provider,
    }])
    toast.success(`${provider} reload ${formatCurrency(amount)} added to cart`, { icon: '📱' })
  }, [])

  const displayItems = selectedCategory === 'SERVICES' ? filteredServices
    : selectedCategory === 'RELOAD' ? []
    : filtered
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
    return { gradient: 'linear-gradient(160deg, #1c2333 0%, #151921 100%)', iconColor: '#9CA3AF', Icon: Package }
  }

  const addToCart = (product: any, imei?: string) => {
    const price = product.sellingPrice ?? product.price
    const isService = product.sellingPrice === undefined && product.price !== undefined
    const cost = isService ? Number(product.cost ?? 0) : Number(product.buyingPrice ?? 0)
    const serviceId = isService ? product.id : undefined
    setCart(prev => {
      if (!imei) {
        const existing = prev.find(i => i.isService
          ? i.serviceId === serviceId && i.name === product.name
          : i.productId === product.id && !i.imei)
        if (existing) return prev.map(i => i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        cartId: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: isService ? null : product.id,
        serviceId,
        name: product.name,
        sku: product.sku ?? product.category ?? '',
        price,
        originalPrice: price,
        cost,
        quantity: 1,
        imei,
        isService,
      }]
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
  const serviceCostTotal = cart.filter(i => i.isService).reduce((s, i) => s + (i.cost ?? 0) * i.quantity, 0)
  const serviceRevenue   = cart.filter(i => i.isService).reduce((s, i) => s + i.price * i.quantity, 0)
  const serviceMargin    = serviceRevenue - serviceCostTotal
  const hasServiceInCart = cart.some(i => i.isService)
  const discountAmount = discountMode === '%' ? (subtotal * discountPct) / 100 : Math.min(discountFlat, subtotal)
  const afterDiscount  = subtotal - discountAmount
  const tax            = 0
  const calculatedTotal = afterDiscount
  // Bill total from line items — never reduced by "Edit total" when using customer credit
  const saleTotal = calculatedTotal
  const creditMode = hasCustomerCredit && !!selectedCustomer?.id
  const billTotal = creditMode
    ? saleTotal
    : (manualTotalMode && manualTotal ? Math.max(0, parseFloat(manualTotal) || 0) : saleTotal)
  const outstandingPaying = (() => {
    if (!includeOutstanding || customerOutstanding <= 0) return 0
    const v = parseFloat(outstandingPayAmount)
    if (isNaN(v) || outstandingPayAmount.trim() === '') return customerOutstanding
    return Math.min(Math.max(0, v), customerOutstanding)
  })()
  const settleOldOutstanding = hasCustomerCredit && includeOutstanding && !!selectedCustomer && outstandingPaying > 0
  const canOpenCheckout = cart.length > 0 || (hasCustomerCredit && !!selectedCustomer && customerOutstanding > 0)
  const payNowForSale = (() => {
    if (!hasCustomerCredit) return billTotal
    const v = parseFloat(amountPaying)
    if (isNaN(v) || amountPaying.trim() === '') return saleTotal
    return Math.min(Math.max(0, v), saleTotal)
  })()
  const saleDueAmount = creditMode && payNowForSale < saleTotal ? Math.max(0, saleTotal - payNowForSale) : 0
  const needsCustomerForPartial = hasCustomerCredit && payNowForSale < saleTotal && !selectedCustomer?.id
  const collectAtCheckout = payNowForSale + outstandingPaying
  const cashReceivedAmount = paymentMethod === 'CASH'
    ? (parseFloat(customerPaid) || collectAtCheckout)
    : payNowForSale
  const changeAmount = paymentMethod === 'CASH'
    ? Math.max(0, cashReceivedAmount - collectAtCheckout)
    : 0

  const currentUser = authStorage.getUser()
  const shopName = currentUser?.name?.split(' ')[0] + ' Shop' || 'Our Shop'
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() => getInvoiceSettings())
  const [thermalShopCtx, setThermalShopCtx] = useState<ShopContext | undefined>(undefined)

  useEffect(() => {
    if (!currentUser?.tenantId) return
    const branchId = currentUser.branchIds?.[0]
    Promise.all([
      fetchInvoiceSettings(currentUser.tenantId, branchId),
      tenantApi.get(currentUser.tenantId).catch(() => null),
    ]).then(([settings, tenantRes]) => {
      setInvoiceSettings(settings)
      const tenant = (tenantRes as any)?.data ?? tenantRes
      setThermalShopCtx(shopContextFromTenant(tenant, branchId))
    }).catch(() => {})
  }, [currentUser?.tenantId, currentUser?.branchIds?.[0]])

  useEffect(() => {
    if (!selectedCustomer?.id) {
      setCustomerOutstanding(0)
      setIncludeOutstanding(false)
      setOutstandingPayAmount('')
      return
    }
    setCustomerOutstanding(selectedCustomer.totalDue ?? 0)
  }, [selectedCustomer?.id, selectedCustomer?.totalDue])

  useEffect(() => {
    if (customerOutstanding > 0) {
      setOutstandingPayAmount(prev => {
        const v = parseFloat(prev)
        if (!prev.trim() || isNaN(v) || v > customerOutstanding) return customerOutstanding.toFixed(2)
        return prev
      })
    } else {
      setOutstandingPayAmount('')
      setIncludeOutstanding(false)
    }
  }, [customerOutstanding])

  useEffect(() => {
    if (cartView !== 'checkout' || !selectedCustomer?.id) return
    customersApi.getById(selectedCustomer.id).then((res: any) => {
      const full = res?.data ?? res
      if (!full?.id) return
      setSelectedCustomer(full)
      setCustomerOutstanding(full.totalDue ?? 0)
    }).catch(() => {})
  }, [cartView, selectedCustomer?.id])

  useEffect(() => {
    if (creditMode) setManualTotalMode(false)
  }, [creditMode])

  useEffect(() => {
    if (saleTotal !== prevSaleTotalRef.current) {
      setAmountPaying(saleTotal > 0 ? saleTotal.toFixed(2) : '')
      prevSaleTotalRef.current = saleTotal
    }
  }, [saleTotal])

  useEffect(() => {
    if (paymentMethod !== 'CASH') return
    const amt = collectAtCheckout > 0 ? collectAtCheckout : saleTotal
    setCustomerPaid(amt > 0 ? amt.toFixed(2) : '')
  }, [paymentMethod, collectAtCheckout, saleTotal])

  const refreshCustomerBalance = useCallback(async (customerId: string) => {
    try {
      const res: any = await customersApi.getById(customerId)
      const full = res?.data ?? res
      setSelectedCustomer(full)
      setCustomerOutstanding(full.totalDue ?? 0)
      return full
    } catch {
      return null
    }
  }, [])

  const selectCustomer = useCallback(async (c: any | null) => {
    setShowCustDrop(false)
    setShowCartCustDrop(false)
    if (!c) {
      setSelectedCustomer(null)
      setCustomerOutstanding(0)
      setIncludeOutstanding(false)
      setOutstandingPayAmount('')
      setAddWarranty(false)
      return
    }
    setSelectedCustomer(c)
    try {
      const res: any = await customersApi.getById(c.id)
      const full = res?.data ?? res
      setSelectedCustomer(full)
      setCustomerOutstanding(full.totalDue ?? 0)
      if ((full.totalDue ?? 0) > 0) setOutstandingPayAmount(Number(full.totalDue).toFixed(2))
    } catch {
      setCustomerOutstanding(c.totalDue ?? 0)
      if ((c.totalDue ?? 0) > 0) setOutstandingPayAmount(Number(c.totalDue).toFixed(2))
    }
  }, [])

  const shareWhatsApp = useCallback(() => {
    const phone = (selectedCustomer?.phone ?? completedSale?.customerPhone ?? '').replace(/\D/g, '')
    const total = completedSale?.total ?? saleTotal
    const inv = completedSale?.invoiceNumber ?? 'Draft'
    const text = encodeURIComponent(`Invoice: ${inv}\nTotal: ${formatCurrency(total)}\nThank you for your purchase!`)
    if (!phone) {
      toast.error('Select a customer with a phone number first')
      setShowCartCustDrop(true)
      return
    }
    window.open(`https://wa.me/${phone.startsWith('94') ? phone : '94' + phone.replace(/^0/, '')}?text=${text}`, '_blank')
  }, [selectedCustomer, completedSale, saleTotal])

  const handleCheckout = async () => {
    if (cart.length === 0 && outstandingPaying <= 0) return
    if (cart.length > 0 && addWarranty && !selectedCustomer) {
      setCheckoutError('Please select a customer to add warranty')
      return
    }
    if (needsCustomerForPartial) {
      setCheckoutError('Select a customer to save the remaining balance as credit')
      setShowCartCustDrop(true)
      return
    }
    if (creditMode && cart.length > 0 && payNowForSale < saleTotal && saleDueAmount <= 0) {
      setCheckoutError('Use "Paying now" for partial payment — do not use Edit total')
      return
    }
    if (settleOldOutstanding && outstandingPaying > customerOutstanding + 0.001) {
      setCheckoutError('Outstanding payment exceeds customer balance')
      return
    }
    if (paymentMethod === 'CASH') {
      const paid = parseFloat(customerPaid) || 0
      if (paid + 0.001 < collectAtCheckout) {
        setCheckoutError('Customer paid amount is less than total')
        return
      }
    }
    setCheckoutLoading(true)
    setCheckoutError('')
    const settledOutstanding = outstandingPaying
    try {
      const user = authStorage.getUser()

      // Settle old balance first so a failed payment does not leave a new sale unpaid
      if (settleOldOutstanding && selectedCustomer && settledOutstanding > 0) {
        await customersApi.creditPayment(selectedCustomer.id, {
          amount: settledOutstanding,
          paymentMethod,
          branchId: user?.branchIds?.[0] || '',
          performedBy: user?.name || 'system',
        })
      }

      if (cart.length === 0) {
        if (selectedCustomer?.id) await refreshCustomerBalance(selectedCustomer.id)
        setIncludeOutstanding(false)
        setOutstandingPayAmount('')
        setCartView('items')
        toast.success(`Outstanding ${formatCurrency(settledOutstanding)} collected`, { icon: '✓' })
        return
      }

      const payments: { method: string; amount: number }[] = []
      if (payNowForSale > 0) payments.push({ method: paymentMethod, amount: payNowForSale })
      if (saleDueAmount > 0) payments.push({ method: 'CREDIT', amount: saleDueAmount })

      const res: any = await salesApi.create({
        branchId:      user?.branchIds?.[0],
        customerId:    selectedCustomer?.id || undefined,
        customerName:  selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone || '',
        subtotal,
        discount:      discountAmount,
        tax,
        total:         saleTotal,
        paidAmount:    payNowForSale,
        dueAmount:     saleDueAmount,
        status:        saleDueAmount > 0 ? (payNowForSale > 0 ? 'PARTIAL' : 'DUE') : 'PAID',
        items: cart.map(i => ({
          productId:   i.isService ? undefined : i.productId,
          productName: i.name,
          sku:         i.sku,
          quantity:    i.quantity,
          unitPrice:   i.price,
          total:       i.price * i.quantity,
          imei:        i.imei,
        })),
        payments,
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
      const reloadItems = cart.filter(i => i.isReload && i.reloadProvider)
      if (reloadItems.length > 0) {
        const invoiceNo = res.data?.invoiceNumber ?? ''
        for (const item of reloadItems) {
          try {
            await dailyReloadApi.create({
              connectionNo: item.reloadProvider!,
              provider: item.reloadProvider!,
              amount: item.price * item.quantity,
              executedBy: user?.name || 'POS',
              transactionId: invoiceNo || undefined,
              status: 'Success',
            })
          } catch (e) { console.error('Reload record failed:', e) }
        }
        toast.success(`${reloadItems.length} reload record${reloadItems.length > 1 ? 's' : ''} saved`, { icon: '📱' })
      }
      if (saleDueAmount > 0) {
        toast.success(`${formatCurrency(saleDueAmount)} added to customer credit`, { icon: '📋' })
      }
      if (settledOutstanding > 0) {
        toast.success(`Old balance ${formatCurrency(settledOutstanding)} settled`, { icon: '✓' })
      }
      if (selectedCustomer?.id) {
        await refreshCustomerBalance(selectedCustomer.id)
        setIncludeOutstanding(false)
      }
      refetchProducts()
      window.dispatchEvent(new CustomEvent('pos:sale-complete'))
      setMobileView('cart')
      setCompletedSale({
        ...res.data,
        total: res.data?.total ?? saleTotal,
        items: cart.map(i => ({ productName: i.name, sku: i.sku, imei: i.imei, quantity: i.quantity, unitPrice: i.price, total: i.price * i.quantity })),
        payments,
        paidAmount: payNowForSale,
        dueAmount: res.data?.dueAmount ?? saleDueAmount,
        customerName:  selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone || '',
        cashierName:   user?.name || 'Staff',
        paymentMethod,
        cashReceived: cashReceivedAmount,
        changeAmount,
        warrantyNumbers: createdWarrantyCodes,
        warrantyMonths:  addWarranty ? warrantyMonths : undefined,
      })
    } catch (e: any) {
      if (settledOutstanding > 0) {
        if (selectedCustomer?.id) await refreshCustomerBalance(selectedCustomer.id)
        const base = e.message || 'Checkout failed'
        setCheckoutError(
          cart.length > 0
            ? `${base} — outstanding ${formatCurrency(settledOutstanding)} was already collected`
            : base,
        )
      } else {
        setCheckoutError(e.message || 'Checkout failed')
      }
    } finally {
      setCheckoutLoading(false)
    }
  }

  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return false
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
      return el.isContentEditable
    }
    const openCheckout = () => {
      if (canOpenCheckout && !completedSale) {
        if (cart.length === 0 && customerOutstanding > 0) setIncludeOutstanding(true)
        setCartView('checkout')
        setTimeout(() => payNowRef.current?.focus(), 80)
      }
    }
    const payNow = () => {
      if ((cart.length > 0 || outstandingPaying > 0) && !checkoutLoading && !completedSale) {
        if (cartView === 'checkout') void handleCheckout()
        else openCheckout()
      }
    }
    const handler = (e: KeyboardEvent) => {
      const fnKey = /^F([1-9]|1[0-2])$/.test(e.key)

      if (e.key === 'Escape') {
        e.preventDefault()
        if (showRecentInvoices) setShowRecentInvoices(false)
        else if (showHeldCarts) setShowHeldCarts(false)
        else if (showCalc) setShowCalc(false)
        else if (showReturnModal) setShowReturnModal(false)
        else if (showDocPreview) setShowDocPreview(null)
        else if (showMoreMenu) setShowMoreMenu(false)
        else if (showFilters) setShowFilters(false)
        else if (showOpeningCash) setShowOpeningCash(false)
        else if (showCashFlow) setShowCashFlow(false)
        else if (showCartCustDrop || showCustDrop) { setShowCartCustDrop(false); setShowCustDrop(false) }
        else if (cartView === 'checkout' && !completedSale) setCartView('items')
        return
      }

      if (fnKey || (e.ctrlKey && e.key === 'Enter')) {
        if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select() }
        if (e.key === 'F2') { e.preventDefault(); setShowCartCustDrop(true); setCustSearch('') }
        if (e.key === 'F3') { e.preventDefault(); payNow() }
        if (e.key === 'F4') { e.preventDefault(); handleHoldSales() }
        if (e.key === 'F5') {
          e.preventDefault()
          if (completedSale) printThermalReceipt({ invoiceNumber: completedSale.invoiceNumber, createdAt: completedSale.createdAt, customerName: completedSale.customerName, customerPhone: completedSale.customerPhone, items: completedSale.items ?? [], subtotal, discountAmount, total: completedSale.total ?? saleTotal, paymentMethod: completedSale.paymentMethod, cashReceived: completedSale.cashReceived, changeAmount: completedSale.changeAmount, warrantyNumbers: completedSale.warrantyNumbers, warrantyMonths: completedSale.warrantyMonths }, invoiceSettings, thermalShopCtx)
        }
        if (e.key === 'F6') { e.preventDefault(); setShowHeldCarts(true) }
        if (e.key === 'F7') { e.preventDefault(); if (cart.length > 0) setShowDocPreview('QUOTE'); else toast.error('Cart is empty') }
        if (e.key === 'F8') { e.preventDefault(); if (cart.length > 0) setShowDocPreview('DRAFT'); else toast.error('Cart is empty') }
        if (e.key === 'F9') { e.preventDefault(); openCheckout() }
        if (e.key === 'F10') { e.preventDefault(); handleNewSale() }
        if (e.key === 'F12') { e.preventDefault(); setShowCalc(p => !p) }
        if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); payNow() }
        return
      }

      if (isTyping()) return

      if (cartView === 'checkout' && !completedSale && cart.length > 0) {
        if (e.key === '1') { e.preventDefault(); setPaymentMethod('CASH') }
        if (e.key === '2') { e.preventDefault(); setPaymentMethod('CARD') }
        if (e.key === '3') { e.preventDefault(); setPaymentMethod('UPI') }
        if (e.key === 'Enter') { e.preventDefault(); void handleCheckout() }
        if (e.key === 'o' || e.key === 'O') {
          if (selectedCustomer && customerOutstanding > 0) {
            e.preventDefault()
            setIncludeOutstanding(p => !p)
          }
        }
      }

      if (cartView === 'items' && cart.length > 0 && (e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        openCheckout()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, cartView, checkoutLoading, completedSale, selectedCustomer, customerOutstanding, subtotal, discountAmount, saleTotal, invoiceSettings])

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
    setManualTotalMode(false); setManualTotal('')
    setCustomerOutstanding(0); setIncludeOutstanding(false); setOutstandingPayAmount('')
    setAmountPaying(''); setCustomerPaid(''); setPaymentMethod('CASH')
    prevSaleTotalRef.current = 0
    setShowCustDrop(false); setShowCartCustDrop(false)
    setShowRecentInvoices(false); setShowHeldCarts(false); setShowMoreMenu(false)
    setShowOpeningCash(false); setShowCashFlow(false); setShowCalc(false); setShowReturnModal(false); setShowFilters(false); setActiveNavId('products'); setCartView('items')
    toast.success('New sale started', { icon: '🛒', duration: 1500 })
  }

  const handleCustomerCreated = useCallback((c: any) => {
    refetchCustomers?.()
    selectCustomer(c)
  }, [refetchCustomers, selectCustomer])

  const storeName = invoiceSettings.shopName || shopName || 'Hexa Mobile Store'
  const cashierName = currentUser?.name || 'Admin'
  const syncTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  const handleNavAction = useCallback((id: string) => {
    setActiveNavId(id)
    if (id === 'products') return
    if (id === 'sales') { openRecentSales(); return }
    if (id === 'customers') { setShowCartCustDrop(true); setCustSearch(''); return }
    if (id === 'imei') { setShowScanInput(true); return }
    if (id === 'cash') { setCashFlowMode('IN'); setShowCashFlow(true); return }
    if (id === 'returns') { setShowReturnModal(true); return }
    if (id === 'reload') { setSelectedCategory('RELOAD'); setActiveNavId('products'); return }
    const routes: Record<string, string> = {
      repairs: '/dashboard/repairs',
      purchase: '/purchase-invoice',
      inventory: '/dashboard/inventory',
      reports: '/dashboard/reports',
      expenses: '/dashboard/expenses',
      settings: '/dashboard/settings',
    }
    if (routes[id]) {
      onClose()
      router.push(routes[id])
    }
  }, [onClose, router, openRecentSales])

  const posNavItems = useMemo((): PosNavItem[] => {
    const items: PosNavItem[] = [
      { id: 'products', label: 'Products', icon: LayoutGrid },
      { id: 'sales', label: 'Sales', icon: Receipt },
      { id: 'customers', label: 'Customers', icon: Users },
    ]
    if (hasIMEI) items.push({ id: 'imei', label: 'IMEI / Serial', icon: Hash })
    if (hasFinance) items.push({ id: 'cash', label: 'Cash In/Out', icon: Wallet })
    items.push({ id: 'returns', label: 'Returns', icon: RotateCcw })
    if (hasDailyReload) items.push({ id: 'reload', label: 'Reload', icon: PhoneCall })
    return items
  }, [hasIMEI, hasFinance, hasDailyReload])

  const sendWhatsAppInvoice = useCallback(async () => {
    if (!completedSale?.id) return
    const phone = (completedSale.customerPhone ?? selectedCustomer?.phone ?? '').replace(/\D/g, '')
    if (!phone) { toast.error('Customer phone required for WhatsApp invoice'); return }
    const formatted = phone.startsWith('94') ? `+${phone}` : phone.startsWith('0') ? `+94${phone.slice(1)}` : `+94${phone}`
    setWaSending(true)
    try {
      await whatsappApi.sendInvoice(completedSale.id, formatted)
      toast.success('Invoice sent via WhatsApp')
    } catch (e: any) {
      toast.error(e.message || 'WhatsApp send failed — try manual share')
      shareWhatsApp()
    } finally {
      setWaSending(false)
    }
  }, [completedSale, selectedCustomer, shareWhatsApp])

  const renderCustomerList = (autoFocus = false) => (
    <>
      <div className="p-2 border-b" style={{ borderColor: POS_THEME.border }}>
        <input
          autoFocus={autoFocus}
          className="w-full h-8 px-2 rounded-lg text-xs outline-none border text-white placeholder:text-white/50"
          style={{ background: POS_THEME.bg, borderColor: POS_THEME.border }}
          placeholder="Search customer… (F2)"
          value={custSearch}
          onChange={e => setCustSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { setShowCustDrop(false); setShowCartCustDrop(false) } }}
        />
      </div>
      <div className="overflow-y-auto max-h-60">
        <button type="button" onClick={() => selectCustomer(null)} className="w-full px-3 py-2 text-xs text-left border-b hover:bg-white/5 text-white" style={{ borderColor: POS_THEME.border }}>Walk-in Customer</button>
        <button type="button" onClick={() => { setShowCustDrop(false); setShowCartCustDrop(false); setShowRegister(true) }} className="w-full px-3 py-2 text-xs text-left border-b flex items-center gap-1 hover:bg-white/5 text-white" style={{ borderColor: POS_THEME.border }}><Plus size={10} />New Customer</button>
        {custLoading && <p className="px-3 py-2 text-[10px] text-white/60">Loading…</p>}
        {filteredCustomers.slice(0, 80).map((c: any) => (
          <button key={c.id} type="button" onClick={() => selectCustomer(c)} className="w-full px-3 py-2 text-left border-b hover:bg-white/5" style={{ borderColor: POS_THEME.border }}>
            <p className="text-xs font-semibold text-white">{c.name}</p>
            <p className="text-[10px] text-white/70">{c.phone}{(c.totalDue ?? 0) > 0 ? ` · Due ${formatCurrency(c.totalDue)}` : ''}</p>
          </button>
        ))}
      </div>
    </>
  )

  const customerSlot = (
    <div className="relative flex-shrink-0">
      <button type="button" onClick={() => { setShowCustDrop(o => !o); setShowCartCustDrop(false); setCustSearch('') }}
        className="h-9 px-3 rounded-xl border flex items-center gap-2 text-xs font-medium"
        style={{ background: POS_THEME.card, borderColor: POS_THEME.border, color: '#ffffff' }}
        title="Select customer (F2)">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ background: selectedCustomer ? 'rgba(124,58,237,0.3)' : POS_THEME.bg, color: '#ffffff' }}>
          {selectedCustomer ? selectedCustomer.name[0]?.toUpperCase() : <User size={10} />}
        </div>
        <span className="max-w-[110px] truncate">{selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}</span>
        <ChevronDown size={10} className="text-white/70" />
      </button>
      {showCustDrop && (
        <div className="absolute top-full mt-1.5 right-0 z-[60] w-64 rounded-2xl shadow-2xl overflow-hidden border" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}>
          {renderCustomerList(true)}
        </div>
      )}
    </div>
  )

  const imeiSlot = showScanInput ? (
    <div className="relative shrink-0">
      <input autoFocus type="text" placeholder="IMEI Search" className="h-9 w-36 pl-3 pr-8 rounded-xl text-sm outline-none border"
        style={{ background: POS_THEME.card, borderColor: 'rgba(59,130,246,0.4)', color: POS_THEME.text }}
        value={imeiScan} onChange={e => setImeiScan(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { handleImeiScan(imeiScan); setShowScanInput(false) } if (e.key === 'Escape') { setShowScanInput(false); setImeiScan('') } }}
        onBlur={() => { if (!imeiScan) setShowScanInput(false) }} />
      {imeiScanning && <Loader2 size={11} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-blue-400" />}
    </div>
  ) : null

  return (
    <>
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

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <HexaPosLayout
        shopName={storeName}
        onClose={onClose}
        cashierName={cashierName}
        syncTime={syncTime}
        search={search}
        onSearchChange={setSearch}
        searchRef={searchRef}
        onScanClick={() => setShowScanInput(true)}
        onBellClick={() => setShowHeldCarts(true)}
        onNavAction={handleNavAction}
        navItems={posNavItems}
        activeNavId={activeNavId}
        heldBadgeCount={heldCarts.length}
        onFiltersClick={() => setShowFilters(v => !v)}
        filtersActive={showFilters || hideOutOfStock || showFavoritesOnly}
        filtersPanel={showFilters ? (
          <div className="shrink-0 w-full px-4 py-2.5 flex flex-wrap items-center gap-x-8 gap-y-2 border-b" style={{ borderColor: POS_THEME.border, background: POS_THEME.card }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Filters</span>
            <label className="flex items-center gap-2.5 text-[11px] font-medium text-white cursor-pointer">
              Hide Out of Stock
              <button type="button" onClick={() => setHideOutOfStock(v => !v)} className="relative w-9 h-5 rounded-full transition-all" style={{ background: hideOutOfStock ? POS_THEME.purple : POS_THEME.border }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: hideOutOfStock ? '18px' : '2px' }} />
              </button>
            </label>
            <label className="flex items-center gap-2.5 text-[11px] font-medium text-white cursor-pointer">
              Favorites only
              <button type="button" onClick={() => setShowFavoritesOnly(v => !v)} className="relative w-9 h-5 rounded-full transition-all" style={{ background: showFavoritesOnly ? POS_THEME.purple : POS_THEME.border }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: showFavoritesOnly ? '18px' : '2px' }} />
              </button>
            </label>
          </div>
        ) : null}
        toolbarActions={(
          <>
            <button type="button" onClick={openRecentSales} title="Recent Sales"
              className="h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 hover:bg-white/5"
              style={{ borderColor: POS_THEME.border, background: POS_THEME.card }}>
              <Receipt size={15} className="text-white" />
            </button>
            <button type="button" onClick={() => setShowCalc(true)} title="Calculator (F12)"
              className="h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 hover:bg-white/5"
              style={{ borderColor: POS_THEME.border, background: POS_THEME.card }}>
              <Calculator size={15} className="text-white" />
            </button>
          </>
        )}
        imeiSlot={imeiSlot}
        customerSlot={customerSlot}
        categoryBar={(
          <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0 overflow-x-auto scrollbar-none" style={{ borderColor: POS_THEME.border, background: POS_THEME.panel }}>
            {[
              { id: 'ALL', name: 'All', icon: Package },
              ...(hasServices ? [{ id: 'SERVICES', name: 'Services', icon: Wrench }] : []),
              ...(hasDailyReload ? [{ id: 'RELOAD', name: 'Reload', icon: PhoneCall }] : []),
              ...categories.map(c => ({ ...c, icon: getCategoryIcon(c.name) }))
            ].map(({ id, name, icon: Icon }) => (
              <button key={id} onClick={() => setSelectedCategory(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0 whitespace-nowrap"
                style={selectedCategory === id
                  ? { background: POS_THEME.purple, color: '#fff', boxShadow: `0 2px 10px ${POS_THEME.purple}59`, border: 'none' }
                  : { background: POS_THEME.card, border: `1px solid ${POS_THEME.border}`, color: POS_THEME.muted }}>
                <Icon size={11} />{name}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => setGridView(true)} className="p-1.5 rounded-lg border text-white" style={{ borderColor: gridView ? POS_THEME.purple : POS_THEME.border }}><Grid3X3 size={14} /></button>
              <button type="button" onClick={() => setGridView(false)} className="p-1.5 rounded-lg border text-white" style={{ borderColor: !gridView ? POS_THEME.purple : POS_THEME.border }}><ListIcon size={14} /></button>
            </div>
          </div>
        )}
        productGrid={(
          selectedCategory === 'RELOAD' && hasDailyReload ? (
            <PosReloadPanel onAdd={addReloadToCart} />
          ) : (
          <div className={gridView ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3' : 'space-y-1.5'}>
            {pagedProducts.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center h-40 opacity-30">
                <PackageSearch size={32} className="mb-2" style={{ color: POS_THEME.muted }} />
                <p className="text-sm" style={{ color: POS_THEME.muted }}>{selectedCategory === 'SERVICES' ? 'No services found' : products.length === 0 ? 'Loading products…' : 'No products found'}</p>
              </div>
            ) : pagedProducts.map((item: any) => {
                  const isService = selectedCategory === 'SERVICES'
                  const isLow  = !isService && item.stock > 0 && item.stock <= 4
                  const isHot  = !isService && item.stock >= 25
                  const isOut  = !isService && item.stock === 0
                  const { gradient, iconColor, Icon: CardIcon } = isService ? { gradient: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})`, iconColor: '#c4b5fd', Icon: Wrench } : getProductCardStyle(item)
                  const initials = (item.name as string).split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                  const isFav  = favorites.has(item.id)
                  return (
                    <div key={item.id}
                      className={`relative flex flex-col rounded-xl overflow-hidden border transition-all group cursor-pointer select-none ${isOut ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-black/25 hover:-translate-y-0.5'}`}
                      style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}
                      onClick={() => !isOut && addToCart(item)}>

                      {/* ── IMAGE ZONE ── */}
                      <div className="relative overflow-hidden" style={{ paddingBottom: '58%' }}>
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
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(4px)' }}>
                              <CardIcon size={16} style={{ color: iconColor }} />
                            </div>
                            <span className="text-[9px] font-extrabold tracking-widest" style={{ color: iconColor, opacity: 0.55 }}>{initials}</span>
                          </div>
                        )}

                        {/* Hover "add" overlay */}
                        {!isOut && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.32)' }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white/60" style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)' }}>
                              <Plus size={16} className="text-white" />
                            </div>
                          </div>
                        )}

                        {isHot && !isLow && (
                          <div className="absolute top-1 left-1 px-1.5 py-px rounded text-[8px] font-extrabold tracking-wide text-white" style={{ background: POS_THEME.red }}>
                            HOT
                          </div>
                        )}
                        {isLow && (
                          <div className="absolute top-1 left-1 flex items-center gap-0.5 px-1.5 py-px rounded-full text-[8px] font-bold tracking-wide border border-white/30 text-white" style={{ background: 'rgba(0,0,0,0.35)' }}>
                            ⚠ LOW
                          </div>
                        )}
                        <button type="button" onClick={e => { e.stopPropagation(); setFavorites(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n }) }}
                          className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isFav ? 'opacity-100 text-red-400' : 'opacity-0 group-hover:opacity-100 text-white/70 hover:text-red-400'}`}
                          style={{ background: 'rgba(0,0,0,0.35)' }}>
                          <Heart size={10} fill={isFav ? 'currentColor' : 'none'} />
                        </button>

                      </div>

                      {/* ── INFO ZONE ── */}
                      <div className="flex flex-col px-2 py-1.5 gap-0.5">
                        <p className="text-[10px] font-bold leading-tight line-clamp-2" style={{ color: POS_THEME.text }}>{item.name}</p>
                        <p className="text-[8px] font-mono truncate" style={{ color: POS_THEME.muted }}>{item.sku}</p>
                        <div className="flex items-end justify-between gap-1">
                          <div className="min-w-0">
                            <p className="pos-price text-xs font-extrabold leading-none">{formatCurrency(isService ? item.price : item.sellingPrice)}</p>
                            {isService ? (
                              <p className="text-[8px] mt-0.5 truncate" style={{ color: POS_THEME.muted }}>
                                Cost {formatCurrency(Number(item.cost ?? 0))}
                                {(item.cost ?? 0) > 0 && item.price > (item.cost ?? 0) && (
                                  <span style={{ color: POS_THEME.green }}> · +{formatCurrency(item.price - (item.cost ?? 0))}</span>
                                )}
                              </p>
                            ) : (
                              <p className="text-[8px] font-semibold flex items-center gap-0.5 mt-0.5 truncate" style={{ color: isOut ? POS_THEME.muted : isLow ? POS_THEME.amber : POS_THEME.green }}>
                                <span className="w-1 h-1 rounded-full inline-block shrink-0" style={{ background: isOut ? POS_THEME.muted : isLow ? POS_THEME.amber : POS_THEME.green }} />
                                {isOut ? 'Out' : isLow ? `Low (${item.stock})` : `Stock ${item.stock}`}
                              </p>
                            )}
                          </div>
                          <button type="button" disabled={isOut}
                            onClick={e => { e.stopPropagation(); if (!isOut) addToCart(item) }}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-30 hover:scale-105 active:scale-95 flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})`, boxShadow: `0 1px 6px ${POS_THEME.purple}66` }}>
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
          </div>
          )
        )}
        pagination={selectedCategory === 'RELOAD' ? null : (
          <div className="flex items-center justify-between px-4 py-2.5 border-t shrink-0" style={{ borderColor: POS_THEME.border, background: POS_THEME.panel }}>
            <span className="text-xs" style={{ color: POS_THEME.muted }}>Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, displayItems.length)} of {displayItems.length} items</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/5 disabled:opacity-30 text-white transition-colors">
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center border transition-colors ${page === p ? 'text-white' : 'text-white hover:bg-white/5'}`}
                    style={page === p ? { background: POS_THEME.purple, borderColor: POS_THEME.purple } : { borderColor: POS_THEME.border }}>{p}</button>
                )
              })}
              {totalPages > 5 && page < totalPages - 2 && <>
                <span className="text-white text-xs px-0.5">…</span>
                <button onClick={() => setPage(totalPages)} className="w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center border border-white/10 text-white hover:bg-white/5 transition-colors">{totalPages}</button>
              </>}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="w-7 h-7 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/5 disabled:opacity-30 text-white transition-colors">
                <ChevronRight size={12} />
              </button>
            </div>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}
              className="text-xs py-1 h-7 rounded-lg px-2 border outline-none" style={{ width: 90, background: POS_THEME.card, borderColor: POS_THEME.border, color: POS_THEME.text }}>
              {[15, 20, 30, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>
        )}
        bottomActions={(
          <div className="flex flex-wrap gap-2 px-4 py-3 border-t shrink-0" style={{ borderColor: POS_THEME.border, background: POS_THEME.panel }}>
            {[
              { label: 'New Sale (F10)', onClick: handleNewSale, bg: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})` },
              { label: 'Hold Sales (F4)', onClick: handleHoldSales, bg: `linear-gradient(135deg, ${POS_THEME.blue}, ${POS_THEME.blueDark})` },
              { label: 'Recent Sales', onClick: openRecentSales, bg: `linear-gradient(135deg, ${POS_THEME.teal}, ${POS_THEME.tealDark})` },
              ...(hasDailyReload ? [{ label: 'Reload', onClick: () => { setSelectedCategory('RELOAD'); setActiveNavId('products') }, bg: `linear-gradient(135deg, ${POS_THEME.teal}, ${POS_THEME.tealDark})` }] : []),
              { label: 'Opening Cash', onClick: () => setShowOpeningCash(true), bg: `linear-gradient(135deg, ${POS_THEME.amber}, ${POS_THEME.amberDark})` },
              { label: 'Cash In/Out', onClick: () => { setCashFlowMode('IN'); setShowCashFlow(true) }, bg: POS_THEME.card },
              { label: heldCarts.length > 0 ? `More (${heldCarts.length})` : 'More', onClick: () => setShowMoreMenu(true), bg: POS_THEME.card },
            ].map(btn => (
              <button key={btn.label} type="button" onClick={btn.onClick}
                className="flex-1 min-w-[110px] h-10 rounded-xl text-xs font-bold text-white border"
                style={{ background: btn.bg, borderColor: POS_THEME.border }}>
                {btn.label}
              </button>
            ))}
          </div>
        )}
        cartPanel={(
          <div className="flex flex-col h-full min-h-0" style={{ background: POS_THEME.panel, color: POS_THEME.text }}>
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
                <span className="text-sm font-bold text-white">{formatCurrency(completedSale.total ?? saleTotal)}</span>
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
                  <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-white/5"><span>Total</span><span>{formatCurrency(completedSale.total ?? saleTotal)}</span></div>
                  {(completedSale.dueAmount ?? 0) > 0 && (
                    <div className="flex justify-between text-xs text-amber-400"><span>Credit (outstanding)</span><span>{formatCurrency(completedSale.dueAmount)}</span></div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-white/5 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowA4Invoice(true)} className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10 transition-colors">
                    <Receipt size={12} /> A4 Invoice
                  </button>
                  <button onClick={() => printThermalReceipt({ invoiceNumber: completedSale.invoiceNumber, createdAt: completedSale.createdAt, customerName: completedSale.customerName, customerPhone: completedSale.customerPhone, items: completedSale.items ?? [], subtotal, discountAmount, total: completedSale.total ?? saleTotal, paymentMethod: completedSale.paymentMethod, cashReceived: completedSale.cashReceived, changeAmount: completedSale.changeAmount, warrantyNumbers: completedSale.warrantyNumbers, warrantyMonths: completedSale.warrantyMonths }, invoiceSettings, thermalShopCtx)} className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">
                    <Printer size={12} /> Thermal Print
                  </button>
                </div>
                <button onClick={downloadInvoice} disabled={downloading} className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 transition-colors disabled:opacity-50">
                  {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {downloading ? 'Generating PDF…' : 'Download Invoice PDF'}
                </button>
                {hasWhatsApp && (
                  <button type="button" onClick={sendWhatsAppInvoice} disabled={waSending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl border transition-colors disabled:opacity-50"
                    style={{ borderColor: `${POS_THEME.green}40`, background: `${POS_THEME.green}10`, color: POS_THEME.green }}>
                    {waSending ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
                    {waSending ? 'Sending…' : 'Send WhatsApp Invoice'}
                  </button>
                )}
                <button onClick={handleNewSale} className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.99]" style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', boxShadow: '0 4px 20px rgba(124,58,237,.4)' }}>+ New Sale (F10)</button>
              </div>
              {completedSale && (() => { const d = buildA4Data(); return d ? <div style={{ position: 'fixed', left: '-9999px', top: 0, width: 794, pointerEvents: 'none' }}><InvoicePrint ref={a4Ref} data={d} hideControls /></div> : null })()}
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: POS_THEME.border, background: POS_THEME.panel }}>
                {cartView === 'checkout' ? (
                  <>
                    <button type="button" onClick={() => setCartView('items')}
                      className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                      style={{ color: POS_THEME.muted }}>
                      <ChevronLeft size={14} /><span>Cart</span>
                    </button>
                    <span className="font-bold text-sm" style={{ color: POS_THEME.text }}>Checkout</span>
                    <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: POS_THEME.bg, color: POS_THEME.muted }}>F9</kbd>
                    <span className="pos-price text-sm font-bold">{formatCurrency(saleTotal)}</span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setMobileView('products')} className="md:hidden flex items-center gap-1 text-xs mr-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: POS_THEME.muted }}>
                        <ChevronLeft size={14} /><span>Products</span>
                      </button>
                      <ShoppingBag size={14} className="text-white" />
                      <span className="font-bold text-sm" style={{ color: POS_THEME.text }}>Cart ({cart.length})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {cart.length > 0 && (
                        <button type="button" onClick={() => { setCart([]); setCartView('items') }} className="text-xs font-semibold hover:opacity-80" style={{ color: POS_THEME.red }}>
                          Clear Cart
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {cartView === 'items' ? (
                <>
              {/* Cart Items — full height scroll */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 min-h-0">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full select-none px-4">
                    {hasCustomerCredit && selectedCustomer && customerOutstanding > 0 ? (
                      <>
                        <CreditCard size={36} className="mb-3 text-red-400" />
                        <p className="text-sm font-semibold text-white">{selectedCustomer.name}</p>
                        <p className="text-xl font-extrabold text-red-400 mt-1">{formatCurrency(customerOutstanding)}</p>
                        <p className="text-xs text-white/50 mt-1 text-center">Outstanding balance — press F9 to collect</p>
                        <button type="button" onClick={() => { setCartView('checkout'); setIncludeOutstanding(true) }}
                          className="mt-4 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
                          Collect Outstanding <kbd className="ml-1 px-1 rounded text-[10px]" style={{ background: 'rgba(0,0,0,0.25)' }}>F9</kbd>
                        </button>
                      </>
                    ) : (
                      <div className="opacity-20 flex flex-col items-center">
                        <ShoppingBag size={44} className="mb-3" style={{ color: POS_THEME.muted }} />
                        <p className="text-sm font-semibold" style={{ color: POS_THEME.muted }}>Cart is empty</p>
                        <p className="text-xs mt-1" style={{ color: POS_THEME.muted }}>Click a product to add</p>
                      </div>
                    )}
                  </div>
                ) : cart.map((item) => (
                  <div key={item.cartId} className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}>
                    {(() => {
                      if (item.isReload) {
                        return (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${POS_THEME.teal}, ${POS_THEME.tealDark})` }}>
                            <PhoneCall size={16} className="text-white" />
                          </div>
                        )
                      }
                      const cartProduct = products.find((p: any) => p.id === item.productId)
                      const { gradient, iconColor, Icon: TIcon } = item.isService
                        ? { gradient: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})`, iconColor: '#c4b5fd', Icon: Wrench }
                        : getProductCardStyle(cartProduct ?? {})
                      return (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative" style={{ background: gradient }}>
                          <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.4) 0%, transparent 60%)' }} />
                          <TIcon size={16} style={{ color: iconColor }} />
                        </div>
                      )
                    })()}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: POS_THEME.text }}>{item.name}</p>
                      {item.isReload && item.reloadProvider && (
                        <p className="text-[10px] font-semibold" style={{ color: POS_THEME.teal }}>{item.reloadProvider}</p>
                      )}
                      {item.isService && (
                        <p className="text-[9px]" style={{ color: POS_THEME.muted }}>
                          Cost {formatCurrency((item.cost ?? 0) * item.quantity)}
                          {(item.cost ?? 0) > 0 && <span style={{ color: POS_THEME.green }}> · Margin {formatCurrency((item.price - (item.cost ?? 0)) * item.quantity)}</span>}
                        </p>
                      )}
                      {item.imei && <p className="text-[10px] font-mono text-white/80">IMEI: {item.imei}</p>}
                      {editPriceId === item.cartId ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <input autoFocus type="number" min="0" className="w-20 bg-white/5 border border-violet-500/40 rounded px-1.5 py-0.5 text-xs text-white"
                            value={editPriceVal} onChange={e => setEditPriceVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEditPrice(item.cartId); if (e.key === 'Escape') setEditPriceId(null) }} />
                          <button onClick={() => saveEditPrice(item.cartId)} className="text-white"><Check size={11} /></button>
                          <button onClick={() => setEditPriceId(null)} className="text-white/70"><X size={11} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditPriceId(item.cartId); setEditPriceVal(String(item.price)) }}
                          className="flex items-center gap-0.5 text-[10px] hover:text-violet-400 transition-colors" style={{ color: POS_THEME.muted }}>
                          {formatCurrency(item.price)} each {item.price !== item.originalPrice && <span className="text-white">✓</span>}
                          <Edit2 size={9} className="ml-0.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => updateQty(item.cartId, -1)} className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"><Minus size={10} /></button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setQty(item.cartId, v) }}
                        onFocus={e => e.target.select()}
                        className="w-8 h-6 text-center text-xs font-bold rounded border focus:outline-none focus:border-violet-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        style={{ color: POS_THEME.text, background: POS_THEME.card, borderColor: POS_THEME.border }}
                      />
                      <button onClick={() => updateQty(item.cartId, 1)} className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"><Plus size={10} /></button>
                    </div>
                    <span className="text-xs font-bold w-16 text-right flex-shrink-0" style={{ color: POS_THEME.text }}>{formatCurrency(item.price * item.quantity)}</span>
                    <button onClick={() => setCart(prev => prev.filter(i => i.cartId !== item.cartId))}
                      className="w-5 h-5 rounded flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"><X size={11} /></button>
                  </div>
                ))}
              </div>

              {/* Cart summary — compact, items stay visible above */}
              {cart.length > 0 && (
                <div className="p-3 border-t flex-shrink-0 space-y-2" style={{ borderColor: POS_THEME.border, background: POS_THEME.panel }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: POS_THEME.muted }}>{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
                    <span className="pos-price text-xl font-extrabold">{formatCurrency(saleTotal)}</span>
                  </div>
                  <button type="button" onClick={() => { setCartView('checkout'); setTimeout(() => payNowRef.current?.focus(), 80) }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-95"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', boxShadow: '0 4px 20px rgba(124,58,237,.4)' }}>
                    Checkout
                    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold" style={{ background: 'rgba(0,0,0,0.25)' }}>F9</kbd>
                    <ChevronRight size={16} />
                  </button>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button type="button" onClick={handleHoldSales}
                      className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors hover:bg-white/5"
                      style={{ borderColor: POS_THEME.border, color: POS_THEME.muted }}>
                      <Archive size={12} />Hold
                    </button>
                    <button type="button" onClick={() => setShowDocPreview('QUOTE')}
                      className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors hover:bg-white/5"
                      style={{ borderColor: POS_THEME.border, color: POS_THEME.muted }}>
                      <FileText size={12} />Quote
                    </button>
                    <button type="button" onClick={() => setShowDocPreview('DRAFT')}
                      className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors hover:bg-white/5"
                      style={{ borderColor: POS_THEME.border, color: POS_THEME.muted }}>
                      <FilePlus2 size={12} />Draft
                    </button>
                  </div>
                </div>
              )}
                </>
              ) : (cart.length > 0 || (hasCustomerCredit && selectedCustomer && customerOutstanding > 0)) ? (
              /* Checkout — separate view */
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                  {cart.length === 0 && customerOutstanding > 0 && (
                    <div className="rounded-xl border p-3 text-center" style={{ borderColor: `${POS_THEME.red}44`, background: `${POS_THEME.red}10` }}>
                      <p className="text-xs font-semibold text-white">Outstanding balance only</p>
                      <p className="text-lg font-extrabold text-white mt-1">{formatCurrency(customerOutstanding)}</p>
                      <p className="text-[10px] text-white/60 mt-1">Toggle Pay old balance and collect — no new items in cart</p>
                    </div>
                  )}
                  {/* Customer — change anytime during checkout */}
                  <div className="relative rounded-xl border p-2.5" style={{ borderColor: needsCustomerForPartial ? 'rgba(245,158,11,.5)' : POS_THEME.border, background: POS_THEME.card }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.25)' }}>
                          <User size={14} className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-white/60">Customer</p>
                          <p className="text-xs font-bold truncate text-white">{selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}</p>
                          {selectedCustomer?.phone && <p className="text-[10px] text-white/60 truncate">{selectedCustomer.phone}</p>}
                          {selectedCustomer && customerOutstanding > 0 && (
                            <p className="text-[10px] font-bold text-red-400">Due {formatCurrency(customerOutstanding)}</p>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={() => { setShowCartCustDrop(o => !o); setShowCustDrop(false); setCustSearch('') }}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold border text-white hover:bg-white/5"
                        style={{ borderColor: POS_THEME.border, background: POS_THEME.panel }}>
                        Change
                      </button>
                    </div>
                    {showCartCustDrop && (
                      <div className="absolute left-2 right-2 top-full mt-1 z-[60] rounded-2xl shadow-2xl overflow-hidden border" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}>
                        {renderCustomerList(true)}
                      </div>
                    )}
                    {needsCustomerForPartial && (
                      <p className="text-[10px] text-amber-300 mt-2">Partial amount entered — select a customer to continue</p>
                    )}
                    {selectedCustomer && (selectedCustomer.loyaltyPoints ?? 0) > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: `${POS_THEME.amber}15`, border: `1px solid ${POS_THEME.amber}33` }}>
                        <Star size={11} style={{ color: POS_THEME.amber }} />
                        <span className="text-[10px] font-bold text-white">{selectedCustomer.loyaltyPoints} loyalty points</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-sm" style={{ color: POS_THEME.muted }}>
                    <span>Subtotal ({cart.length} item{cart.length !== 1 ? 's' : ''})</span>
                    <span style={{ color: POS_THEME.text }}>{formatCurrency(subtotal)}</span>
                  </div>
                  {hasServiceInCart && (
                    <div className="rounded-lg border px-2.5 py-2 space-y-1 text-[11px]" style={{ borderColor: POS_THEME.border, background: POS_THEME.card }}>
                      <div className="flex justify-between" style={{ color: POS_THEME.muted }}>
                        <span>Service cost</span>
                        <span>{formatCurrency(serviceCostTotal)}</span>
                      </div>
                      <div className="flex justify-between font-semibold" style={{ color: POS_THEME.green }}>
                        <span>Service margin</span>
                        <span>{formatCurrency(serviceMargin)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm flex-1" style={{ color: POS_THEME.muted }}>Discount</span>
                    <input type="number" min="0" placeholder="0.00"
                      className="w-20 text-sm text-center py-1 h-8 rounded-lg border outline-none focus:border-violet-500/50 text-white placeholder:text-white/50"
                      style={{ background: POS_THEME.card, borderColor: POS_THEME.border, color: POS_THEME.text }}
                      value={discountMode === '%' ? (discountPct || '') : (discountFlat || '')}
                      onChange={e => discountMode === '%' ? setDiscountPct(Math.min(100, Number(e.target.value))) : setDiscountFlat(Number(e.target.value))} />
                    <div className="flex rounded-lg border overflow-hidden text-[10px] font-bold flex-shrink-0" style={{ borderColor: POS_THEME.border }}>
                      <button onClick={() => setDiscountMode('%')} className={`px-2.5 py-1.5 transition-colors text-white ${discountMode === '%' ? 'bg-violet-500/20' : 'hover:bg-white/5'}`}>%</button>
                      <button onClick={() => setDiscountMode('flat')} className={`px-2.5 py-1.5 transition-colors text-white ${discountMode === 'flat' ? 'bg-violet-500/20' : 'hover:bg-white/5'}`}>Rs</button>
                    </div>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-xs" style={{ color: POS_THEME.green }}>
                      <span>Saving</span><span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  {hasCustomerCredit && selectedCustomer && customerOutstanding > 0 && (
                    <div className="rounded-xl border p-2.5" style={{ borderColor: includeOutstanding ? `${POS_THEME.red}66` : POS_THEME.border, background: includeOutstanding ? `${POS_THEME.red}10` : POS_THEME.card }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <CreditCard size={13} className="text-white" />
                          <span className="text-xs font-semibold text-white">Pay old balance</span>
                          <span className="text-[10px] font-bold text-white">{formatCurrency(customerOutstanding)}</span>
                        </div>
                        <button onClick={() => setIncludeOutstanding(p => !p)}
                          className="relative w-9 h-5 rounded-full transition-all flex-shrink-0"
                          title="Keyboard: O"
                          style={{ background: includeOutstanding ? POS_THEME.red : POS_THEME.border }}>
                          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: includeOutstanding ? '18px' : '2px' }} />
                        </button>
                      </div>
                      {includeOutstanding && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-white">Amount to collect</span>
                            <button type="button" onClick={() => setOutstandingPayAmount(customerOutstanding.toFixed(2))}
                              className="text-[10px] font-bold text-violet-400 hover:underline">
                              Full {formatCurrency(customerOutstanding)}
                            </button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max={customerOutstanding}
                            step="0.01"
                            value={outstandingPayAmount}
                            onChange={e => setOutstandingPayAmount(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm font-bold border outline-none focus:border-violet-500/50 text-white placeholder:text-white/50"
                            style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}
                          />
                          {outstandingPaying > 0 && outstandingPaying < customerOutstanding && (
                            <p className="text-[10px] text-white/70">
                              Remaining after pay: {formatCurrency(customerOutstanding - outstandingPaying)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {hasCustomerCredit && selectedCustomer && saleTotal > 0 && cart.length > 0 && (
                    <div
                      className="rounded-xl border p-2.5 space-y-2"
                      style={{
                        borderColor: saleDueAmount > 0 ? `${POS_THEME.amber}80` : POS_THEME.border,
                        background: saleDueAmount > 0 ? `${POS_THEME.amber}0D` : POS_THEME.card,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold" style={{ color: POS_THEME.text }}>Paying now</span>
                        <span className="text-[10px]" style={{ color: POS_THEME.muted }}>Bill {formatCurrency(saleTotal)}</span>
                      </div>
                      <input
                        ref={payNowRef}
                        type="number"
                        min="0"
                        max={saleTotal}
                        step="0.01"
                        value={amountPaying}
                        onChange={e => setAmountPaying(e.target.value)}
                        placeholder="Amount customer pays now"
                        className="w-full px-3 py-2 rounded-lg text-sm font-bold border outline-none focus:border-violet-500/50 text-white placeholder:text-white/50"
                        style={{ background: POS_THEME.card, borderColor: POS_THEME.border, color: POS_THEME.text }}
                      />
                      {creditMode && saleDueAmount > 0 && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white">Added to customer credit</span>
                          <span className="font-bold text-white">{formatCurrency(saleDueAmount)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: POS_THEME.border }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold" style={{ color: POS_THEME.text }}>{cart.length > 0 ? 'Total' : 'Collect'}</span>
                      {!creditMode && (
                        <button onClick={() => { setManualTotalMode(!manualTotalMode); if (!manualTotalMode) setManualTotal(String(calculatedTotal)) }}
                          className="text-[10px] px-2 py-0.5 rounded border transition-colors"
                          style={{ borderColor: manualTotalMode ? 'rgba(139,92,246,.4)' : POS_THEME.border, background: manualTotalMode ? 'rgba(139,92,246,.1)' : 'transparent', color: '#ffffff' }}>
                          {manualTotalMode ? 'Auto' : 'Edit'}
                        </button>
                      )}
                    </div>
                    {manualTotalMode && !creditMode ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={manualTotal}
                        onChange={e => setManualTotal(e.target.value)}
                        className="w-28 text-right text-2xl font-extrabold bg-transparent outline-none"
                        style={{ color: POS_THEME.text }}
                      />
                    ) : (
                      <span className="pos-price text-2xl font-extrabold">{formatCurrency(cart.length > 0 ? saleTotal : collectAtCheckout)}</span>
                    )}
                  </div>
                  {includeOutstanding && outstandingPaying > 0 && (
                    <div className="flex justify-between text-xs">
                      <span style={{ color: POS_THEME.muted }}>Old balance collecting</span>
                      <span className="font-bold" style={{ color: POS_THEME.text }}>{formatCurrency(outstandingPaying)}</span>
                    </div>
                  )}
                  {includeOutstanding && outstandingPaying > 0 && cart.length > 0 && (
                    <div className="flex justify-between text-xs">
                      <span style={{ color: POS_THEME.muted }}>Total collecting (bill + old balance)</span>
                      <span className="font-bold" style={{ color: POS_THEME.text }}>{formatCurrency(collectAtCheckout)}</span>
                    </div>
                  )}
                  {includeOutstanding && outstandingPaying > 0 && cart.length === 0 && (
                    <div className="flex justify-between text-xs">
                      <span style={{ color: POS_THEME.muted }}>Total collecting</span>
                      <span className="font-bold" style={{ color: POS_THEME.text }}>{formatCurrency(collectAtCheckout)}</span>
                    </div>
                  )}
                  {!includeOutstanding && creditMode && collectAtCheckout !== saleTotal && (
                    <div className="flex justify-between text-xs" style={{ color: POS_THEME.muted }}>
                      <span>Collecting now</span>
                      <span className="font-bold" style={{ color: POS_THEME.text }}>{formatCurrency(collectAtCheckout)}</span>
                    </div>
                  )}
                  {selectedCustomer && (
                    <div className="rounded-xl border p-2.5" style={{ borderColor: addWarranty ? `${POS_THEME.amber}66` : POS_THEME.border, background: addWarranty ? `${POS_THEME.amber}0D` : POS_THEME.card, opacity: !selectedCustomer ? 0.5 : 1 }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Shield size={13} className="text-white" />
                          <span className="text-xs font-semibold text-white">Warranty</span>
                          {addWarranty && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-white/10 text-white">{warrantyMonths < 12 ? `${warrantyMonths}mo` : `${warrantyMonths/12}yr`}</span>}
                        </div>
                        <button type="button" onClick={() => setAddWarranty(p => !p)}
                          className="relative w-9 h-5 rounded-full transition-all flex-shrink-0"
                          style={{ background: addWarranty ? POS_THEME.amber : POS_THEME.border }}>
                          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: addWarranty ? '18px' : '2px' }} />
                        </button>
                      </div>
                      {addWarranty && (
                        <div className="grid grid-cols-4 gap-1 mt-2">
                          {[3, 6, 12, 24].map(m => (
                            <button key={m} type="button" onClick={() => setWarrantyMonths(m)}
                              className="py-1.5 rounded-lg text-[10px] font-bold border transition-all text-white"
                              style={warrantyMonths === m
                                ? { background: `${POS_THEME.amber}25`, borderColor: `${POS_THEME.amber}80`, color: POS_THEME.amber }
                                : { background: 'transparent', borderColor: POS_THEME.border, color: POS_THEME.text }}>
                              {m < 12 ? `${m} mo` : `${m/12} yr`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { method: 'CASH' as const, label: 'Cash', Icon: Banknote, active: { background: `${POS_THEME.green}26`, borderColor: `${POS_THEME.green}59`, color: POS_THEME.green } },
                      { method: 'CARD' as const, label: 'Card', Icon: CreditCard, active: { background: `${POS_THEME.blue}26`, borderColor: `${POS_THEME.blue}59`, color: POS_THEME.blue } },
                      { method: 'UPI'  as const, label: 'Bank Transfer', Icon: Banknote, active: { background: POS_THEME.card, borderColor: POS_THEME.border, color: POS_THEME.text } },
                    ]).map(({ method, label, Icon: MI, active }) => (
                      <button key={method} type="button" onClick={() => {
                        setPaymentMethod(method)
                        if (method === 'CASH') {
                          setCustomerPaid(collectAtCheckout > 0 ? collectAtCheckout.toFixed(2) : '')
                        }
                      }}
                        className="flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-semibold border transition-all"
                        title={method === 'CASH' ? 'Key: 1' : method === 'CARD' ? 'Key: 2' : 'Key: 3'}
                        style={paymentMethod === method
                          ? { ...active, border: `1px solid ${active.borderColor}` }
                          : { background: POS_THEME.card, border: `1px solid ${POS_THEME.border}`, color: POS_THEME.muted }}>
                        <MI size={14} />{label}
                      </button>
                    ))}
                  </div>
                  {!selectedCustomer && paymentMethod === 'CASH' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold" style={{ color: POS_THEME.text }}>Customer Paid</span>
                        <span className="text-[10px]" style={{ color: POS_THEME.muted }}>Due {formatCurrency(collectAtCheckout)}</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={customerPaid}
                        onChange={e => setCustomerPaid(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2.5 rounded-xl text-sm font-bold border outline-none focus:border-violet-500/50 text-white placeholder:text-white/50"
                        style={{ background: POS_THEME.card, borderColor: POS_THEME.border, color: POS_THEME.text }}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {[5000, 10000, 20000, 50000].map(amt => (
                          <button key={amt} type="button" onClick={() => setCustomerPaid(String(amt))}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors hover:bg-white/5"
                            style={{ borderColor: POS_THEME.border, color: POS_THEME.muted }}>
                            {formatCurrency(amt)}
                          </button>
                        ))}
                        <button type="button" onClick={() => setCustomerPaid(collectAtCheckout > 0 ? collectAtCheckout.toFixed(2) : '')}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors hover:bg-white/5"
                          style={{ borderColor: `${POS_THEME.purple}66`, color: POS_THEME.purple }}>
                          Exact
                        </button>
                      </div>
                      {changeAmount > 0 && (
                        <div className="rounded-xl border px-3 py-2.5 flex items-center justify-between" style={{ background: `${POS_THEME.green}15`, borderColor: `${POS_THEME.green}40` }}>
                          <span className="text-xs font-semibold" style={{ color: POS_THEME.green }}>Change Return</span>
                          <span className="text-lg font-extrabold" style={{ color: POS_THEME.green }}>{formatCurrency(changeAmount)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedCustomer && paymentMethod === 'CASH' && changeAmount > 0 && (
                    <div className="rounded-xl border px-3 py-2.5 flex items-center justify-between" style={{ background: `${POS_THEME.green}15`, borderColor: `${POS_THEME.green}40` }}>
                      <span className="text-xs font-semibold" style={{ color: POS_THEME.green }}>Change Return</span>
                      <span className="text-lg font-extrabold" style={{ color: POS_THEME.green }}>{formatCurrency(changeAmount)}</span>
                    </div>
                  )}
                  {checkoutError && <p className="text-xs text-white text-center">{checkoutError}</p>}
                  <button type="button" onClick={handleCheckout} disabled={checkoutLoading || (cart.length === 0 && outstandingPaying <= 0)}
                    className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-white font-bold text-base transition-all disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', boxShadow: checkoutLoading ? 'none' : '0 8px 28px rgba(124,58,237,.45)' }}>
                    {checkoutLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                    <span>{checkoutLoading ? 'Processing…' : `Pay Now (F3 / Enter)`}</span>
                  </button>
              </div>
              ) : null}
            </>
          )}
          </div>
        )}
      />
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
              <span className="text-base font-extrabold" style={{ color: '#ffffff' }}>{formatCurrency(saleTotal)}</span>
              <ChevronRight size={16} color="#ffffff" />
            </div>
          </button>
        </div>
      )}

      {/* ── Calculator ── */}
      {showCalc && (
        <div data-pos="dark" className="fixed bottom-4 right-4 z-[115] w-72 rounded-2xl shadow-2xl overflow-hidden border" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}>
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

      {/* ── Opening Cash ── */}
      {showOpeningCash && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowOpeningCash(false)}>
          <div data-pos="dark" className="w-full max-w-sm rounded-2xl shadow-2xl border overflow-hidden" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: POS_THEME.border }}>
              <div className="flex items-center gap-2">
                <Banknote size={15} style={{ color: POS_THEME.amber }} />
                <h3 className="text-sm font-bold text-white">Opening Cash</h3>
              </div>
              <button type="button" onClick={() => setShowOpeningCash(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/70"><X size={14} /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-white/60">Enter float amount in drawer at shift start. Saved to Finance.</p>
              <input autoFocus type="number" min="0" step="0.01" placeholder="e.g. 5000" value={openingCashAmount} onChange={e => setOpeningCashAmount(e.target.value)}
                className="w-full h-10 px-3 rounded-xl text-sm font-bold border outline-none text-white placeholder:text-white/40"
                style={{ background: POS_THEME.bg, borderColor: POS_THEME.border }}
                onKeyDown={e => { if (e.key === 'Enter') submitOpeningCash() }} />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowOpeningCash(false)} className="flex-1 h-10 rounded-xl text-sm font-semibold border text-white" style={{ borderColor: POS_THEME.border }}>Cancel</button>
                <button type="button" onClick={submitOpeningCash} disabled={openingCashLoading}
                  className="flex-1 h-10 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${POS_THEME.amber}, ${POS_THEME.amberDark})` }}>
                  {openingCashLoading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Save & Open Drawer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cash In / Out ── */}
      {showCashFlow && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCashFlow(false)}>
          <div data-pos="dark" className="w-full max-w-sm rounded-2xl shadow-2xl border overflow-hidden" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: POS_THEME.border }}>
              <div className="flex items-center gap-2">
                <Banknote size={15} style={{ color: POS_THEME.green }} />
                <h3 className="text-sm font-bold text-white">Cash In / Out</h3>
              </div>
              <button type="button" onClick={() => setShowCashFlow(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/70"><X size={14} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(['IN', 'OUT'] as const).map(mode => (
                  <button key={mode} type="button" onClick={() => setCashFlowMode(mode)}
                    className="h-9 rounded-xl text-xs font-bold border text-white"
                    style={cashFlowMode === mode
                      ? { background: mode === 'IN' ? `${POS_THEME.green}33` : `${POS_THEME.red}33`, borderColor: mode === 'IN' ? POS_THEME.green : POS_THEME.red }
                      : { background: POS_THEME.bg, borderColor: POS_THEME.border }}>
                    Cash {mode === 'IN' ? 'In' : 'Out'}
                  </button>
                ))}
              </div>
              <input type="number" min="0" step="0.01" placeholder="Amount (LKR)" value={cashFlowAmount} onChange={e => setCashFlowAmount(e.target.value)}
                className="w-full h-10 px-3 rounded-xl text-sm font-bold border outline-none text-white placeholder:text-white/40"
                style={{ background: POS_THEME.bg, borderColor: POS_THEME.border }} />
              <input type="text" placeholder="Note (optional)" value={cashFlowNote} onChange={e => setCashFlowNote(e.target.value)}
                className="w-full h-10 px-3 rounded-xl text-sm border outline-none text-white placeholder:text-white/40"
                style={{ background: POS_THEME.bg, borderColor: POS_THEME.border }} />
              <button type="button" onClick={submitCashFlow} disabled={cashFlowLoading}
                className="w-full h-10 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ background: cashFlowMode === 'IN' ? `linear-gradient(135deg, ${POS_THEME.green}, ${POS_THEME.greenDark})` : `linear-gradient(135deg, ${POS_THEME.red}, ${POS_THEME.redDark})` }}>
                {cashFlowLoading ? <Loader2 size={14} className="animate-spin mx-auto" /> : `Record Cash ${cashFlowMode === 'IN' ? 'In' : 'Out'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── More Menu ── */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowMoreMenu(false)}>
          <div data-pos="dark" className="w-full max-w-sm rounded-2xl shadow-2xl border overflow-hidden" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: POS_THEME.border }}>
              <h3 className="text-sm font-bold text-white">More Actions</h3>
              <button type="button" onClick={() => setShowMoreMenu(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/70"><X size={14} /></button>
            </div>
            <div className="p-3 space-y-1.5">
              {[
                { label: `Held Carts (${heldCarts.length})`, icon: Archive, onClick: () => { setShowMoreMenu(false); setShowHeldCarts(true) } },
                { label: 'Calculator (F12)', icon: Calculator, onClick: () => { setShowMoreMenu(false); setShowCalc(true) } },
                { label: 'Open Cash Drawer', icon: Banknote, onClick: () => { setShowMoreMenu(false); openDrawer() } },
                { label: 'Print Draft', icon: Printer, onClick: () => { setShowMoreMenu(false); cart.length > 0 ? setShowDocPreview('DRAFT') : toast.error('Cart is empty') } },
                { label: 'Save Quote (F7)', icon: FileText, onClick: () => { setShowMoreMenu(false); cart.length > 0 ? setShowDocPreview('QUOTE') : toast.error('Cart is empty') } },
                { label: 'Draft Invoice (F8)', icon: FilePlus2, onClick: () => { setShowMoreMenu(false); cart.length > 0 ? setShowDocPreview('DRAFT') : toast.error('Cart is empty') } },
                { label: 'WhatsApp Share', icon: MessageCircle, onClick: () => { setShowMoreMenu(false); shareWhatsApp() } },
              ].map(({ label, icon: Icon, onClick }) => (
                <button key={label} type="button" onClick={onClick}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold text-white hover:bg-white/5 border"
                  style={{ borderColor: POS_THEME.border }}>
                  <Icon size={15} style={{ color: POS_THEME.muted }} />{label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showReturnModal && (
        <PosReturnModal onClose={() => setShowReturnModal(false)} onDone={() => { refetchProducts(); setActiveNavId('products') }} />
      )}

      {/* ── Held Carts Modal ── */}
      {showHeldCarts && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div data-pos="dark" className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}>
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
                  <div className="flex justify-between text-base font-extrabold mt-2 pt-2 border-t border-gray-200" style={{ color }}><span>Total</span><span>{formatCurrency(saleTotal)}</span></div>
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
        <div className="fixed inset-0 z-[110] flex" data-pos="dark">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setShowRecentInvoices(false)} />
          <div className="w-[480px] flex flex-col shadow-2xl" style={{ background: POS_THEME.card, borderLeft: `1px solid ${POS_THEME.border}` }}>
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
                  <button type="button" onClick={() => reprintSale(sale)} title="Reprint" className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-violet-500/15 hover:text-violet-400 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    <Printer size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </>
  )
}

export function POSOverlay() {
  const { posOpen, closePos } = useUIStore()
  const hasPos = useFeatureFlag('POS')

  useEffect(() => {
    if (posOpen && !hasPos) closePos()
  }, [posOpen, hasPos, closePos])

  useEffect(() => {
    if (!posOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [posOpen])

  useEffect(() => {
    if (!posOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName ?? '')) {
        closePos()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [posOpen, closePos])

  if (!posOpen || !hasPos) return null

  return (
    <AnimatePresence>
      <motion.div
        key="pos-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        data-pos="dark"
        className="pos-shell fixed inset-0 z-[100] flex flex-col overflow-hidden h-screen"
        style={{ background: '#0B0E14' }}
      >
        <POSContent onClose={closePos} />
      </motion.div>
    </AnimatePresence>
  )
}
