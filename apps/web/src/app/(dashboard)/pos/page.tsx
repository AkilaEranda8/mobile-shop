'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Search, Plus, Minus, CreditCard, Banknote, Smartphone, Receipt,
  ScanLine, X, Loader2, UserPlus, Edit2, Check, Download, Tag,
} from 'lucide-react'
import { useProducts, useCustomers } from '@/lib/hooks'
import { salesApi, customersApi, productsApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { getInvoiceSettings, type InvoiceSettings } from '@/lib/invoiceSettings'
import InvoicePrint, { type InvoiceData } from '@/components/invoice/InvoicePrint'

interface CartItem {
  productId: string
  name: string
  sku: string
  price: number
  originalPrice: number
  quantity: number
  imei?: string
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
  const a4Ref                                   = useRef<HTMLDivElement>(null)

  const { data: productsData } = useProducts({ limit: '500' })
  const { data: customersData, refetch: refetchCustomers } = useCustomers({ limit: '200' })

  const products: any[]  = (productsData  as any)?.data ?? []
  const customers: any[] = (customersData as any)?.data ?? []

  // Fetch categories once
  useEffect(() => {
    productsApi.categories().then((res: any) => {
      const cats = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
      setCategories(cats)
    }).catch(() => {})
  }, [])

  const filtered = products.filter((p: any) => {
    const matchCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory || p.categoryName === selectedCategory
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { productId: product.id, name: product.name, sku: product.sku ?? '', price: product.sellingPrice, originalPrice: product.sellingPrice, quantity: 1 }]
    })
  }

  const updateQty = (id: string, delta: number) =>
    setCart(prev => prev.map(i => i.productId === id ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0))

  const saveEditPrice = (id: string) => {
    const val = parseFloat(editPriceVal)
    if (!isNaN(val) && val > 0) setCart(prev => prev.map(i => i.productId === id ? { ...i, price: val } : i))
    setEditPriceId(null)
  }

  const subtotal       = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const discountAmount = discountMode === '%' ? (subtotal * discountPct) / 100 : Math.min(discountFlat, subtotal)
  const afterDiscount  = subtotal - discountAmount
  const tax            = 0
  const total          = afterDiscount

  const shopName = authStorage.getUser()?.name?.split(' ')[0] + ' Shop' || 'Our Shop'
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() => getInvoiceSettings())
  useEffect(() => { setInvoiceSettings(getInvoiceSettings()) }, [completedSale])

  // Auto-download invoice after sale completes
  useEffect(() => {
    if (!completedSale) return
    const timer = setTimeout(() => { downloadInvoice() }, 400)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSale])

  // Keyboard shortcut: F9 or Ctrl+Enter = checkout
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'F9') || (e.ctrlKey && e.key === 'Enter')) {
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
          productId:   i.productId,
          productName: i.name,
          sku:         i.sku,
          quantity:    i.quantity,
          unitPrice:   i.price,
          total:       i.price * i.quantity,
          imei:        i.imei,
        })),
        payments: [{ method: paymentMethod, amount: total }],
      })
      setCompletedSale({
        ...res.data,
        items: cart.map(i => ({ productName: i.name, sku: i.sku, imei: i.imei, quantity: i.quantity, unitPrice: i.price, total: i.price * i.quantity })),
        payments: [{ method: paymentMethod, amount: total }],
        customerName:  selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone || '',
        cashierName:   user?.name || 'Staff',
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
      terms:         s.terms?.length ? s.terms : [
        'Payment is due upon receipt of this invoice.',
        'All sales are final unless otherwise agreed.',
        s.footerNote || 'Thank you for your business!',
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
  }

  const handleCustomerCreated = useCallback((c: any) => {
    refetchCustomers?.()
    setSelectedCustomer(c)
  }, [refetchCustomers])

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* ── Left: Product Grid ── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Point of Sale</h1>
          <span className="badge-status border border-green-500/20 bg-green-500/10 text-green-400 text-xs">LIVE</span>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder="Search by name or SKU…" className="input-field pl-9"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="relative">
            <ScanLine size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder="Scan IMEI" className="input-field pl-9 w-36" />
          </div>
        </div>

        {/* ── Category Tabs ── */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[{ id: 'ALL', name: 'All' }, ...categories].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-violet-500 border-violet-500 text-white shadow-lg shadow-violet-500/20'
                    : 'border-white/10 text-slate-400 hover:border-violet-500/40 hover:text-white bg-white/3'
                }`}>
                {cat.name}
                {cat.id !== 'ALL' && (
                  <span className="ml-1.5 text-[10px] opacity-60">
                    {products.filter(p => p.categoryId === cat.id || p.categoryName === cat.name).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && products.length > 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-center opacity-40">
              <p className="text-sm text-slate-500">No products in this category</p>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((product) => (
              <button key={product.id} onClick={() => addToCart(product)} disabled={product.stock === 0}
                className={`text-left p-3.5 rounded-xl border transition-all ${product.stock === 0 ? 'border-white/5 opacity-40 cursor-not-allowed bg-white/2' : 'border-white/5 bg-[#0f1623] hover:border-violet-500/30 hover:bg-violet-500/5 active:scale-95'}`}>
                <div className="w-full h-14 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 rounded-lg mb-2.5 flex items-center justify-center">
                  <Smartphone size={22} className="text-violet-400 opacity-60" />
                </div>
                <p className="text-xs font-semibold text-slate-200 truncate">{product.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{product.categoryName ?? product.sku}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-white">{formatCurrency(product.sellingPrice)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${product.stock < 5 ? 'text-red-400 border-red-500/20 bg-red-500/10' : 'text-green-400 border-green-500/20 bg-green-500/10'}`}>
                    {product.stock === 0 ? 'Out' : `${product.stock}`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Cart / Invoice ── */}
      <div className="w-80 xl:w-96 flex flex-col bg-[#0a0f1a] border border-white/5 rounded-2xl overflow-hidden flex-shrink-0">

        {/* ── POST-SALE INVOICE VIEW ── */}
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

            {/* Invoice mini-preview */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="bg-white/3 rounded-xl border border-white/5 p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Customer</p>
                <p className="text-xs font-semibold text-slate-200">{completedSale.customerName}</p>
                {completedSale.customerPhone && <p className="text-[10px] text-slate-500">{completedSale.customerPhone}</p>}
              </div>
              <div className="bg-white/3 rounded-xl border border-white/5 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Items</p>
                </div>
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
                {[
                  { label: 'Subtotal',  value: formatCurrency(subtotal)       },
                  { label: 'Discount',  value: `-${formatCurrency(discountAmount)}`, hide: !discountAmount },
                ].filter(r => !r.hide).map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs text-slate-400"><span>{label}</span><span>{value}</span></div>
                ))}
                <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-white/5">
                  <span>Total</span><span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/5 space-y-2">
              <button onClick={() => setShowA4Invoice(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10 transition-colors">
                <Receipt size={13} /> View A4 Invoice
              </button>
              <button onClick={downloadInvoice} disabled={downloading}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 transition-colors disabled:opacity-50">
                {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {downloading ? 'Generating PDF…' : 'Download Invoice PDF'}
              </button>
              <button onClick={handleNewSale} className="btn-primary w-full text-sm">New Sale</button>
            </div>

            {/* Hidden A4 invoice for PDF capture */}
            {completedSale && (() => { const d = buildA4Data(); return d ? (
              <div style={{ position: 'fixed', left: '-9999px', top: 0, width: 794, pointerEvents: 'none' }}>
                <InvoicePrint ref={a4Ref} data={d} hideControls />
              </div>
            ) : null })()}
          </div>

        ) : (
          <>
            {/* Cart Header + Customer */}
            <div className="p-4 border-b border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">Cart ({cart.length})</h3>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-slate-500 hover:text-red-400 transition-colors p-1">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Customer select + register */}
              <div className="flex gap-1.5">
                <select className="input-field text-xs flex-1"
                  value={selectedCustomer?.id || ''}
                  onChange={e => {
                    const c = customers.find((x: any) => x.id === e.target.value)
                    setSelectedCustomer(c || null)
                  }}>
                  <option value="">Walk-in Customer</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>
                  ))}
                </select>
                <button onClick={() => setShowRegister(true)} title="Register new customer"
                  className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-colors flex-shrink-0">
                  <UserPlus size={14} />
                </button>
              </div>
              {selectedCustomer && (
                <p className="text-[10px] text-cyan-400 pl-1">✓ {selectedCustomer.name} · {selectedCustomer.phone}</p>
              )}
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                  <Receipt size={30} className="text-slate-600 mb-2" />
                  <p className="text-sm text-slate-500">Add items to cart</p>
                </div>
              ) : cart.map((item) => (
                <div key={item.productId} className="p-2.5 rounded-xl bg-white/3 border border-white/5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{item.name}</p>
                      {/* Editable unit price */}
                      {editPriceId === item.productId ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <input autoFocus type="number" min="0"
                            className="w-20 bg-white/5 border border-violet-500/40 rounded px-1.5 py-0.5 text-xs text-white"
                            value={editPriceVal}
                            onChange={e => setEditPriceVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEditPrice(item.productId); if (e.key === 'Escape') setEditPriceId(null) }} />
                          <button onClick={() => saveEditPrice(item.productId)} className="text-green-400 hover:text-green-300"><Check size={12} /></button>
                          <button onClick={() => setEditPriceId(null)} className="text-slate-500 hover:text-white"><X size={12} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditPriceId(item.productId); setEditPriceVal(String(item.price)) }}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-400 transition-colors mt-0.5">
                          {formatCurrency(item.price)} each
                          {item.price !== item.originalPrice && <span className="text-green-400 text-[9px]">edited</span>}
                          <Edit2 size={9} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.productId, -1)} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors">
                        <Minus size={10} />
                      </button>
                      <span className="text-xs font-bold text-white w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.productId, 1)} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-green-500/20 flex items-center justify-center text-slate-400 hover:text-green-400 transition-colors">
                        <Plus size={10} />
                      </button>
                    </div>
                    <span className="text-xs font-bold text-white min-w-[56px] text-right">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-white/5 space-y-3">
                {/* Discount */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Tag size={11} className="text-slate-500" />
                    <span className="text-xs text-slate-500 flex-1">Discount</span>
                    <div className="flex rounded-lg border border-white/10 overflow-hidden text-[10px]">
                      {(['%', 'flat'] as const).map(m => (
                        <button key={m} onClick={() => setDiscountMode(m)}
                          className={`px-2.5 py-1 transition-colors ${discountMode === m ? 'bg-violet-500/20 text-violet-300' : 'text-slate-500 hover:text-white'}`}>
                          {m === '%' ? 'Percent' : 'Flat'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {discountMode === '%' ? (
                    <div className="flex items-center gap-2">
                      <input type="range" min="0" max="50" value={discountPct}
                        onChange={e => setDiscountPct(Number(e.target.value))}
                        className="flex-1 accent-violet-500" />
                      <input type="number" min="0" max="50"
                        className="w-14 input-field text-xs py-1 text-center"
                        value={discountPct} onChange={e => setDiscountPct(Math.min(50, Number(e.target.value)))} />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="number" min="0"
                        className="flex-1 input-field text-xs py-1.5"
                        placeholder="Amount"
                        value={discountFlat || ''}
                        onChange={e => setDiscountFlat(Number(e.target.value))} />
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="space-y-1.5 text-xs bg-white/2 rounded-xl p-3 border border-white/5">
                  <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Discount {discountMode === '%' ? `(${discountPct}%)` : '(flat)'}</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-white text-sm border-t border-white/10 pt-1.5">
                    <span>Total</span><span>{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="grid grid-cols-3 gap-1.5">
                  {([['CASH', Banknote, 'Cash'], ['CARD', CreditCard, 'Card'], ['UPI', Smartphone, 'UPI']] as const).map(([method, Icon, label]) => (
                    <button key={method} onClick={() => setPaymentMethod(method)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs transition-all ${paymentMethod === method ? 'border-violet-500 bg-violet-500/15 text-violet-300' : 'border-white/10 text-slate-500 hover:border-white/20'}`}>
                      <Icon size={14} />{label}
                    </button>
                  ))}
                </div>

                {checkoutError && <p className="text-xs text-red-400 text-center">{checkoutError}</p>}
                <button onClick={handleCheckout} disabled={checkoutLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-60">
                  {checkoutLoading ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />}
                  {checkoutLoading ? 'Processing…' : <>{`Charge ${formatCurrency(total)}`} &nbsp;<kbd className="text-[9px] opacity-50 font-mono">F9</kbd></>}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showRegister && (
        <RegisterCustomerModal onClose={() => setShowRegister(false)} onCreated={handleCustomerCreated} />
      )}

      {/* ── A4 Invoice Modal ── */}
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
              <button onClick={() => setShowA4Invoice(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded-lg border border-white/10 transition-colors">
                <X size={13} /> Close
              </button>
            </div>
            <InvoicePrint data={a4Data} />
          </div>
        )
      })()}
    </div>
  )
}
