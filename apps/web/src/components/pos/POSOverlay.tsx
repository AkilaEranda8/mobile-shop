'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, Plus, Minus, CreditCard, Banknote, Smartphone, Receipt,
  ScanLine, X, Loader2, UserPlus, Check, Download, Tag, Printer,
  Heart, Trash2, ChevronRight, ChevronLeft, ChevronDown, Archive,
  FileText, FilePlus2, Calculator, SlidersHorizontal, Package, Tablet,
  Headphones, Wrench, PackageSearch, ShoppingBag, User, CheckCircle2, Shield,
  Menu, ShoppingCart, Bell, Wifi, Cloud, TrendingUp, MoreHorizontal,
  Grid3X3, List as ListIcon, MessageCircle, Star, RefreshCw, RotateCcw,
  LayoutGrid, Hash, Wallet, Users, PhoneCall, PlayCircle, Lock, AlertTriangle, Calendar,
} from 'lucide-react'
import { HexaPosLayout, categoryIcon } from './HexaPosLayout'
import { StudioPosLayout } from './StudioPosLayout'
import { POS_THEME, syncPosThemeRuntime } from './pos-theme'
import { PosReturnModal } from './PosReturnModal'
import { PosReloadPanel, type ReloadProvider } from './PosReloadPanel'
import type { CartItem } from './types'
import { buildPosNavItems, buildCategoryTabs, buildBottomActions } from './pos-features'
import {
  isQtyLockedLine,
  getWarrantyCartItems,
  extractSaleWarrantyCodes,
  extractSaleWarranties,
  formatWarrantyMonths,
  posWarrantyMonthsLabel,
  POS_WARRANTY_MONTHS_OPTS,
} from './cart-rules'
import { useUIStore } from '@/stores/ui-store'
import { useProducts, useFeatureFlag, useCanSeeProductCost } from '@/lib/hooks'
import { salesApi, customersApi, productsApi, imeiApi, servicesApi, financeApi, tenantApi, dailyClosingApi } from '@/lib/api'
import { findProductByCode, isImeiCode, normalizeScanCode } from '@/lib/barcode-scan'
import { authStorage } from '@/lib/auth'
import { getOperationalBranchId, ensureOperationalBranch } from '@/lib/active-branch'
import { formatCurrency } from '@/lib/utils'
import { businessToday } from '@/lib/business-date'
import toast from 'react-hot-toast'
import { getInvoiceSettings, fetchInvoiceSettings, shopContextFromTenant, resolveInvoiceTemplate, HEXALYTE_SOFTWARE_FOOTER, type InvoiceSettings, type ShopContext } from '@/lib/invoiceSettings'
import { usePaymentMethods, type PaymentMethodKey } from '@/lib/payment-methods'
import { ChequeDetailsFields, formatChequeReference, todayChequeDate } from '@/components/payments/ChequeDetailsFields'
import {
  usePosUiSettings,
  gridColsClass,
  resolvePosShortcutAction,
  type PosShortcutActionId,
} from '@/lib/posUiSettings'
import { cacheProductsForOffline, cacheCategoriesForOffline, getCachedProducts, getCachedCategories } from '@/lib/offline/products-cache'
import { buildOfflineInvoiceNumber, queueOfflineSale } from '@/lib/offline/queue-sale'
import { isBrowserOnline, isNetworkError } from '@/lib/offline/sync'
import InvoiceA4View from '@/components/invoice/InvoiceA4View'
import { printThermalReceipt, openReceiptPrintWindow } from '@/components/invoice/ThermalReceipt'
import { printStockFormInvoice } from '@/components/invoice/StockFormInvoice'
import { whatsappApi, formatWhatsAppPhone } from '@/lib/whatsapp-api'
import { captureElementAsPdfBase64 } from '@/lib/invoice-pdf'
import { Switch } from '@/components/ui/Switch'
import { resolveCatalogPrice, type PriceMode } from '@/lib/productPrice'

function receiptCustomerCity(customer?: { city?: string; address?: string } | null): string {
  return customer?.city?.trim() || customer?.address?.trim() || ''
}

function posSellableStock(item: { trackImei?: boolean; stock?: number; imeiInStock?: number; storageVariations?: unknown }, hasIMEI: boolean): number {
  if (item.trackImei && hasIMEI) {
    if (typeof item.imeiInStock === 'number') return item.imeiInStock
    const vars = Array.isArray(item.storageVariations) ? item.storageVariations as Array<{ stock?: number }> : []
    if (vars.length > 0) return vars.reduce((sum, v) => sum + (v.stock ?? 0), 0)
  }
  return item.stock ?? 0
}

function posStockLabel(item: { trackImei?: boolean; stock?: number; imeiInStock?: number; storageVariations?: unknown }, hasIMEI: boolean): { label: string; color: string; isOut: boolean; isLow: boolean } {
  const qty = posSellableStock(item, hasIMEI)
  const isOut = qty === 0
  const isLow = !isOut && qty <= 4
  const color = isOut ? POS_THEME.muted : isLow ? POS_THEME.amber : POS_THEME.green
  if (item.trackImei && hasIMEI) {
    return {
      label: isOut ? 'No IMEI registered' : `${qty} IMEI in stock`,
      color,
      isOut,
      isLow,
    }
  }
  return {
    label: isOut ? 'Out of stock' : isLow ? `Low stock (${qty})` : `In stock (${qty})`,
    color,
    isOut,
    isLow,
  }
}

function cartToReceiptItems(cart: CartItem[]) {
  return cart.map(i => ({
    productName: i.name,
    sku: i.sku,
    imei: i.imei,
    quantity: i.quantity,
    unitPrice: i.price,
    total: i.price * i.quantity,
    warrantyMonths: i.warrantyMonths ?? 0,
    warrantyNote: i.warrantyNote,
    condition: i.condition,
  }))
}

type PosReceiptSale = Parameters<typeof printStockFormInvoice>[0]

function printPosReceipt(
  sale: PosReceiptSale,
  settings: InvoiceSettings,
  ctx?: ShopContext,
  targetWindow?: Window | null,
) {
  if (settings.thermalWidthPOS === 'stockForm') {
    return printStockFormInvoice(sale, settings, ctx, { targetWindow })
  }
  return printThermalReceipt(sale, settings, ctx, { targetWindow })
}

function autoPrintPosReceipt(
  sale: PosReceiptSale,
  settings: InvoiceSettings,
  ctx?: ShopContext,
  targetWindow?: Window | null,
) {
  if (settings.posAutoPrintBill === false) {
    try { targetWindow?.close() } catch { /* ignore */ }
    return
  }
  // Pre-opened popup may die during checkout await — null triggers iframe fallback
  const win = targetWindow && !targetWindow.closed ? targetWindow : null
  const ok = printPosReceipt(sale, settings, ctx, win)
  if (!ok) toast.error('Could not open the print dialog — try Print Receipt on the success screen')
}

import type { ProductVariation } from '@/types'
import { filterImeisForVariant, imeiMatchesProductVariant, parseImeiListResponse } from '@/lib/product-imei-match'

const DAY_END_DENOMS: Array<{ key: string; label: string; value: number }> = [
  { key: 'd5000', label: '5000', value: 5000 },
  { key: 'd2000', label: '2000', value: 2000 },
  { key: 'd1000', label: '1000', value: 1000 },
  { key: 'd500', label: '500', value: 500 },
  { key: 'd100', label: '100', value: 100 },
  { key: 'd50', label: '50', value: 50 },
  { key: 'd20', label: '20', value: 20 },
  { key: 'd10', label: '10', value: 10 },
  { key: 'd5', label: '5', value: 5 },
  { key: 'd2', label: '2', value: 2 },
  { key: 'd1', label: '1', value: 1 },
]

const emptyDayEndCash = () => ({
  d5000: 0, d2000: 0, d1000: 0, d500: 0, d100: 0, d50: 0, d20: 0, d10: 0,
  d5: 0, d2: 0, d1: 0, coins: 0,
})

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
            background: isPaid ? IV.teal : 'var(--status-warn)',
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
          <p style={{ margin: 0, fontSize: 9, color: '#1e4035' }}>{HEXALYTE_SOFTWARE_FOOTER}</p>
        </div>
      </div>

      {/* ═══ BOTTOM ACCENT BAR ═════════════════════════════════════════════ */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${IV.teal2} 0%, ${IV.teal} 50%, ${IV.teal2} 100%)` }} />
    </div>
  )
}

/* ── Register Customer (inline in customer dropdown) ─────────────────────── */
function RegisterCustomerInline({ onBack, onCreated }: { onBack: () => void; onCreated: (c: any) => void }) {
  const hasCustomerCredit = useFeatureFlag('CUSTOMER_CREDIT')
  const [form, setForm] = useState({ name: '', phone: '', email: '', openingDue: '' })
  const [loading, setLoading] = useState(false)

  const inputCls = 'w-full h-11 px-3 rounded-xl text-sm outline-none border text-white placeholder:text-white/50'
  const inputStyle = { background: POS_THEME.bg, borderColor: POS_THEME.border }

  const submit = async () => {
    if (!form.name || !form.phone) return toast.error('Name and phone required')
    setLoading(true)
    try {
      const openingDue = hasCustomerCredit ? Math.max(0, Number(form.openingDue) || 0) : 0
      const res: any = await customersApi.create({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        branchId: getOperationalBranchId() || undefined,
        ...(openingDue > 0 ? { openingDue } : {}),
      })
      toast.success(openingDue > 0
        ? `Customer registered · prior credit ${formatCurrency(openingDue)}`
        : 'Customer registered')
      onCreated(res?.data)
    } catch (e: any) {
      if (e?.status === 409 || e?.message?.toLowerCase().includes('already')) {
        try {
          const found: any = await customersApi.search(form.phone)
          const existing = found?.data?.[0] ?? found?.[0]
          if (existing) {
            toast.success(`Existing customer selected: ${existing.name}`)
            onCreated(existing)
            return
          }
        } catch { /* fall through */ }
      }
      toast.error(e?.message ?? 'Failed')
    }
    finally { setLoading(false) }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: POS_THEME.border }}>
        <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/5 text-white/70" title="Back">
          <ChevronLeft size={18} />
        </button>
        <UserPlus size={16} className="text-violet-400" />
        <span className="text-sm font-bold text-white">New Customer</span>
      </div>
      <div>
        <label className="text-xs font-medium text-white/70 mb-1.5 block">Full Name *</label>
        <input className={inputCls} style={inputStyle} placeholder="Customer name" autoFocus
          value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') submit() }} />
      </div>
      <div>
        <label className="text-xs font-medium text-white/70 mb-1.5 block">Phone *</label>
        <input className={inputCls} style={inputStyle} placeholder="Phone number"
          value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') submit() }} />
      </div>
      <div>
        <label className="text-xs font-medium text-white/70 mb-1.5 block">Email (optional)</label>
        <input className={inputCls} style={inputStyle} placeholder="email@example.com" type="email"
          value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') submit() }} />
      </div>
      {hasCustomerCredit && (
        <div>
          <label className="text-xs font-medium text-white/70 mb-1.5 block">Prior credit (LKR, optional)</label>
          <input className={inputCls} style={inputStyle} type="number" min={0} step="0.01" placeholder="0.00"
            value={form.openingDue} onChange={e => setForm(p => ({ ...p, openingDue: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') submit() }} />
          <p className="text-[10px] text-white/40 mt-1">Old outstanding before Hexalyte — not counted as a shop sale</p>
        </div>
      )}
      <button type="button" onClick={submit} disabled={loading}
        className="w-full h-11 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center mt-1"
        style={{ background: POS_THEME.purple }}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : 'Save Customer'}
      </button>
    </div>
  )
}

/* ── Retail / Wholesale / Credit (for price popups only) ─────────────────── */
function PriceModeToggle({
  mode,
  onChange,
  showWholesale,
  showCredit,
}: {
  mode: PriceMode
  onChange: (mode: PriceMode) => void
  showWholesale?: boolean
  showCredit?: boolean
}) {
  if (!showWholesale && !showCredit) return null
  const btn = (key: PriceMode, label: string, title: string) => (
    <button
      type="button"
      onClick={() => onChange(key)}
      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200"
      style={mode === key
        ? { background: POS_THEME.card, color: POS_THEME.text, boxShadow: '0 1px 3px rgba(0,0,0,0.35)', border: `1px solid ${POS_THEME.border}` }
        : { background: 'transparent', color: POS_THEME.muted, border: '1px solid transparent' }}
      title={title}
    >
      {label}
    </button>
  )
  return (
    <div
      className="flex items-center rounded-xl border p-0.5 gap-0.5 w-fit"
      style={{ borderColor: POS_THEME.border, background: POS_THEME.bg }}
    >
      {btn('retail', 'Retail', 'Retail catalog price')}
      {showWholesale && btn('wholesale', 'Wholesale', 'Wholesale catalog price (falls back to retail if unset)')}
      {showCredit && btn('credit', 'Credit', 'Credit catalog price (falls back to retail if unset)')}
    </div>
  )
}

/* ── Variation Picker Modal (single popup — all options at once) ───────── */
function VariationPickerModal({
  product,
  variations,
  branchId,
  priceMode = 'retail',
  allowPriceEdit = false,
  showWholesale = false,
  showCredit = false,
  showWarranty = false,
  onPriceModeChange,
  onClose,
  onAdd,
}: {
  product: any
  variations: ProductVariation[]
  branchId?: string
  priceMode?: PriceMode
  allowPriceEdit?: boolean
  showWholesale?: boolean
  showCredit?: boolean
  showWarranty?: boolean
  onPriceModeChange?: (mode: PriceMode) => void
  onClose: () => void
  onAdd: (
    v: ProductVariation,
    imei?: string,
    price?: number,
    warranty?: { months: number; note?: string },
  ) => void
}) {
  const storageOptions = [...new Set(variations.map(v => v.storage))]
  const preferStorage = typeof product._scanPreferStorage === 'string' ? product._scanPreferStorage : ''
  const preferColor = typeof product._scanPreferColor === 'string' ? product._scanPreferColor : ''
  const [selStorage, setSelStorage] = useState<string>(
    (preferStorage && storageOptions.includes(preferStorage) ? preferStorage : storageOptions[0]) ?? '',
  )

  const colorOptions = variations.filter(v => v.storage === selStorage)
  const [selColor, setSelColor] = useState<string>(() => {
    const colors = variations.filter(v => v.storage === (preferStorage && storageOptions.includes(preferStorage) ? preferStorage : storageOptions[0]))
    if (preferColor && colors.some(c => c.colorName === preferColor)) return preferColor
    return colors[0]?.colorName ?? ''
  })

  const [imeis, setImeis] = useState<any[]>([])
  const [selImei, setSelImei] = useState<string>('')
  const [loadingImeis, setLoadingImeis] = useState(false)
  const [imeiScanValue, setImeiScanValue] = useState('')
  const [imeiScanError, setImeiScanError] = useState('')
  const imeiScanRef = useRef<HTMLInputElement>(null)
  const priceInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [warrantyMonths, setWarrantyMonths] = useState(() => String(Number(product.warrantyMonths ?? 0) || 0))
  const [warrantyNote, setWarrantyNote] = useState(() => String(product.warrantyNote ?? '').trim())

  const selected = variations.find(v => v.storage === selStorage && v.colorName === selColor)
  const catalogPrice = selected ? resolveCatalogPrice(selected, priceMode) : 0
  const [salePrice, setSalePrice] = useState(() => (catalogPrice > 0 ? String(catalogPrice) : ''))

  const showStorage = storageOptions.length > 1
  const showColor = colorOptions.length > 1 || storageOptions.some(st => variations.filter(v => v.storage === st).length > 1)
  const showImei = !!product.trackImei
  const showPriceBlock = allowPriceEdit || showWholesale || showCredit

  useEffect(() => {
    const next = selected ? resolveCatalogPrice(selected, priceMode) : 0
    setSalePrice(next > 0 ? String(next) : '')
  }, [selected?.storage, selected?.colorName, selected?.sellingPrice, selected?.wholesalePrice, selected?.creditPrice, priceMode])

  const availableImeis = filterImeisForVariant(imeis, selected, { variantCount: variations.length })

  useEffect(() => {
    const colorsForStorage = variations.filter(v => v.storage === selStorage)
    if (!colorsForStorage.some(v => v.colorName === selColor)) {
      setSelColor(colorsForStorage[0]?.colorName ?? '')
    }
  }, [selStorage, variations, selColor])

  const clearImeiSelection = () => {
    setSelImei('')
    setImeiScanValue('')
    setImeiScanError('')
  }

  useEffect(() => {
    if (product?.trackImei) {
      setLoadingImeis(true)
      const params: Record<string, string> = { productId: product.id, status: 'IN_STOCK', limit: '5000' }
      const effectiveBranch = branchId || undefined
      if (effectiveBranch) params.branchId = effectiveBranch
      imeiApi.list(params)
        .then((res: any) => {
          const list = parseImeiListResponse(res)
          setImeis(effectiveBranch ? list.filter((i: any) => i.branchId === effectiveBranch) : list)
        })
        .catch(() => setImeis([]))
        .finally(() => setLoadingImeis(false))
    }
  }, [product, branchId])

  useEffect(() => {
    if (availableImeis.length === 1) setSelImei(availableImeis[0].imei)
    else if (selImei && !availableImeis.some(i => i.imei === selImei)) setSelImei('')
  }, [availableImeis])

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (showImei) imeiScanRef.current?.focus()
      else if (allowPriceEdit) {
        priceInputRef.current?.focus()
        priceInputRef.current?.select()
      }
    }, 40)
    return () => window.clearTimeout(t)
  }, [showImei, allowPriceEdit])

  const handleImeiScanInModal = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    const imei = digits.length > 15 ? digits.slice(-15) : digits
    if (imei.length !== 15) {
      setImeiScanError('IMEI must be 15 digits')
      return false
    }
    const match = availableImeis.find(i => i.imei === imei)
    if (match) {
      setSelImei(imei)
      setImeiScanValue('')
      setImeiScanError('')
      toast.success('IMEI selected')
      return true
    }
    setImeiScanError('This IMEI is not in stock for this variant')
    return false
  }

  const parsedSalePrice = parseFloat(salePrice)
  const priceValid = !allowPriceEdit || (Number.isFinite(parsedSalePrice) && parsedSalePrice >= 0)
  const canAdd = !!selected
    && !(selected.stock != null && (selected.stock ?? 0) === 0)
    && !(product.trackImei && !selImei)
    && priceValid

  const confirmAdd = () => {
    if (!selected || !canAdd) return
    const months = showWarranty ? Math.max(0, parseInt(warrantyMonths, 10) || 0) : Number(product.warrantyMonths ?? 0)
    const note = showWarranty ? (warrantyNote.trim() || undefined) : (product.warrantyNote?.trim() || undefined)
    onAdd(
      selected,
      selImei || undefined,
      allowPriceEdit ? parsedSalePrice : undefined,
      showWarranty ? { months, note } : undefined,
    )
  }

  // Keyboard: Esc close, Enter add (or resolve IMEI scan first)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const isText = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        if (tag === 'TEXTAREA') return
        if (isText && imeiScanValue) {
          e.preventDefault()
          e.stopPropagation()
          handleImeiScanInModal(imeiScanValue)
          return
        }
        if (isText && tag === 'INPUT' && (e.target as HTMLInputElement).type === 'number') {
          e.preventDefault()
          e.stopPropagation()
          if (canAdd) confirmAdd()
          return
        }
        if (!isText) {
          e.preventDefault()
          e.stopPropagation()
          if (canAdd) confirmAdd()
        }
      }

      if (!isText && (showWholesale || showCredit)) {
        if (e.key === '1') { e.preventDefault(); onPriceModeChange?.('retail') }
        if (e.key === '2' && showWholesale) { e.preventDefault(); onPriceModeChange?.('wholesale') }
        if (e.key === '3' && showCredit) { e.preventDefault(); onPriceModeChange?.('credit') }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imeiScanValue, canAdd, salePrice, selImei, selected, showWholesale, showCredit, availableImeis])

  const { gradient, Icon: CardIcon, iconColor } = (() => {
    const cat = (product.categoryName ?? '').toLowerCase()
    if (cat.includes('mobile') || cat.includes('phone')) return { gradient: 'linear-gradient(135deg,#3b1fa5,#1d2fb5)', Icon: Smartphone, iconColor: '#818cf8' }
    if (cat.includes('tablet')) return { gradient: 'linear-gradient(135deg,#0e4f6e,#0e6e5a)', Icon: Tablet, iconColor: '#34d399' }
    if (cat.includes('accessor') || cat.includes('headphone')) return { gradient: 'linear-gradient(135deg,#5b1fa5,#8b1fa5)', Icon: Headphones, iconColor: '#c084fc' }
    return { gradient: 'linear-gradient(135deg,#1c2333,#151921)', Icon: Package, iconColor: '#9CA3AF' }
  })()

  const colorDot = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes('black')) return '#1a1a1a'
    if (n.includes('white') || n.includes('silver') || n.includes('star')) return '#e2e8f0'
    if (n.includes('gold') || n.includes('yellow')) return '#f59e0b'
    if (n.includes('red') || n.includes('rose')) return '#ef4444'
    if (n.includes('blue') || n.includes('sky') || n.includes('pacific')) return '#3b82f6'
    if (n.includes('green') || n.includes('midnight') || n.includes('alpine')) return '#10b981'
    if (n.includes('purple') || n.includes('violet')) return 'var(--brand-light)'
    if (n.includes('pink')) return '#ec4899'
    if (n.includes('orange')) return '#f97316'
    return '#6b7280'
  }

  const chip = (active: boolean) => ({
    background: active ? `linear-gradient(145deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})` : POS_THEME.bg,
    borderColor: active ? POS_THEME.purple : POS_THEME.border,
    color: active ? '#fff' : POS_THEME.text,
    boxShadow: active ? `0 6px 18px ${POS_THEME.purple}30` : 'none',
  } as const)

  const stockOut = selected?.stock != null && (selected.stock ?? 0) === 0
  const displayPrice = allowPriceEdit
    ? (Number.isFinite(parsedSalePrice) ? parsedSalePrice : catalogPrice)
    : catalogPrice

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(4,10,12,0.78)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Configure ${product.name}`}
        className="relative w-full sm:max-w-lg max-h-[min(88dvh,680px)] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl border overflow-hidden"
        style={{
          background: `radial-gradient(720px 220px at 50% -20%, ${POS_THEME.purple}1a 0%, transparent 55%), ${POS_THEME.card}`,
          borderColor: POS_THEME.border,
          boxShadow: `0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px ${POS_THEME.border}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start gap-2.5 px-3.5 sm:px-4 pt-3 pb-2.5 border-b" style={{ borderColor: POS_THEME.border }}>
          <div
            className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border"
            style={{ borderColor: POS_THEME.border, background: gradient }}
          >
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <CardIcon size={20} style={{ color: iconColor }} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm sm:text-[15px] font-extrabold leading-tight truncate" style={{ color: POS_THEME.text }}>{product.name}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {selected && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${POS_THEME.purple}24`, color: POS_THEME.purple, border: `1px solid ${POS_THEME.purple}44` }}
                >
                  {selected.storage} · {selected.colorName}
                </span>
              )}
              {selected?.stock != null && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: stockOut ? `${POS_THEME.red}18` : `${POS_THEME.green}18`,
                    color: stockOut ? POS_THEME.red : POS_THEME.green,
                    border: `1px solid ${stockOut ? POS_THEME.red : POS_THEME.green}44`,
                  }}
                >
                  {stockOut ? 'Out of stock' : `${selected.stock} in stock`}
                </span>
              )}
              {product.sku && (
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-full truncate max-w-[10rem]"
                  style={{ background: POS_THEME.bg, color: POS_THEME.muted, border: `1px solid ${POS_THEME.border}` }}
                >
                  {product.sku}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border hover:bg-black/5"
            style={{ borderColor: POS_THEME.border, color: POS_THEME.muted, background: POS_THEME.bg }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* All options — single scrollable page */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 sm:px-4 py-3 space-y-3">
          {showStorage && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5" style={{ color: POS_THEME.muted }}>Storage</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {storageOptions.map(s => {
                  const active = selStorage === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setSelStorage(s); clearImeiSelection() }}
                      className="h-10 rounded-xl text-sm font-extrabold border transition-all"
                      style={chip(active)}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {showColor && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5" style={{ color: POS_THEME.muted }}>Color</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {colorOptions.map(v => {
                  const active = selColor === v.colorName
                  return (
                    <button
                      key={v.colorName}
                      type="button"
                      onClick={() => { setSelColor(v.colorName); clearImeiSelection() }}
                      className="h-10 px-3 rounded-xl text-sm font-bold border flex items-center gap-2 transition-all"
                      style={chip(active)}
                    >
                      <span
                        className="w-4 h-4 rounded-full border-2 shrink-0"
                        style={{ background: colorDot(v.colorName), borderColor: active ? '#fff' : 'rgba(255,255,255,0.2)' }}
                      />
                      <span className="truncate flex-1 text-left">{v.colorName}</span>
                      {active && <Check size={14} className="shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {showImei && (
            <section className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: POS_THEME.muted }}>
                IMEI <span style={{ color: POS_THEME.red }}>*</span>
              </p>
              {loadingImeis ? (
                <div className="flex items-center gap-2 text-xs py-2" style={{ color: POS_THEME.muted }}>
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </div>
              ) : availableImeis.length === 0 ? (
                <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: `${POS_THEME.red}14`, color: POS_THEME.red, border: `1px solid ${POS_THEME.red}33` }}>
                  No IN_STOCK IMEIs for {selected?.storage} / {selected?.colorName}.
                </div>
              ) : (
                <>
                  <div
                    className="flex gap-2 items-center px-3 h-11 rounded-xl border"
                    style={{ background: `${POS_THEME.purple}14`, borderColor: `${POS_THEME.purple}55` }}
                  >
                    <ScanLine size={15} style={{ color: POS_THEME.purple }} className="shrink-0" />
                    <input
                      ref={imeiScanRef}
                      className="flex-1 bg-transparent outline-none text-sm font-mono tracking-wider placeholder:opacity-35"
                      style={{ color: POS_THEME.text }}
                      placeholder="Scan or type IMEI…"
                      value={imeiScanValue}
                      onChange={e => { setImeiScanValue(e.target.value); setImeiScanError('') }}
                    />
                  </div>
                  {imeiScanError && <p className="text-[11px]" style={{ color: POS_THEME.red }}>{imeiScanError}</p>}
                  <div className="relative">
                    <select
                      value={selImei}
                      onChange={e => { setSelImei(e.target.value); setImeiScanError(''); setImeiScanValue('') }}
                      className="w-full h-11 pl-3 pr-9 rounded-xl text-sm border outline-none appearance-none font-mono"
                      style={{
                        background: POS_THEME.bg,
                        borderColor: POS_THEME.border,
                        color: selImei ? POS_THEME.text : POS_THEME.muted,
                        colorScheme: 'dark',
                      }}
                    >
                      <option value="" disabled>Select from {availableImeis.length}</option>
                      {availableImeis.map(i => (
                        <option key={i.imei} value={i.imei}>{i.imei}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40" />
                  </div>
                </>
              )}
            </section>
          )}

          {showWarranty && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] flex items-center gap-1.5" style={{ color: POS_THEME.muted }}>
                  <Shield size={12} style={{ color: POS_THEME.green }} /> Warranty
                </p>
                <span className="text-[11px] font-bold" style={{ color: Number(warrantyMonths) > 0 ? POS_THEME.green : POS_THEME.muted }}>
                  {posWarrantyMonthsLabel(Number(warrantyMonths) || 0)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {POS_WARRANTY_MONTHS_OPTS.map(m => {
                  const active = warrantyMonths === String(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setWarrantyMonths(String(m))}
                      className="h-10 rounded-xl text-xs font-bold border transition-all"
                      style={active
                        ? { background: `${POS_THEME.green}22`, borderColor: `${POS_THEME.green}66`, color: POS_THEME.green }
                        : { background: POS_THEME.bg, borderColor: POS_THEME.border, color: POS_THEME.text }}
                    >
                      {posWarrantyMonthsLabel(m)}
                    </button>
                  )
                })}
              </div>
              <input
                type="text"
                placeholder="Warranty note (optional)"
                value={warrantyNote}
                onChange={e => setWarrantyNote(e.target.value)}
                className="w-full h-10 rounded-xl border px-3 text-xs outline-none placeholder:opacity-40"
                style={{ background: POS_THEME.bg, borderColor: POS_THEME.border, color: POS_THEME.text }}
              />
            </section>
          )}

          {showPriceBlock && selected && (
            <section className="space-y-2">
              {(showWholesale || showCredit) && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: POS_THEME.muted }}>Price type</p>
                  <PriceModeToggle
                    mode={priceMode}
                    onChange={mode => onPriceModeChange?.(mode)}
                    showWholesale={showWholesale}
                    showCredit={showCredit}
                  />
                </div>
              )}
              {allowPriceEdit ? (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: POS_THEME.muted }}>Sale price (LKR)</p>
                  <input
                    ref={priceInputRef}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    className="w-full h-11 px-3 rounded-xl text-lg font-extrabold outline-none border"
                    style={{ background: POS_THEME.bg, borderColor: POS_THEME.border, color: POS_THEME.text }}
                    value={salePrice}
                    onChange={e => setSalePrice(e.target.value)}
                  />
                  <p className="text-[10px] mt-1.5" style={{ color: POS_THEME.muted }}>
                    Catalog {formatCurrency(catalogPrice)}{selected.sku ? ` · ${selected.sku}` : ''}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border px-3 py-2.5 flex items-center justify-between" style={{ borderColor: POS_THEME.border, background: POS_THEME.bg }}>
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: POS_THEME.muted }}>Price</span>
                  <span className="text-lg font-extrabold" style={{ color: POS_THEME.text }}>{formatCurrency(catalogPrice)}</span>
                </div>
              )}
            </section>
          )}

          {!showPriceBlock && selected && (
            <div className="rounded-xl border px-3 py-2.5 flex items-center justify-between" style={{ borderColor: POS_THEME.border, background: POS_THEME.bg }}>
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: POS_THEME.muted }}>Price</span>
              <span className="text-lg font-extrabold" style={{ color: POS_THEME.text }}>{formatCurrency(catalogPrice)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 border-t px-3.5 sm:px-4 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] space-y-2"
          style={{ borderColor: POS_THEME.border, background: `${POS_THEME.panel}ee` }}
        >
          <div className="flex items-center justify-between gap-2 text-[11px] px-0.5">
            <span className="truncate" style={{ color: POS_THEME.muted }}>
              {selected ? `${selected.storage} · ${selected.colorName}` : 'Select variant'}
              {selImei ? ` · …${selImei.slice(-4)}` : ''}
            </span>
            <span className="font-extrabold shrink-0 text-sm" style={{ color: POS_THEME.text }}>
              {formatCurrency(displayPrice)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl text-xs font-bold border"
              style={{ background: POS_THEME.bg, borderColor: POS_THEME.border, color: POS_THEME.muted }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canAdd}
              onClick={confirmAdd}
              className="flex-[1.5] h-10 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-1.5 disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})`, boxShadow: `0 8px 18px ${POS_THEME.purple}35` }}
            >
              <ShoppingCart size={14} /> Add to cart
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Price prompt before add-to-cart (simple products / price edit) ─────── */
function PricePromptModal({
  productName,
  subtitle,
  catalogPrice,
  value,
  onChange,
  onConfirm,
  onClose,
  priceMode = 'retail',
  showWholesale = false,
  showCredit = false,
  onPriceModeChange,
}: {
  productName: string
  subtitle?: string
  catalogPrice: number
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  onClose: () => void
  priceMode?: PriceMode
  showWholesale?: boolean
  showCredit?: boolean
  onPriceModeChange?: (mode: PriceMode) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)
    return () => window.clearTimeout(t)
  }, [])

  const parsed = parseFloat(value)
  const valid = Number.isFinite(parsed) && parsed >= 0

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-0 sm:p-3"
      style={{ background: 'rgba(4,10,12,0.72)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Compact dialog sized for laptop — content-height, not a tall sheet */}
      <div
        className="relative w-full sm:w-[min(100%,380px)] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl border overflow-hidden"
        style={{
          background: `radial-gradient(640px 180px at 50% -30%, ${POS_THEME.purple}1a 0%, transparent 55%), ${POS_THEME.card}`,
          borderColor: POS_THEME.border,
          boxShadow: `0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px ${POS_THEME.border}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center gap-2.5 px-3.5 sm:px-4 pt-3 pb-2.5 border-b" style={{ borderColor: POS_THEME.border }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(145deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})`, boxShadow: `0 6px 14px ${POS_THEME.purple}28` }}
          >
            <Tag size={15} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-extrabold leading-tight truncate" style={{ color: POS_THEME.text }}>Set sale price</h3>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: POS_THEME.muted }}>
              {productName}{subtitle ? ` · ${subtitle}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border hover:bg-black/5"
            style={{ borderColor: POS_THEME.border, color: POS_THEME.muted, background: POS_THEME.bg }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-3.5 sm:px-4 py-3 space-y-3">
          {(showWholesale || showCredit) && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: POS_THEME.muted }}>Price type</p>
              <PriceModeToggle
                mode={priceMode}
                onChange={mode => onPriceModeChange?.(mode)}
                showWholesale={showWholesale}
                showCredit={showCredit}
              />
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5" style={{ color: POS_THEME.muted }}>Sale price (LKR)</p>
            <input
              ref={inputRef}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="w-full h-11 px-3 rounded-xl text-lg font-extrabold outline-none border"
              style={{ background: POS_THEME.bg, borderColor: POS_THEME.border, color: POS_THEME.text }}
              value={value}
              onChange={e => onChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); if (valid) onConfirm() }
                if (e.key === 'Escape') { e.preventDefault(); onClose() }
              }}
            />
            <p className="text-[11px] mt-1.5" style={{ color: POS_THEME.muted }}>
              Catalog {formatCurrency(catalogPrice)}
            </p>
          </div>
        </div>

        <div
          className="shrink-0 border-t px-3.5 sm:px-4 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))]"
          style={{ borderColor: POS_THEME.border, background: `${POS_THEME.panel}ee` }}
        >
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl text-xs font-bold border"
              style={{ background: POS_THEME.bg, borderColor: POS_THEME.border, color: POS_THEME.muted }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={onConfirm}
              className="flex-[1.5] h-10 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-1.5 disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})`, boxShadow: `0 8px 18px ${POS_THEME.purple}35` }}
            >
              <ShoppingCart size={14} /> Add to Cart
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
  const [priceMode, setPriceMode]               = useState<PriceMode>('retail')
  const [search, setSearch]                     = useState('')
  const [paymentMethodId, setPaymentMethodId]   = useState('CASH')
  const [chequeNumber, setChequeNumber]         = useState('')
  const [chequeDate, setChequeDate]             = useState(todayChequeDate)
  const payMethods = usePaymentMethods()
  const paymentMethod: PaymentMethodKey = payMethods.find(m => m.id === paymentMethodId)?.key
    ?? payMethods.find(m => m.key === paymentMethodId)?.key
    ?? 'CASH'
  const posUi = usePosUiSettings()
  useMemo(() => syncPosThemeRuntime(posUi.theme, posUi.accent), [posUi.theme, posUi.accent])
  const PosShell = posUi.theme === 'studio' ? StudioPosLayout : HexaPosLayout
  const payMethodsRef = useRef(payMethods)
  useEffect(() => {
    payMethodsRef.current = payMethods
    // Reset to cash if the selected method was removed from settings
    setPaymentMethodId(prev => payMethods.some(m => m.id === prev || m.key === prev) ? (payMethods.find(m => m.id === prev)?.id ?? payMethods.find(m => m.key === prev)?.id ?? 'CASH') : 'CASH')
  }, [payMethods])

  useEffect(() => {
    const mode = posUi.behavior.defaultPriceMode
    if (mode === 'wholesale' || mode === 'credit' || mode === 'retail') {
      setPriceMode(mode)
    }
  }, [posUi.behavior.defaultPriceMode])
  const [customerPaid, setCustomerPaid]         = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  const [discountPct, setDiscountPct]           = useState(0)
  const [discountFlat, setDiscountFlat]         = useState(0)
  const [discountMode, setDiscountMode]         = useState<'%' | 'flat'>('%')
  const [completedSale, setCompletedSale]       = useState<any>(null)
  const [checkoutLoading, setCheckoutLoading]   = useState(false)
  const [checkoutError, setCheckoutError]       = useState('')
  const [showRegister, setShowRegister]         = useState(false)
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
  const [showCalc, setShowCalc]                   = useState(false)
  const [showOpeningCash, setShowOpeningCash]     = useState(false)
  const [openingCashAmount, setOpeningCashAmount] = useState('')
  const [openingCashDate, setOpeningCashDate]     = useState(() => businessToday())
  const [modalDayStatus, setModalDayStatus]       = useState<{
    suggestedOpeningCash: number
    openingCash: number
    dayStarted: boolean
    isClosed: boolean
  } | null>(null)
  const [openingCashLoading, setOpeningCashLoading] = useState(false)
  const [dayStartStatus, setDayStartStatus] = useState<{
    suggestedOpeningCash: number
    openingCash: number
    dayStarted: boolean
    isClosed: boolean
  } | null>(null)
  const [dayStarted, setDayStarted] = useState(false)
  const [showDayEnd, setShowDayEnd]               = useState(false)
  const [dayEndLoading, setDayEndLoading]         = useState(false)
  const [dayEndSaving, setDayEndSaving]           = useState(false)
  const [dayEndData, setDayEndData]               = useState<Record<string, any> | null>(null)
  const [dayEndCashCount, setDayEndCashCount]     = useState(emptyDayEndCash)
  const [dayEndNotes, setDayEndNotes]             = useState('')
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
  const [waSendPdf, setWaSendPdf]                 = useState(false)
  const [cartView, setCartView]                       = useState<'items' | 'checkout'>('items')
  const [manualTotalMode, setManualTotalMode]     = useState(false)
  const [manualTotal, setManualTotal]             = useState('')
  const [customerOutstanding, setCustomerOutstanding] = useState(0)
  const [includeOutstanding, setIncludeOutstanding] = useState(false)
  const [outstandingPayAmount, setOutstandingPayAmount] = useState('')
  const [amountPaying, setAmountPaying] = useState('')
  const hasCustomerCredit = useFeatureFlag('CUSTOMER_CREDIT')
  const hasCreditPricing = useFeatureFlag('CREDIT_PRICING')
  const hasPosPriceEdit = useFeatureFlag('POS_PRICE_EDIT')
  const hasRepairs = useFeatureFlag('REPAIRS')
  const hasIMEI = useFeatureFlag('IMEI')
  const hasFinance = useFeatureFlag('FINANCE')
  const hasWhatsApp = useFeatureFlag('WHATSAPP')
  const hasDailyReload = useFeatureFlag('DAILY_RELOAD')
  useEffect(() => {
    if (!hasWhatsApp) return
    whatsappApi.getConfig()
      .then((r: any) => setWaSendPdf(!!(r?.data ?? r)?.sendPdfInvoice))
      .catch(() => {})
  }, [hasWhatsApp])
  const hasServices = useFeatureFlag('SERVICES')
  const hasDailyClosing = useFeatureFlag('DAILY_CLOSING')
  const hasWarranty = useFeatureFlag('WARRANTY')
  const hasWholesalePricing = useFeatureFlag('WHOLESALE_PRICING')
  const effectivePriceMode: PriceMode =
    priceMode === 'wholesale' && hasWholesalePricing ? 'wholesale'
    : priceMode === 'credit' && hasCreditPricing ? 'credit'
    : 'retail'

  useEffect(() => {
    if (selectedCategory === 'RELOAD' && !hasDailyReload) setSelectedCategory('ALL')
    if (selectedCategory === 'SERVICES' && !hasServices) setSelectedCategory('ALL')
  }, [selectedCategory, hasDailyReload, hasServices])
  const [mobileView, setMobileView]               = useState<'products' | 'cart'>('products')
  const [isDesktop, setIsDesktop]                 = useState(false)
  const [hideOutOfStock, setHideOutOfStock]       = useState(false)
  const [now, setNow]                             = useState(() => new Date())
  const [gridView, setGridView]                   = useState(true)
  const [variationPickerProduct, setVariationPickerProduct] = useState<any | null>(null)
  const [pricePrompt, setPricePrompt] = useState<{
    product: any
    imei?: string
    variation?: ProductVariation
    catalogPrice: number
  } | null>(null)
  const [pricePromptVal, setPricePromptVal] = useState('')
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (isDesktop) setMobileView('products')
  }, [isDesktop])

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
  const customerPaidRef                           = useRef<HTMLInputElement>(null)
  const outstandingPayRef                         = useRef<HTMLInputElement>(null)
  const prevSaleTotalRef                          = useRef(0)
  const handleCheckoutRef                         = useRef<() => Promise<void>>(async () => {})
  const checkoutKeyboardRef                       = useRef({
    outstandingPaying: 0,
    canOpenCheckout: false,
    customerOutstanding: 0,
    includeOutstanding: false,
    collectAtCheckout: 0,
    hasSelectedCustomer: false,
  })

  useEffect(() => {
    if (!posUi.behavior.focusSearchOnOpen) return
    const t = window.setTimeout(() => {
      searchRef.current?.focus()
      searchRef.current?.select()
    }, 80)
    return () => window.clearTimeout(t)
  }, [posUi.behavior.focusSearchOnOpen])

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

  const [posBranchId, setPosBranchId] = useState('')
  useEffect(() => {
    const id = ensureOperationalBranch() ?? ''
    setPosBranchId(id)
  }, [])

  const getBranchId = () => posBranchId || getOperationalBranchId() || ''
  const productQueryParams = useMemo(
    (): Record<string, string> | undefined => (posBranchId ? { branchId: posBranchId } : undefined),
    [posBranchId],
  )
  const posUser = authStorage.getUser()
  const posRole = posUser?.role ?? 'CASHIER'
  const canCloseDay = posRole === 'OWNER' || posRole === 'MANAGER'
  const canSeeProductCost = useCanSeeProductCost()
  const businessDateStr = businessToday()
  const dayIsClosed = dayStartStatus?.isClosed || dayEndData?.isClosed

  const dayEndCashTotal = useMemo(() => {
    let t = Number(dayEndCashCount.coins || 0)
    for (const den of DAY_END_DENOMS) t += Number((dayEndCashCount as Record<string, number>)[den.key] || 0) * den.value
    return Math.round(t * 100) / 100
  }, [dayEndCashCount])

  const dayEndExpectedCash = useMemo(() => {
    if (!dayEndData?.cash) return 0
    const open = dayEndData.openingCash ?? 0
    const refunds = dayEndData.cash.cashRefunds ?? 0
    const cashExpenses = dayEndData.expenses?.cashOperatingExpenses ?? dayEndData.expenses.totalExpenses ?? 0
    const cashSupplierPayments = dayEndData.expenses?.cashSupplierPayments ?? 0
    const cashReloadProviderPayments = dayEndData.expenses?.cashReloadProviderPayments ?? 0
    const cashBankDeposits = dayEndData.cash.cashBankDeposits ?? dayEndData.cash.bankDeposits ?? 0
    return Math.round((open + dayEndData.cash.cashSales - cashExpenses - cashSupplierPayments - cashReloadProviderPayments - cashBankDeposits - refunds) * 100) / 100
  }, [dayEndData])

  const dayEndVariance = Math.round((dayEndExpectedCash - dayEndCashTotal) * 100) / 100

  const loadOpeningCashForDate = useCallback(async (date: string) => {
    const branchId = getBranchId()
    if (!hasDailyClosing || !branchId) return null
    try {
      const res = await dailyClosingApi.dayStartStatus({ branchId, date }) as {
        data?: {
          suggestedOpeningCash: number
          openingCash: number
          dayStarted: boolean
          isClosed: boolean
        }
      }
      const d = res.data ?? (res as unknown as typeof res.data)
      if (!d) return null
      setModalDayStatus(d)
      setOpeningCashAmount(String(Math.round(d.openingCash ?? d.suggestedOpeningCash ?? 0)))
      return d
    } catch {
      return null
    }
  }, [hasDailyClosing])

  const loadDayStartStatus = useCallback(async (promptIfNeeded = false) => {
    const branchId = getBranchId()
    if (!hasDailyClosing || !branchId) return null
    try {
      const res = await dailyClosingApi.dayStartStatus({ branchId, date: businessDateStr }) as {
        data?: {
          suggestedOpeningCash: number
          openingCash: number
          dayStarted: boolean
          isClosed: boolean
        }
      }
      const d = res.data ?? (res as unknown as typeof res.data)
      if (!d) return null
      setDayStartStatus(d)
      setDayStarted(d.dayStarted)
      if (!d.dayStarted) {
        setOpeningCashAmount(String(Math.round(d.openingCash ?? d.suggestedOpeningCash ?? 0)))
        if (promptIfNeeded && !d.isClosed) setShowOpeningCash(true)
      }
      return d
    } catch {
      return null
    }
  }, [hasDailyClosing, businessDateStr])

  useEffect(() => {
    if (hasDailyClosing) loadDayStartStatus(true)
  }, [hasDailyClosing, loadDayStartStatus])

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
    if (Number.isNaN(amount) || amount < 0) { toast.error('Enter a valid opening cash amount'); return }
    setOpeningCashLoading(true)
    try {
      if (hasDailyClosing) {
        const branchId = getBranchId()
        if (!branchId) { toast.error('No branch on your account'); return }
        const targetDate = openingCashDate
        const isToday = targetDate === businessDateStr
        if (isToday) {
          await dailyClosingApi.startDay({
            branchId,
            date: targetDate,
            openingCash: amount,
          })
          setDayStarted(true)
          await loadDayStartStatus()
          openDrawer()
          toast.success(`Shift started — opening cash ${formatCurrency(amount)}`, { icon: '💵' })
        } else {
          await dailyClosingApi.saveOpeningCash({
            branchId,
            date: targetDate,
            openingCash: amount,
          })
          toast.success(`Opening cash saved for ${new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US')}`, { icon: '💵' })
        }
        setShowOpeningCash(false)
        return
      }
      if (!amount || amount <= 0) { toast.error('Enter a valid opening cash amount'); return }
      const ok = await recordCashTransaction({
        type: 'INCOME',
        category: 'Opening Cash',
        amount,
        description: `POS opening cash — ${new Date().toLocaleDateString('en-GB')}`,
      })
      if (!ok) return
      const key = `pos_opening_cash_${businessDateStr}`
      localStorage.setItem(key, String(amount))
      openDrawer()
      toast.success(`Opening cash recorded: ${formatCurrency(amount)}`, { icon: '💵' })
      setShowOpeningCash(false)
      setOpeningCashAmount('')
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to record opening cash')
    } finally { setOpeningCashLoading(false) }
  }

  const openDayStartModal = () => {
    setOpeningCashDate(businessDateStr)
    setShowOpeningCash(true)
    loadOpeningCashForDate(businessDateStr)
  }

  const onOpeningCashDateChange = (nextDate: string) => {
    setOpeningCashDate(nextDate)
    loadOpeningCashForDate(nextDate)
  }

  const loadDayEndPreview = useCallback(async () => {
    const branchId = getBranchId()
    if (!branchId) {
      toast.error('No branch on your account')
      return
    }
    setDayEndLoading(true)
    try {
      const res = await dailyClosingApi.preview({ branchId, date: businessDateStr }) as { data?: Record<string, unknown> }
      const d = (res.data ?? res) as Record<string, any>
      setDayEndData(d)
      if (d?.cashCount) {
        setDayEndCashCount({
          d5000: d.cashCount.d5000 ?? 0,
          d2000: d.cashCount.d2000 ?? 0,
          d1000: d.cashCount.d1000 ?? 0,
          d500: d.cashCount.d500 ?? 0,
          d100: d.cashCount.d100 ?? 0,
          d50: d.cashCount.d50 ?? 0,
          d20: d.cashCount.d20 ?? 0,
          d10: d.cashCount.d10 ?? 0,
          d5: d.cashCount.d5 ?? 0,
          d2: d.cashCount.d2 ?? 0,
          d1: d.cashCount.d1 ?? 0,
          coins: d.cashCount.coins ?? 0,
        })
      } else {
        setDayEndCashCount(emptyDayEndCash())
      }
      setDayEndNotes(d?.notes ?? '')
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load day summary')
    } finally {
      setDayEndLoading(false)
    }
  }, [businessDateStr])

  const openDayEnd = () => {
    if (!hasDailyClosing) return
    if (!dayStarted && !dayStartStatus?.dayStarted) {
      toast.error('Start your shift first (Day Start)')
      return
    }
    setShowDayEnd(true)
    loadDayEndPreview()
  }

  const saveDayEndCashCount = async () => {
    const branchId = getBranchId()
    if (!branchId || dayEndData?.isClosed) return
    setDayEndSaving(true)
    try {
      await dailyClosingApi.saveCashCount({
        branchId,
        date: businessDateStr,
        cashCount: dayEndCashCount,
        openingCash: dayEndData?.openingCash,
        notes: dayEndNotes,
      })
      toast.success('Cash count saved')
      await loadDayEndPreview()
    } catch (e: any) {
      toast.error(e?.message ?? 'Save failed')
    } finally {
      setDayEndSaving(false)
    }
  }

  const closeBusinessDayFromPos = async () => {
    if (!canCloseDay || dayEndData?.isClosed) return
    if (!confirm('Close business day? New sales will be blocked until reopened.')) return
    const branchId = getBranchId()
    if (!branchId) return
    setDayEndSaving(true)
    try {
      const res: any = await dailyClosingApi.close({
        branchId,
        date: businessDateStr,
        openingCash: dayEndData?.openingCash,
        cashCount: dayEndCashCount,
        notes: dayEndNotes,
      })
      const payload = res.data ?? res
      toast.success('Business day closed')
      if (payload?.allocationWarning) {
        toast.error(`Profit allocation not saved: ${payload.allocationWarning}`)
      }
      await loadDayEndPreview()
      await loadDayStartStatus()
    } catch (e: any) {
      toast.error(e?.message ?? 'Close failed')
    } finally {
      setDayEndSaving(false)
    }
  }

  const openFullDailyClosing = () => {
    setShowDayEnd(false)
    onClose()
    router.push(`/dashboard/daily-closing?date=${businessDateStr}&step=3`)
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
      const reprintData = {
        invoiceNumber: saleData.invoiceNumber,
        createdAt: saleData.createdAt,
        customerName: saleData.customerName ?? 'Walk-in Customer',
        customerPhone: saleData.customerPhone ?? '',
        customerAddress: saleData.customerAddress ?? saleData.customerCity ?? '',
        items: (saleData.items ?? []).map((i: any) => ({
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
          sku: i.sku,
          imei: i.imei,
          warrantyMonths: i.warrantyMonths ?? 0,
        })),
        subtotal: saleData.subtotal ?? saleData.total,
        discountAmount: saleData.discount ?? 0,
        total: saleData.total,
        payments: saleData.payments,
        paymentMethod: saleData.payments?.[0]?.method,
        cashReceived: undefined,
        changeAmount: undefined,
        dueAmount: saleData.dueAmount,
        warrantyNumbers: (saleData.warranties ?? []).map((w: any) => w.warrantyCode).filter(Boolean),
        warranties: (saleData.warranties ?? []).map((w: any) => ({
          warrantyCode: w.warrantyCode,
          productName: w.productName,
          imei: w.imei,
          endDate: w.endDate,
          monthsDuration: w.monthsDuration,
        })),
      }
      printPosReceipt(reprintData, invoiceSettings, thermalShopCtx)
      toast.success('Receipt sent to printer')
    } catch {
      toast.error('Could not print invoice')
    }
  }

  const restoreHeldCart = (entry: typeof heldCarts[0]) => {
    if (cart.length > 0 && !window.confirm('Replace the current cart with this held sale? Current items will be lost unless you Hold them first.')) {
      return
    }
    setCart(entry.items)
    setDiscountPct(entry.discountPct)
    setDiscountFlat(entry.discountFlat)
    setDiscountMode(entry.discountMode)
    saveHeldCarts(heldCarts.filter(h => h.id !== entry.id))
    setShowHeldCarts(false)
    selectCustomer(entry.customer)
    setMobileView('cart')
    setCartView('items')
    toast.success(`${entry.label} restored`)
  }

  const requestClosePos = useCallback(() => {
    if ((cart.length > 0 || cartView === 'checkout') && posUi.behavior.confirmLeaveWithCart) {
      if (!window.confirm('Close POS? Unsaved cart items will be lost unless held.')) return
    }
    onClose()
  }, [cart.length, cartView, onClose, posUi.behavior.confirmLeaveWithCart])

  const clearCartWithConfirm = useCallback(() => {
    if (cart.length === 0) return
    if (!window.confirm(`Clear cart (${cart.length} line${cart.length === 1 ? '' : 's'})?`)) return
    setCart([])
    setCartView('items')
  }, [cart.length])

  const openCustomerPicker = useCallback(() => {
    setCustSearch('')
    setShowRegister(false)
    if (cartView === 'checkout') {
      setShowCartCustDrop(true)
      setShowCustDrop(false)
    } else {
      setShowCustDrop(true)
      setShowCartCustDrop(false)
    }
  }, [cartView])

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

  const { data: productsData, refetch: refetchProducts } = useProducts(productQueryParams)
  const [customers, setCustomers]     = useState<any[]>([])
  const [custLoading, setCustLoading] = useState(false)
  const [cachedProducts, setCachedProducts] = useState<any[]>([])

  const liveProducts: any[] = (productsData as any)?.data ?? []
  const branchLiveProducts = useMemo(
    () => (posBranchId
      ? liveProducts.filter((p: any) => p.branchId === posBranchId)
      : liveProducts),
    [liveProducts, posBranchId],
  )
  const products: any[] = branchLiveProducts.length > 0 ? branchLiveProducts : cachedProducts

  /** Remember last price mode for the next add (does not reprice items already in cart). */
  const selectPriceMode = useCallback((mode: PriceMode) => {
    setPriceMode(mode)
  }, [])

  useEffect(() => {
    if (priceMode === 'wholesale' && !hasWholesalePricing) selectPriceMode('retail')
    else if (priceMode === 'credit' && !hasCreditPricing) selectPriceMode('retail')
  }, [priceMode, hasWholesalePricing, hasCreditPricing, selectPriceMode])

  // When price mode changes while the add-to-cart price popup is open, refresh catalog + input
  useEffect(() => {
    setPricePrompt(prev => {
      if (!prev) return prev
      const { product, variation } = prev
      const isService = !variation && product.sellingPrice === undefined && product.price !== undefined
      const catalogPrice = isService
        ? Number(product.price) || 0
        : variation
          ? resolveCatalogPrice(variation, effectivePriceMode)
          : resolveCatalogPrice(product, effectivePriceMode)
      if (prev.catalogPrice === catalogPrice) return prev
      return { ...prev, catalogPrice }
    })
  }, [effectivePriceMode])

  useEffect(() => {
    if (!pricePrompt) return
    setPricePromptVal(pricePrompt.catalogPrice > 0 ? String(pricePrompt.catalogPrice) : '')
  }, [pricePrompt?.catalogPrice])

  const refetchCustomers = useCallback(async () => {
    setCustLoading(true)
    try {
      const res: any = await customersApi.list({ limit: '5000' })
      const raw = res?.data ?? res
      setCustomers(Array.isArray(raw) ? raw : [])
    } catch (e) { console.error('Customer load error:', e); setCustomers([]) }
    finally { setCustLoading(false) }
  }, [posBranchId])

  useEffect(() => { refetchCustomers() }, [refetchCustomers])

  useEffect(() => {
    refetchProducts()
    if (posBranchId) {
      getCachedProducts(posBranchId).then((rows) => {
        if (Array.isArray(rows)) setCachedProducts(rows as any[])
      }).catch(() => {})
    } else {
      setCachedProducts([])
    }
    getCachedCategories().then((cats) => {
      if (cats.length > 0) setCategories(cats)
    }).catch(() => {})
  }, [refetchProducts, posBranchId])

  useEffect(() => {
    if (branchLiveProducts.length > 0 && isBrowserOnline() && posBranchId) {
      cacheProductsForOffline(posBranchId, branchLiveProducts).catch(() => {})
      setCachedProducts(branchLiveProducts)
    }
  }, [branchLiveProducts, posBranchId])

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
      if (cats.length > 0) cacheCategoriesForOffline(cats).catch(() => {})
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
    const q = search.toLowerCase()
    const matchSearch = !q ||
      String(p.name ?? '').toLowerCase().includes(q) ||
      String(p.sku ?? '').toLowerCase().includes(q) ||
      String(p.barcode ?? '').toLowerCase().includes(q) ||
      (p.storageVariations ?? []).some((v: any) => String(v.sku ?? '').toLowerCase().includes(q))
    const matchStock = !hideOutOfStock || (p.stock ?? 0) > 0
    const matchFav = !showFavoritesOnly || favorites.has(p.id)
    return matchCat && matchSearch && matchStock && matchFav
  })

  const filteredServices = services.filter((s: any) => {
    const matchCat = selectedCategory === 'SERVICES' || selectedCategory === 'ALL'
    const matchSearch = String(s.name ?? '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const addReloadToCart = useCallback((provider: ReloadProvider, amount: number, serviceType: 'RELOAD' | 'RECHARGE_CARD' = 'RELOAD') => {
    const label = serviceType === 'RECHARGE_CARD' ? 'Recharge Card' : 'Reload'
    setCart(prev => [...prev, {
      cartId: `reload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: null,
      name: `${provider} ${label}`,
      sku: serviceType === 'RECHARGE_CARD' ? `RCARD-${provider.toUpperCase()}` : `RELOAD-${provider.toUpperCase()}`,
      price: amount,
      originalPrice: amount,
      quantity: 1,
      isReload: true,
      reloadProvider: provider,
      reloadType: serviceType,
      warrantyMonths: 0,
      trackImei: false,
    }])
    toast.success(`${provider} ${label.toLowerCase()} ${formatCurrency(amount)} added to cart`, { icon: '📱' })
  }, [])

  const displayItems = selectedCategory === 'SERVICES' ? filteredServices
    : selectedCategory === 'RELOAD' ? []
    : filtered
  const warrantyCartItems = useMemo(
    () => getWarrantyCartItems(cart, hasWarranty),
    [cart, hasWarranty],
  )
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

  const addToCart = (
    product: any,
    imei?: string,
    variation?: ProductVariation,
    priceOverride?: number,
    warranty?: { months?: number; note?: string },
  ) => {
    const catalogPrice = variation
      ? resolveCatalogPrice(variation, effectivePriceMode)
      : resolveCatalogPrice(product, effectivePriceMode)
    const isService = !variation && product.sellingPrice === undefined && product.price !== undefined
    const price = priceOverride !== undefined
      ? Math.max(0, Number(priceOverride) || 0)
      : (isService ? Number(product.price) || 0 : catalogPrice)
    const sku   = variation?.sku ?? product.sku ?? product.category ?? ''
    const name  = variation
      ? (variation.storage === 'Standard' && variation.colorName === 'Default'
        ? product.name
        : `${product.name} · ${variation.storage} / ${variation.colorName}`)
      : product.name
    const cost = isService ? Number(product.cost ?? 0) : Number(variation?.costPrice ?? product.buyingPrice ?? 0)
    const serviceId = isService ? product.id : undefined
    const warrantyMonths = isService
      ? 0
      : Math.max(0, Number(warranty?.months ?? product.warrantyMonths ?? 0) || 0)
    const warrantyNote = isService
      ? undefined
      : (warranty?.note?.trim() || product.warrantyNote?.trim() || undefined)
    const isSyntheticVariant = Boolean(variation && variation.storage === 'Standard' && variation.colorName === 'Default')
    setCart(prev => {
      const trackImei = Boolean(product.trackImei)
      // Default: merge into existing line. When alwaysNewLineItem is on, every add is a new row.
      if (!imei && !posUi.behavior.alwaysNewLineItem) {
        // Match by productId + variation + price + warranty so different warranties stay separate
        const varKey = isSyntheticVariant ? '' : (variation ? `${variation.storage}::${variation.colorName}` : '')
        const existing = prev.find(i => i.isService
          ? i.serviceId === serviceId && i.name === name && i.price === price
          : i.productId === product.id
            && !i.imei
            && (i.variationLabel ?? '') === varKey
            && i.price === price
            && (i.warrantyMonths ?? 0) === warrantyMonths
            && (i.warrantyNote ?? '') === (warrantyNote ?? ''))
        if (existing) return prev.map(i => i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        cartId: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: isService ? null : product.id,
        serviceId,
        name,
        sku,
        price,
        originalPrice: catalogPrice || price,
        cost,
        quantity: 1,
        imei,
        isService,
        variationLabel: isSyntheticVariant ? undefined : (variation ? `${variation.storage}::${variation.colorName}` : undefined),
        warrantyMonths,
        warrantyNote,
        trackImei,
        condition: isService ? undefined : (product.condition === 'USED' ? 'USED' : product.condition === 'BRAND_NEW' ? 'BRAND_NEW' : undefined),
      }]
    })
  }

  const promptAddToCart = (product: any, imei?: string, variation?: ProductVariation) => {
    const isService = !variation && product.sellingPrice === undefined && product.price !== undefined
    const catalogPrice = isService
      ? Number(product.price) || 0
      : variation
        ? resolveCatalogPrice(variation, effectivePriceMode)
        : resolveCatalogPrice(product, effectivePriceMode)
    if (!hasPosPriceEdit) {
      addToCart(product, imei, variation)
      const label = variation
        ? `${product.name} · ${variation.storage} / ${variation.colorName}`
        : (product.displayName ?? product.name)
      toast.success(`Added: ${label}`)
      return
    }
    setPricePrompt({ product, imei, variation, catalogPrice })
    setPricePromptVal(catalogPrice > 0 ? String(catalogPrice) : '')
  }

  const confirmPricePrompt = () => {
    if (!pricePrompt) return
    const val = parseFloat(pricePromptVal)
    if (!Number.isFinite(val) || val < 0) {
      toast.error('Enter a valid price')
      return
    }
    const { product, imei, variation } = pricePrompt
    addToCart(product, imei, variation, val)
    const label = variation
      ? `${product.name} · ${variation.storage} / ${variation.colorName}`
      : (product.displayName ?? product.name)
    toast.success(`Added: ${label}`)
    setPricePrompt(null)
    setPricePromptVal('')
  }

  const resolveVariationFromImei = (product: any, variation?: string | null): ProductVariation | undefined => {
    const vars: ProductVariation[] = Array.isArray(product.storageVariations) ? product.storageVariations : []
    if (!vars.length) return undefined
    if (variation) {
      const match = vars.find(v => imeiMatchesProductVariant({ variation }, v))
      if (match) return match
    }
    return vars.length === 1 ? vars[0] : undefined
  }

  /** Same entry path as product card click — opens picker when variants / IMEI need input. */
  const openProductForSale = (product: any, preferredVariation?: ProductVariation | null) => {
    if (!product) return
    const vars: ProductVariation[] = Array.isArray(product.storageVariations) ? product.storageVariations : []
    if (vars.length > 0) {
      setVariationPickerProduct({
        ...product,
        _scanPreferStorage: preferredVariation?.storage,
        _scanPreferColor: preferredVariation?.colorName,
      })
      return
    }
    if (product.trackImei && hasIMEI) {
      setVariationPickerProduct({
        ...product,
        storageVariations: [{
          storage: 'Standard',
          colorName: 'Default',
          sellingPrice: product.sellingPrice,
          wholesalePrice: product.wholesalePrice,
          creditPrice: product.creditPrice,
          costPrice: product.buyingPrice,
          stock: product.availableStock ?? product.stock ?? 0,
          sku: product.sku,
        }],
      })
      return
    }
    promptAddToCart(product, undefined, preferredVariation ?? undefined)
  }

  const handleImeiScan = async (scanned: string) => {
    const imei = scanned.trim()
    if (!imei) return
    setImeiScanning(true)
    try {
      const res: any = await imeiApi.lookup(imei)
      const rec = res?.data?.record
      if (rec && posBranchId && rec.branchId && rec.branchId !== posBranchId) {
        toast.error('This IMEI belongs to another branch')
        return
      }
      const productId = rec?.productId
      const product = products.find((p: any) => p.id === productId)
      if (product) {
        // Prefer attaching IMEI into an existing cart line for the same product (qty>1 -> split)
        const target = cart.find(i => i.productId === product.id && !i.imei)
        if (target) {
          setCart(prev => prev.flatMap(i => {
            if (i.cartId !== target.cartId) return [i]
            if (i.quantity > 1) {
              const newCartId = `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
              return [
                { ...i, quantity: i.quantity - 1 },
                { ...i, cartId: newCartId, imei, quantity: 1 },
              ]
            }
            return [{ ...i, imei }]
          }))
          toast.success(`IMEI linked to ${product.name}`)
        } else {
          promptAddToCart(product, imei, resolveVariationFromImei(product, rec?.variation))
        }
      } else {
        const targetIdx = cart.findIndex(i => !i.imei)
        if (targetIdx !== -1) {
          const targetCartId = cart[targetIdx].cartId
          const targetItem   = cart[targetIdx]
          setCart(prev => prev.flatMap(i => {
            if (i.cartId !== targetCartId) return [i]
            if (i.quantity > 1) {
              const newCartId = `${targetCartId}-imei-${Date.now()}`
              return [
                { ...i, quantity: i.quantity - 1 },
                { ...i, cartId: newCartId, imei, quantity: 1 },
              ]
            }
            return [{ ...i, imei }]
          }))
          toast(`IMEI attached to ${targetItem.name}`)
        } else {
          toast.error('IMEI not found. Add a product to cart first, then scan.')
        }
      }
    } catch {
      const targetIdx = cart.findIndex(i => !i.imei)
      if (targetIdx !== -1) {
        const targetCartId = cart[targetIdx].cartId
        const targetItem   = cart[targetIdx]
        setCart(prev => prev.flatMap(i => {
          if (i.cartId !== targetCartId) return [i]
          if (i.quantity > 1) {
            const newCartId = `${targetCartId}-imei-${Date.now()}`
            return [
              { ...i, quantity: i.quantity - 1 },
              { ...i, cartId: newCartId, imei, quantity: 1 },
            ]
          }
          return [{ ...i, imei }]
        }))
        toast(`IMEI attached to ${targetItem.name}`)
      } else {
        toast.error('IMEI not registered. Add a product to cart first.')
      }
    } finally {
      setImeiScanning(false)
      setImeiScan('')
    }
  }

  const handleSearchScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const code = normalizeScanCode(search)
    if (!code) return
    e.preventDefault()

    if (isImeiCode(code)) {
      setSearch('')
      await handleImeiScan(code)
      return
    }

    const local = findProductByCode(products, code)
    if (local) {
      const { product, variation } = local
      setSearch('')
      openProductForSale(product, variation as ProductVariation | undefined)
      return
    }

    try {
      const res: any = await productsApi.lookupCode(code)
      const data = res?.data ?? res
      if (data?.matchType === 'imei') {
        setSearch('')
        await handleImeiScan(code)
        return
      }
      const hit = data?.product
      if (hit) {
        setSearch('')
        openProductForSale(hit, hit.matchedVariation)
        return
      }
      toast.error('No product found for this barcode')
    } catch {
      toast.error('Barcode lookup failed')
    }
  }

  const updateQty = (cartId: string, delta: number) =>
    setCart(prev => prev.map(i => {
      if (i.cartId !== cartId || isQtyLockedLine(i)) return i
      return { ...i, quantity: i.quantity + delta }
    }).filter(i => i.quantity > 0))

  const setQty = (cartId: string, qty: number) =>
    setCart(prev => prev.map(i => {
      if (i.cartId !== cartId || isQtyLockedLine(i)) return i
      return { ...i, quantity: Math.max(1, qty) }
    }))

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
  const shopName = currentUser?.name?.split(' ')[0]
    ? `${currentUser.name.split(' ')[0]} Shop`
    : 'Our Shop'
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() => getInvoiceSettings())
  const [thermalShopCtx, setThermalShopCtx] = useState<ShopContext | undefined>(undefined)
  const [tenantSlug, setTenantSlug] = useState<string | undefined>(undefined)
  const activeInvoiceTemplate = resolveInvoiceTemplate(invoiceSettings, tenantSlug)

  useEffect(() => {
    if (!currentUser?.tenantId) return
    const branchId = currentUser.activeBranchId ?? currentUser.branchIds?.[0]
    const load = () => {
      Promise.all([
        fetchInvoiceSettings(currentUser.tenantId, branchId),
        tenantApi.get(currentUser.tenantId).catch(() => null),
      ]).then(([settings, tenantRes]) => {
        setInvoiceSettings(settings)
        const tenant = (tenantRes as any)?.data ?? tenantRes
        setTenantSlug(tenant?.slug)
        setThermalShopCtx(shopContextFromTenant(tenant, branchId))
      }).catch(() => {})
    }
    load()
    window.addEventListener('invoice-settings-updated', load)
    return () => window.removeEventListener('invoice-settings-updated', load)
  }, [currentUser?.tenantId, currentUser?.activeBranchId, currentUser?.branchIds?.[0]])

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
    if (cart.length > 0 && warrantyCartItems.length > 0 && !selectedCustomer) {
      setCheckoutError('Please select a customer — warranty products require customer details')
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
    if (paymentMethod === 'CHEQUE' && !chequeNumber.trim()) {
      setCheckoutError('Enter cheque number')
      return
    }
    const chequeRef = paymentMethod === 'CHEQUE'
      ? formatChequeReference(chequeNumber, chequeDate)
      : ''
    const offlineNow = !isBrowserOnline()
    if (offlineNow) {
      if (settleOldOutstanding && outstandingPaying > 0) {
        setCheckoutError('Cannot settle outstanding balance while offline')
        return
      }
      if (warrantyCartItems.length > 0) {
        setCheckoutError('Warranty sales require an internet connection')
        return
      }
      if (cart.some(i => i.isReload)) {
        setCheckoutError('Reload sales require an internet connection')
        return
      }
    }
    setCheckoutLoading(true)
    setCheckoutError('')
    const settledOutstanding = outstandingPaying
    // Snapshot old open-sale dues BEFORE this checkout creates a new credit invoice.
    // Settlement must never apply to the sale we are about to create.
    const priorOutstanding = customerOutstanding
    // Open print window synchronously with the click — browsers block window.open after await
    const shouldAutoPrint = invoiceSettings.posAutoPrintBill !== false && cart.length > 0
    const receiptWin = shouldAutoPrint ? openReceiptPrintWindow('Preparing thermal receipt…') : null
    if (shouldAutoPrint && !receiptWin) {
      toast.error('Allow popups for this site to auto-print the receipt')
    }
    try {
      const user = authStorage.getUser()

      // Outstanding-only collection (no cart)
      if (cart.length === 0) {
        if (!offlineNow && settleOldOutstanding && selectedCustomer && settledOutstanding > 0) {
          await customersApi.creditPayment(selectedCustomer.id, {
            amount: settledOutstanding,
            paymentMethod,
            reference: chequeRef || undefined,
            branchId: getBranchId() || '',
            performedBy: user?.name || 'system',
          })
        }
        try { receiptWin?.close() } catch { /* ignore */ }
        if (selectedCustomer?.id) await refreshCustomerBalance(selectedCustomer.id)
        setIncludeOutstanding(false)
        setOutstandingPayAmount('')
        setCartView('items')
        toast.success(`Outstanding ${formatCurrency(settledOutstanding)} collected`, { icon: '✓' })
        return
      }

      const payments: { method: string; amount: number; reference?: string }[] = []
      if (payNowForSale > 0) {
        payments.push({
          method: paymentMethod,
          amount: payNowForSale,
          ...(chequeRef ? { reference: chequeRef } : {}),
        })
      }
      if (saleDueAmount > 0) payments.push({ method: 'CREDIT', amount: saleDueAmount })

      const salePayload = {
        branchId:      getBranchId(),
        customerId:    selectedCustomer?.id || undefined,
        customerName:  selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone || '',
        priceMode:     effectivePriceMode,
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
          variationLabel: i.variationLabel,
          quantity:    i.quantity,
          unitPrice:   i.price,
          total:       i.price * i.quantity,
          imei:        i.imei,
          warrantyMonths: i.warrantyMonths ?? 0,
          warrantyNote: i.warrantyNote?.trim() || undefined,
          ...(i.isReload && i.reloadProvider ? {
            reloadProvider: i.reloadProvider,
            reloadType: i.reloadType ?? 'RELOAD',
          } : {}),
        })),
        payments,
      }

      const finishOfflineSale = async (invoiceNumber: string, localId: string) => {
        toast.success('Sale saved offline — will sync when connected', { icon: '📴' })
        setMobileView('cart')
        const receiptData: PosReceiptSale = {
          invoiceNumber,
          createdAt: new Date().toISOString(),
          customerName: selectedCustomer?.name || 'Walk-in Customer',
          customerPhone: selectedCustomer?.phone || '',
          customerAddress: receiptCustomerCity(selectedCustomer),
          cashierName: user?.name || 'Staff',
          items: cartToReceiptItems(cart),
          subtotal,
          discountAmount,
          total: saleTotal,
          payments,
          paymentMethod,
          cashReceived: cashReceivedAmount,
          changeAmount,
          dueAmount: saleDueAmount,
        }
        setCompletedSale({
          id: localId,
          offline: true,
          ...receiptData,
          paidAmount: payNowForSale,
        })
        autoPrintPosReceipt(receiptData, invoiceSettings, thermalShopCtx, receiptWin)
        setCart([])
        setDiscountPct(0)
        setDiscountFlat(0)
        setCustomerPaid('')
        setCheckoutError('')
        setCartView('items')
      }

      if (offlineNow) {
        const invoiceNumber = buildOfflineInvoiceNumber()
        const { id } = await queueOfflineSale(salePayload, invoiceNumber)
        await finishOfflineSale(invoiceNumber, id)
        return
      }

      let res: any
      try {
        res = await salesApi.create(salePayload)
      } catch (createErr) {
        if (isNetworkError(createErr)) {
          const invoiceNumber = buildOfflineInvoiceNumber()
          const { id } = await queueOfflineSale(salePayload, invoiceNumber)
          await finishOfflineSale(invoiceNumber, id)
          return
        }
        throw createErr
      }

      // Settle OLD dues only AFTER the new sale succeeds, and never apply that
      // payment to the new invoice's intentional credit balance.
      const newSaleId = res.data?.id as string | undefined
      let actuallySettled = 0
      if (settleOldOutstanding && selectedCustomer && settledOutstanding > 0) {
        const settleAmt = Math.min(settledOutstanding, Math.max(0, priorOutstanding))
        if (settleAmt > 0.001) {
          try {
            const settleRes: any = await customersApi.creditPayment(selectedCustomer.id, {
              amount: settleAmt,
              paymentMethod,
              reference: chequeRef || undefined,
              branchId: getBranchId() || '',
              performedBy: user?.name || 'system',
              excludeSaleIds: newSaleId ? [newSaleId] : [],
            })
            actuallySettled = Number(settleRes?.data?.amountPaid ?? settleAmt)
          } catch (settleErr: any) {
            toast.error(
              settleErr?.message
                ? `Sale saved, but old balance was not settled: ${settleErr.message}`
                : 'Sale saved, but old balance settlement failed',
            )
          }
        }
      }

      const createdWarrantyCodes = extractSaleWarrantyCodes(res)
      const createdWarranties = extractSaleWarranties(res)
      if (createdWarrantyCodes.length > 0) {
        toast.success(`${createdWarrantyCodes.length} warranty${createdWarrantyCodes.length > 1 ? 's' : ''} created`, { icon: '🛡️' })
      }
      const reloadItems = cart.filter(i => i.isReload && i.reloadProvider)
      if (reloadItems.length > 0) {
        toast.success(`${reloadItems.length} reload record${reloadItems.length > 1 ? 's' : ''} saved with sale`, { icon: '📱' })
      }
      if (saleDueAmount > 0) {
        toast.success(`${formatCurrency(saleDueAmount)} added to customer credit`, { icon: '📋' })
      }
      if (actuallySettled > 0) {
        toast.success(`Old balance ${formatCurrency(actuallySettled)} settled`, { icon: '✓' })
      }
      if (selectedCustomer?.id) {
        await refreshCustomerBalance(selectedCustomer.id)
        setIncludeOutstanding(false)
      }
      refetchProducts()
      window.dispatchEvent(new CustomEvent('pos:sale-complete'))
      setMobileView('cart')
      const receiptData: PosReceiptSale = {
        invoiceNumber: res.data?.invoiceNumber ?? buildOfflineInvoiceNumber(),
        createdAt: res.data?.createdAt ?? new Date().toISOString(),
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone || '',
        customerAddress: receiptCustomerCity(selectedCustomer),
        cashierName: user?.name || 'Staff',
        items: cartToReceiptItems(cart),
        subtotal,
        discountAmount,
        total: res.data?.total ?? saleTotal,
        payments,
        paymentMethod,
        cashReceived: cashReceivedAmount,
        changeAmount,
        warrantyNumbers: createdWarrantyCodes,
        warranties: createdWarranties,
        warrantyMonths: createdWarrantyCodes.length > 0
          ? Math.max(...warrantyCartItems.map(i => i.warrantyMonths ?? 0), 0) || undefined
          : undefined,
        dueAmount: res.data?.dueAmount ?? saleDueAmount,
      }
      setCompletedSale({
        ...res.data,
        ...receiptData,
        paidAmount: payNowForSale,
      })
      autoPrintPosReceipt(receiptData, invoiceSettings, thermalShopCtx, receiptWin)
    } catch (e: any) {
      try { receiptWin?.close() } catch { /* ignore */ }
      setCheckoutError(e.message || 'Checkout failed')
      if (selectedCustomer?.id) {
        try { await refreshCustomerBalance(selectedCustomer.id) } catch { /* ignore */ }
      }
    } finally {
      setCheckoutLoading(false)
    }
  }

  handleCheckoutRef.current = handleCheckout
  checkoutKeyboardRef.current = {
    outstandingPaying,
    canOpenCheckout,
    customerOutstanding,
    includeOutstanding,
    collectAtCheckout,
    hasSelectedCustomer: !!selectedCustomer,
  }

  const submitCheckoutFromInput = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    e.stopPropagation()
    void handleCheckout()
  }

  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return false
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
      return el.isContentEditable
    }
    const openCheckout = () => {
      const ck = checkoutKeyboardRef.current
      if (ck.canOpenCheckout && !completedSale) {
        if (cart.length > 0 && warrantyCartItems.length > 0 && !selectedCustomer) {
          toast.error('Select a customer — warranty products require customer details')
          openCustomerPicker()
          return
        }
        if (cart.length === 0 && ck.customerOutstanding > 0) setIncludeOutstanding(true)
        setMobileView('cart')
        setCartView('checkout')
        setTimeout(() => {
          if (cart.length > 0) payNowRef.current?.focus()
          else if (ck.customerOutstanding > 0) outstandingPayRef.current?.focus()
        }, 80)
      }
    }
    const payNow = () => {
      const ck = checkoutKeyboardRef.current
      if ((cart.length > 0 || ck.outstandingPaying > 0) && !checkoutLoading && !completedSale) {
        if (cartView === 'checkout') void handleCheckoutRef.current()
        else openCheckout()
      }
    }
    const focusCustomerPaid = () => {
      const ck = checkoutKeyboardRef.current
      setPaymentMethodId('CASH')
      if (!ck.hasSelectedCustomer) {
        const amt = ck.collectAtCheckout > 0 ? ck.collectAtCheckout.toFixed(2) : ''
        setCustomerPaid(amt)
        setTimeout(() => {
          customerPaidRef.current?.focus()
          customerPaidRef.current?.select()
        }, 0)
      } else if (payNowRef.current) {
        payNowRef.current.focus()
        payNowRef.current.select()
      } else if (outstandingPayRef.current) {
        outstandingPayRef.current.focus()
        outstandingPayRef.current.select()
      }
    }
    const handler = (e: KeyboardEvent) => {
      const fnKey = /^F([1-9]|1[0-2])$/.test(e.key)

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (pricePrompt) { setPricePrompt(null); setPricePromptVal(''); return }
        if (showRecentInvoices) setShowRecentInvoices(false)
        else if (showHeldCarts) setShowHeldCarts(false)
        else if (showCalc) setShowCalc(false)
        else if (showReturnModal) { setShowReturnModal(false); setActiveNavId('products') }
        else if (showDocPreview) setShowDocPreview(null)
        else if (showMoreMenu) setShowMoreMenu(false)
        else if (showFilters) setShowFilters(false)
        else if (showOpeningCash) setShowOpeningCash(false)
        else if (showDayEnd) setShowDayEnd(false)
        else if (showCashFlow) setShowCashFlow(false)
        else if (variationPickerProduct) setVariationPickerProduct(null)
        else if (showRegister && (showCartCustDrop || showCustDrop)) setShowRegister(false)
        else if (showCartCustDrop || showCustDrop) { setShowCartCustDrop(false); setShowCustDrop(false); setShowRegister(false) }
        else if (cartView === 'checkout' && !completedSale) setCartView('items')
        else if (mobileView === 'cart' && !isDesktop) setMobileView('products')
        else requestClosePos()
        return
      }

      if (e.ctrlKey && !e.shiftKey && e.key === 'F7') {
        e.preventDefault()
        if (cart.length > 0) setShowDocPreview('QUOTE')
        else toast.error('Cart is empty')
        return
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'F8') {
        e.preventDefault()
        if (cart.length > 0) setShowDocPreview('DRAFT')
        else toast.error('Cart is empty')
        return
      }
      if (e.shiftKey && e.key === 'F6') {
        e.preventDefault()
        setShowHeldCarts(true)
        return
      }

      if (fnKey || (e.ctrlKey && e.key === 'Enter')) {
        const runShortcut = (action: PosShortcutActionId | null) => {
          if (!action) return
          e.preventDefault()
          switch (action) {
            case 'focusSearch': searchRef.current?.focus(); searchRef.current?.select(); break
            case 'customer': openCustomerPicker(); break
            case 'payNow': payNow(); break
            case 'hold': handleHoldSales(); break
            case 'recent':
              if (completedSale) {
                const saleData: PosReceiptSale = {
                  invoiceNumber: completedSale.invoiceNumber,
                  createdAt: completedSale.createdAt,
                  customerName: completedSale.customerName,
                  customerPhone: completedSale.customerPhone,
                  items: completedSale.items ?? [],
                  subtotal,
                  discountAmount,
                  total: completedSale.total ?? saleTotal,
                  paymentMethod: completedSale.paymentMethod,
                  cashReceived: completedSale.cashReceived,
                  changeAmount: completedSale.changeAmount,
                  warrantyNumbers: completedSale.warrantyNumbers,
                  warrantyMonths: completedSale.warrantyMonths,
                  warranties: completedSale.warranties,
                }
                printPosReceipt(saleData, invoiceSettings, thermalShopCtx)
              } else openRecentSales()
              break
            case 'reload':
              if (hasDailyReload) {
                setSelectedCategory('RELOAD')
                setActiveNavId('products')
              } else setShowHeldCarts(true)
              break
            case 'dayStart': openDayStartModal(); break
            case 'cashFlow': setCashFlowMode('IN'); setShowCashFlow(true); break
            case 'checkout': openCheckout(); break
            case 'newSale': handleNewSale(); break
            case 'dayEnd': if (hasDailyClosing) openDayEnd(); break
            case 'calculator': setShowCalc(p => !p); break
          }
        }
        if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); payNow(); return }
        if (fnKey) runShortcut(resolvePosShortcutAction(e.key, posUi))
        return
      }

      if (isTyping()) return

      const ck = checkoutKeyboardRef.current
      if (cartView === 'checkout' && !completedSale && (cart.length > 0 || ck.outstandingPaying > 0)) {
        const methodIdx = ['1', '2', '3', '4', '5'].indexOf(e.key)
        if (methodIdx >= 0 && payMethodsRef.current[methodIdx]) {
          e.preventDefault()
          setPaymentMethodId(payMethodsRef.current[methodIdx].id)
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          void handleCheckoutRef.current()
        }
        if (e.key === 'o' || e.key === 'O') {
          if (selectedCustomer && customerOutstanding > 0) {
            e.preventDefault()
            setIncludeOutstanding(p => !p)
          }
        }
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault()
          focusCustomerPaid()
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
  }, [cart, cartView, checkoutLoading, completedSale, selectedCustomer, customerOutstanding, subtotal, discountAmount, saleTotal, invoiceSettings, pricePrompt, variationPickerProduct, mobileView, isDesktop, requestClosePos, openCustomerPicker, showCustDrop, showCartCustDrop, showRegister, showRecentInvoices, showHeldCarts, showCalc, showReturnModal, showDocPreview, showMoreMenu, showFilters, showOpeningCash, showDayEnd, showCashFlow, posUi])

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
    setMobileView('products')
    setManualTotalMode(false); setManualTotal('')
    setCustomerOutstanding(0); setIncludeOutstanding(false); setOutstandingPayAmount('')
    setAmountPaying(''); setCustomerPaid(''); setPaymentMethodId('CASH')
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
    if (id === 'products') { setActiveNavId('products'); return }
    if (id === 'sales') { setActiveNavId('sales'); openRecentSales(); return }
    if (id === 'customers') { openCustomerPicker(); return }
    if (id === 'imei') { setShowScanInput(true); return }
    if (id === 'cash') { setCashFlowMode('IN'); setShowCashFlow(true); return }
    if (id === 'returns') { setActiveNavId('returns'); setShowReturnModal(true); return }
    if (id === 'reload') { setSelectedCategory('RELOAD'); setActiveNavId('products'); return }
    const routes: Record<string, string> = {
      repairs: '/dashboard/repairs',
      purchase: '/purchase-invoice',
      inventory: '/dashboard/inventory',
      reports: '/dashboard/reports/overview',
      expenses: '/dashboard/expenses',
      settings: '/dashboard/settings',
    }
    if (routes[id]) {
      if (cart.length > 0 && posUi.behavior.confirmLeaveWithCart && !window.confirm('Leave POS? Unsaved cart items will be lost unless held.')) {
        return
      }
      onClose()
      router.push(routes[id])
    }
  }, [onClose, router, openRecentSales, openCustomerPicker, cart.length, posUi.behavior.confirmLeaveWithCart])

  const posNavItems = useMemo(
    () => buildPosNavItems({ hasIMEI, hasFinance, hasDailyReload }),
    [hasIMEI, hasFinance, hasDailyReload],
  )

  const categoryTabs = useMemo(
    () => buildCategoryTabs({ hasServices, hasDailyReload }, categories, getCategoryIcon),
    [hasServices, hasDailyReload, categories],
  )

  const bottomActionButtons = useMemo(
    () => buildBottomActions({
      flags: { hasDailyReload, hasDailyClosing },
      heldCount: heldCarts.length,
      dayStarted,
      dayIsClosed,
      visibleIds: posUi.bottomActions.visible,
      handlers: {
        newSale: handleNewSale,
        holdSales: handleHoldSales,
        recentSales: openRecentSales,
        reload: () => { setSelectedCategory('RELOAD'); setActiveNavId('products') },
        dayStart: openDayStartModal,
        dayEnd: openDayEnd,
        cashFlow: () => { setCashFlowMode('IN'); setShowCashFlow(true) },
        moreMenu: () => setShowMoreMenu(true),
      },
    }),
    [hasDailyReload, hasDailyClosing, heldCarts.length, dayStarted, dayIsClosed, handleNewSale, handleHoldSales, openRecentSales, openDayStartModal, openDayEnd, posUi.bottomActions.visible],
  )

  const sendWhatsAppInvoice = useCallback(async () => {
    if (!completedSale?.id) return
    const phone = formatWhatsAppPhone(completedSale.customerPhone ?? selectedCustomer?.phone ?? '')
    if (!phone) { toast.error('Customer phone required for WhatsApp invoice'); return }

    const total = completedSale.total ?? saleTotal
    const itemLines = (completedSale.items ?? []).map((item: any) => {
      const name = item.name ?? item.productName ?? 'Item'
      const qty = item.quantity ?? 1
      const lineTotal = item.total ?? item.lineTotal ?? (Number(item.price ?? item.unitPrice ?? 0) * qty)
      return `  - ${name} x${qty} — ${formatCurrency(lineTotal)}`
    }).join('\n')

    const message = [
      `*INVOICE — ${invoiceSettings.shopName || storeName}*`,
      invoiceSettings.phone ? `Tel: ${invoiceSettings.phone}` : null,
      ``,
      `*Invoice:* ${completedSale.invoiceNumber}`,
      completedSale.customerName ? `*Customer:* ${completedSale.customerName}` : null,
      ``,
      itemLines ? `*Items:*\n${itemLines}` : null,
      ``,
      `*Total: ${formatCurrency(total)}*`,
      (completedSale.dueAmount ?? 0) > 0 ? `*Credit (outstanding):* ${formatCurrency(completedSale.dueAmount)}` : null,
      ``,
      `_Thank you for your purchase!_`,
    ].filter(v => v != null && v !== '').join('\n')

    setWaSending(true)
    try {
      const st: any = await whatsappApi.getStatus()
      const wa = st?.data ?? st
      if (wa?.status !== 'connected') {
        toast.error('WhatsApp not connected — open WhatsApp → Connection and scan QR code')
        return
      }
      if (wa?.enabled === false) {
        toast.error('WhatsApp is disabled — turn on the switch in WhatsApp → Connection')
        return
      }

      let pdfBase64: string | undefined
      let pdfFilename: string | undefined
      if (waSendPdf && a4Ref.current) {
        await new Promise(r => setTimeout(r, 150))
        try {
          const pdf = await captureElementAsPdfBase64(
            a4Ref.current,
            `Invoice_${completedSale.invoiceNumber ?? completedSale.id}.pdf`,
          )
          pdfBase64 = pdf.base64
          pdfFilename = pdf.filename
        } catch {
          toast.error('PDF generation failed — sending text only')
        }
      }

      await whatsappApi.sendInvoice({
        orderId:      completedSale.invoiceNumber ?? completedSale.id,
        phone,
        customerName: completedSale.customerName,
        amount:       total,
        message,
        pdfBase64,
        pdfFilename,
      })
      toast.success(pdfBase64 ? 'Invoice PDF sent via WhatsApp' : 'Invoice sent via WhatsApp')
    } catch (e: any) {
      toast.error(e.message || 'WhatsApp send failed — check WhatsApp → Connection')
    } finally {
      setWaSending(false)
    }
  }, [completedSale, selectedCustomer, saleTotal, invoiceSettings, storeName, waSendPdf])

  const finishCustomerRegister = useCallback((c: any) => {
    handleCustomerCreated(c)
    setShowRegister(false)
    setShowCustDrop(false)
    setShowCartCustDrop(false)
  }, [handleCustomerCreated])

  const renderCustomerList = (autoFocus = false) => {
    if (showRegister) {
      return (
        <RegisterCustomerInline
          onBack={() => setShowRegister(false)}
          onCreated={finishCustomerRegister}
        />
      )
    }
    return (
    <>
      <div className="p-2 border-b" style={{ borderColor: POS_THEME.border }}>
        <input
          autoFocus={autoFocus}
          className="w-full h-8 px-2 rounded-lg text-xs outline-none border placeholder:opacity-40"
          style={{ background: POS_THEME.bg, borderColor: POS_THEME.border, color: POS_THEME.text }}
          placeholder="Search customer… (F2)"
          value={custSearch}
          onChange={e => setCustSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { setShowRegister(false); setShowCustDrop(false); setShowCartCustDrop(false) } }}
        />
      </div>
      <div className="overflow-y-auto max-h-60">
        <button type="button" onClick={() => selectCustomer(null)} className="w-full px-3 py-2 text-xs text-left border-b hover:bg-black/5" style={{ borderColor: POS_THEME.border, color: POS_THEME.text }}>Walk-in Customer</button>
        <button type="button" onClick={() => setShowRegister(true)} className="w-full px-3 py-2 text-xs text-left border-b flex items-center gap-1 hover:bg-black/5" style={{ borderColor: POS_THEME.border, color: POS_THEME.text }}><Plus size={10} />New Customer</button>
        {custLoading && <p className="px-3 py-2 text-[10px]" style={{ color: POS_THEME.muted }}>Loading…</p>}
        {filteredCustomers.slice(0, 80).map((c: any) => (
          <button key={c.id} type="button" onClick={() => selectCustomer(c)} className="w-full px-3 py-2 text-left border-b hover:bg-black/5" style={{ borderColor: POS_THEME.border }}>
            <p className="text-xs font-semibold" style={{ color: POS_THEME.text }}>{c.name}</p>
            <p className="text-[10px]" style={{ color: POS_THEME.muted }}>{c.phone}{(c.totalDue ?? 0) > 0 ? ` · Due ${formatCurrency(c.totalDue)}` : ''}</p>
          </button>
        ))}
      </div>
    </>
    )
  }

  const customerSlot = (
    <div className="relative w-full">
      <button type="button" onClick={() => { setShowCustDrop(o => !o); setShowCartCustDrop(false); setCustSearch(''); setShowRegister(false) }}
        className="h-10 w-full px-3 sm:px-3.5 rounded-xl border flex items-center gap-2.5 text-sm font-semibold"
        style={{ background: POS_THEME.card, borderColor: POS_THEME.border, color: POS_THEME.text }}
        title="Select customer (F2)">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
          style={{ background: selectedCustomer ? POS_THEME.purple : POS_THEME.bg, color: selectedCustomer ? '#fff' : POS_THEME.muted }}>
          {selectedCustomer ? selectedCustomer.name[0]?.toUpperCase() : <User size={12} />}
        </div>
        <span className="min-w-0 flex-1 truncate text-left">{selectedCustomer ? selectedCustomer.name : 'Walk-in'}</span>
        <ChevronDown size={12} className="shrink-0 opacity-60" />
      </button>
      {showCustDrop && (
        <div className={`absolute top-full mt-1.5 right-0 z-[60] rounded-2xl shadow-2xl overflow-hidden border ${showRegister ? 'w-[min(24rem,calc(100vw-1.25rem))]' : 'w-[min(16rem,calc(100vw-1.25rem))]'}`} style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}>
          {renderCustomerList(true)}
        </div>
      )}
    </div>
  )

  const imeiSlot = showScanInput ? (
    <div className="relative shrink-0 w-[min(9.5rem,42vw)] sm:w-40">
      <input autoFocus type="text" placeholder="IMEI Search" className="h-9 w-full pl-3 pr-8 rounded-xl text-sm outline-none border"
        style={{ background: POS_THEME.card, borderColor: 'rgba(59,130,246,0.4)', color: POS_THEME.text }}
        value={imeiScan} onChange={e => setImeiScan(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { handleImeiScan(imeiScan); setShowScanInput(false) } if (e.key === 'Escape') { setShowScanInput(false); setImeiScan('') } }}
        onBlur={() => { if (!imeiScan) setShowScanInput(false) }} />
      {imeiScanning && <Loader2 size={11} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-blue-400" />}
    </div>
  ) : null

  return (
    <>
      {/* ── Variation Picker Modal ─────────────────────────────── */}
      {variationPickerProduct && (
        <VariationPickerModal
          product={variationPickerProduct}
          variations={Array.isArray(variationPickerProduct.storageVariations) ? variationPickerProduct.storageVariations : []}
          branchId={posBranchId || undefined}
          priceMode={effectivePriceMode}
          allowPriceEdit={hasPosPriceEdit}
          showWholesale={hasWholesalePricing}
          showCredit={hasCreditPricing}
          showWarranty={hasWarranty}
          onPriceModeChange={selectPriceMode}
          onClose={() => setVariationPickerProduct(null)}
          onAdd={(variation, imei, price, warranty) => {
            const product = variationPickerProduct
            setVariationPickerProduct(null)
            addToCart(product, imei, variation, price, warranty)
            toast.success(`Added: ${product.name} · ${variation.storage} / ${variation.colorName}`)
          }}
        />
      )}

      {pricePrompt && (
        <PricePromptModal
          productName={pricePrompt.product.displayName ?? pricePrompt.product.name}
          subtitle={
            pricePrompt.variation
              ? `${pricePrompt.variation.storage} / ${pricePrompt.variation.colorName}`
              : (pricePrompt.imei ? `IMEI ${pricePrompt.imei}` : (pricePrompt.product.sku || undefined))
          }
          catalogPrice={pricePrompt.catalogPrice}
          value={pricePromptVal}
          onChange={setPricePromptVal}
          onConfirm={confirmPricePrompt}
          onClose={() => { setPricePrompt(null); setPricePromptVal('') }}
          priceMode={effectivePriceMode}
          showWholesale={hasWholesalePricing}
          showCredit={hasCreditPricing}
          onPriceModeChange={selectPriceMode}
        />
      )}

      {/* Modals */}
      {showA4Invoice && completedSale && (
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
            <InvoiceA4View
              sale={completedSale}
              settings={invoiceSettings}
              tenantSlug={tenantSlug}
              shopName={shopName}
              template={activeInvoiceTemplate}
              extras={{ subtotal, discountAmount }}
              hideControls={false}
            />
          </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <PosShell
        shopName={storeName}
        onClose={requestClosePos}
        cashierName={cashierName}
        syncTime={syncTime}
        search={search}
        onSearchChange={setSearch}
        searchRef={searchRef}
        onSearchKeyDown={handleSearchScan}
        onScanClick={() => setShowScanInput(true)}
        onBellClick={() => setShowHeldCarts(true)}
        onNavAction={handleNavAction}
        navItems={posNavItems}
        activeNavId={activeNavId}
        heldBadgeCount={heldCarts.length}
        mobileView={mobileView}
        cartItemCount={cart.length}
        onMobileViewChange={setMobileView}
        layoutPrefs={{
          theme: posUi.theme,
          accent: posUi.accent,
          density: posUi.density,
          showSidebar: posUi.layout.showSidebar,
          showBottomActions: posUi.layout.showBottomActions,
          cartPosition: posUi.layout.cartPosition,
          cartWidth: posUi.layout.cartWidth,
        }}
        onFiltersClick={() => setShowFilters(v => !v)}
        filtersActive={showFilters || hideOutOfStock || showFavoritesOnly}
        filtersPanel={showFilters ? (
          <div className="shrink-0 w-full px-4 py-2.5 flex flex-wrap items-center gap-x-8 gap-y-2 border-b" style={{ borderColor: POS_THEME.border, background: POS_THEME.card }}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: POS_THEME.muted }}>Filters</span>
            <label className="flex items-center gap-2.5 text-[11px] font-medium cursor-pointer" style={{ color: POS_THEME.text }}>
              Hide Out of Stock
              <Switch
                checked={hideOutOfStock}
                onChange={setHideOutOfStock}
                trackStyle={{ background: hideOutOfStock ? POS_THEME.purple : POS_THEME.border }}
              />
            </label>
            <label className="flex items-center gap-2.5 text-[11px] font-medium cursor-pointer" style={{ color: POS_THEME.text }}>
              Favorites only
              <Switch
                checked={showFavoritesOnly}
                onChange={setShowFavoritesOnly}
                trackStyle={{ background: showFavoritesOnly ? POS_THEME.purple : POS_THEME.border }}
              />
            </label>
          </div>
        ) : null}
        toolbarActions={(
          <>
            <button type="button" onClick={openRecentSales} title="Recent Sales"
              className="h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 hover:bg-black/5"
              style={{ borderColor: POS_THEME.border, background: POS_THEME.card, color: POS_THEME.text }}>
              <Receipt size={15} />
            </button>
            <button type="button" onClick={() => setShowCalc(true)} title="Calculator (F12)"
              className="h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 hover:bg-black/5"
              style={{ borderColor: POS_THEME.border, background: POS_THEME.card, color: POS_THEME.text }}>
              <Calculator size={15} />
            </button>
          </>
        )}
        imeiSlot={imeiSlot}
        customerSlot={customerSlot}
        categoryBar={(
          <div className="flex items-center gap-2 px-2 sm:px-4 py-2 sm:py-2.5 border-b shrink-0 overflow-x-auto scrollbar-none" style={{ borderColor: POS_THEME.border, background: POS_THEME.panel }}>
            {categoryTabs.map(({ id, name, icon: Icon }) => (
              <button key={id} onClick={() => setSelectedCategory(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0 whitespace-nowrap"
                style={selectedCategory === id
                  ? { background: POS_THEME.purple, color: '#fff', boxShadow: `0 2px 10px ${POS_THEME.purple}59`, border: 'none' }
                  : { background: POS_THEME.card, border: `1px solid ${POS_THEME.border}`, color: POS_THEME.muted }}>
                <Icon size={11} />{name}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 p-0.5 rounded-xl border shrink-0" style={{ borderColor: POS_THEME.border, background: POS_THEME.bg }}>
              <button
                type="button"
                onClick={() => setGridView(true)}
                title="Grid view"
                aria-pressed={gridView}
                className="p-1.5 rounded-lg transition-colors outline-none"
                style={gridView
                  ? { background: POS_THEME.purple, color: '#fff' }
                  : { background: 'transparent', color: POS_THEME.muted }}
              >
                <Grid3X3 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setGridView(false)}
                title="List view"
                aria-pressed={!gridView}
                className="p-1.5 rounded-lg transition-colors outline-none"
                style={!gridView
                  ? { background: POS_THEME.purple, color: '#fff' }
                  : { background: 'transparent', color: POS_THEME.muted }}
              >
                <ListIcon size={14} />
              </button>
            </div>
          </div>
        )}
        productGrid={(
          selectedCategory === 'RELOAD' && hasDailyReload ? (
            <PosReloadPanel onAdd={addReloadToCart} />
          ) : (
          <div className={gridView ? gridColsClass(posUi.productGrid.columnsDesktop) : 'space-y-1.5'}>
            {pagedProducts.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center h-40 opacity-30">
                <PackageSearch size={32} className="mb-2" style={{ color: POS_THEME.muted }} />
                <p className="text-sm" style={{ color: POS_THEME.muted }}>{selectedCategory === 'SERVICES' ? 'No services found' : products.length === 0 ? 'Loading products…' : 'No products found'}</p>
              </div>
            ) : pagedProducts.map((item: any) => {
                  const isService = selectedCategory === 'SERVICES'
                  const vars   = Array.isArray(item.storageVariations) ? item.storageVariations : []
                  const stockInfo = isService
                    ? { label: '', color: POS_THEME.muted, isOut: false, isLow: false }
                    : posStockLabel(item, hasIMEI)
                  const isOut  = !isService && stockInfo.isOut
                  const isLow  = !isService && stockInfo.isLow
                  const isHot  = !isService && !isOut && posSellableStock(item, hasIMEI) >= 25
                  const { gradient, iconColor, Icon: CardIcon } = isService ? { gradient: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})`, iconColor: '#c4b5fd', Icon: Wrench } : getProductCardStyle(item)
                  const isFav  = favorites.has(item.id)
                  const price  = formatCurrency(isService ? item.price : resolveCatalogPrice(item, effectivePriceMode))
                  const stockLabel = stockInfo.label
                  const stockColor = stockInfo.color
                  const handlePick = () => {
                    if (isOut) return
                    openProductForSale(item)
                  }
                  const showWarrantyBadge = posUi.productGrid.showWarrantyBadge && hasWarranty && !isService && (item.warrantyMonths ?? 0) > 0

                  if (!gridView) {
                    return (
                      <div key={item.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all cursor-pointer select-none ${isOut ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.04] hover:border-violet-500/30'}`}
                        style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}
                        onClick={handlePick}>
                        <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0">
                          <div className="absolute inset-0" style={{ background: gradient }} />
                          {item.imageUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={item.imageUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                            : <div className="absolute inset-0 flex items-center justify-center"><CardIcon size={18} style={{ color: iconColor }} /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: POS_THEME.text }}>{item.name}</p>
                          {posUi.productGrid.showSku && (
                            <p className="text-[11px] font-mono truncate" style={{ color: POS_THEME.muted }}>{item.sku}</p>
                          )}
                          {showWarrantyBadge && (
                            <p className="text-[10px] font-semibold flex items-center gap-1 mt-0.5" style={{ color: POS_THEME.green }}>
                              <Shield size={9} /> {formatWarrantyMonths(item.warrantyMonths ?? 0)} warranty
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-sm font-extrabold" style={{ color: POS_THEME.text }}>{price}</p>
                          {!isService && posUi.productGrid.showStockBadge && (
                            <p className="text-[10px] font-semibold" style={{ color: stockColor }}>{stockLabel}</p>
                          )}
                        </div>
                        <button type="button" disabled={isOut}
                          onClick={e => { e.stopPropagation(); handlePick() }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-30 hover:scale-105 active:scale-95 shrink-0"
                          style={{ background: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})` }}>
                          <Plus size={14} />
                        </button>
                      </div>
                    )
                  }

                  return (
                    <div key={item.id}
                      className={`relative flex flex-col h-full rounded-xl overflow-hidden border transition-all group cursor-pointer select-none ${isOut ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-black/25 hover:-translate-y-0.5'}`}
                      style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}
                      onClick={handlePick}>

                      {/* Image */}
                      <div className="relative aspect-[5/3] lg:aspect-[16/10] overflow-hidden">
                        <div className="absolute inset-0" style={{ background: gradient }}>
                          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 65% 20%, rgba(255,255,255,0.18) 0%, transparent 55%)' }} />
                        </div>

                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(4px)' }}>
                              <CardIcon size={20} style={{ color: iconColor }} />
                            </div>
                          </div>
                        )}

                        {!isOut && (
                          <div className="absolute inset-0 hidden [@media(hover:hover)]:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.28)' }}>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center border border-white/50" style={{ background: 'rgba(255,255,255,0.15)' }}>
                              <Plus size={14} className="text-white" />
                            </div>
                          </div>
                        )}

                        {isHot && !isLow && posUi.productGrid.showHotBadge && (
                          <div className="absolute top-1 left-1 px-1.5 py-px rounded text-[8px] font-extrabold tracking-wide text-white" style={{ background: POS_THEME.red }}>HOT</div>
                        )}
                        {isLow && posUi.productGrid.showStockBadge && (
                          <div className="absolute top-1 left-1 flex items-center gap-0.5 px-1.5 py-px rounded-full text-[8px] font-bold border border-white/30 text-white" style={{ background: 'rgba(0,0,0,0.35)' }}>⚠ LOW</div>
                        )}
                        {vars.length > 0 && (
                          <div className="absolute bottom-1 left-1 px-1.5 py-px rounded text-[8px] font-bold text-white/90" style={{ background: 'rgba(0,0,0,0.4)' }}>{vars.length} var</div>
                        )}
                        {showWarrantyBadge && (
                          <div className="absolute bottom-1 right-1 flex items-center gap-0.5 px-1.5 py-px rounded text-[8px] font-bold text-white" style={{ background: 'rgba(16,185,129,0.85)' }}>
                            <Shield size={8} /> {formatWarrantyMonths(item.warrantyMonths ?? 0)}
                          </div>
                        )}
                        <button type="button" onClick={e => { e.stopPropagation(); setFavorites(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n }) }}
                          className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isFav ? 'opacity-100 text-red-400' : 'opacity-0 [@media(hover:hover)]:group-hover:opacity-100 text-white/70 hover:text-red-400'}`}
                          style={{ background: 'rgba(0,0,0,0.35)' }}>
                          <Heart size={10} fill={isFav ? 'currentColor' : 'none'} />
                        </button>
                      </div>

                      {/* Info */}
                      <div className="flex flex-col px-2 sm:px-2.5 py-1.5 sm:py-2 gap-0.5 flex-1">
                        <p className="text-[11px] sm:text-xs font-bold leading-snug line-clamp-2 min-h-[1.75rem]" style={{ color: POS_THEME.text }}>{item.name}</p>
                        {posUi.productGrid.showSku && (
                          <p className="text-[10px] font-mono truncate" style={{ color: POS_THEME.muted }}>{item.sku}</p>
                        )}
                        <div className="flex items-end justify-between gap-1.5 mt-auto pt-1">
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-extrabold leading-none truncate" style={{ color: POS_THEME.text }}>{price}</p>
                            {isService && canSeeProductCost ? (
                              <p className="text-[10px] mt-0.5 truncate" style={{ color: POS_THEME.muted }}>
                                Cost {formatCurrency(Number(item.cost ?? 0))}
                              </p>
                            ) : posUi.productGrid.showStockBadge ? (
                              <p className="text-[10px] font-semibold flex items-center gap-1 mt-0.5 truncate" style={{ color: stockColor }}>
                                <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ background: stockColor }} />
                                {stockLabel}
                              </p>
                            ) : null}
                          </div>
                          <button type="button" disabled={isOut}
                            onClick={e => { e.stopPropagation(); handlePick() }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-30 hover:scale-105 active:scale-95 shrink-0"
                            style={{ background: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})`, boxShadow: `0 2px 8px ${POS_THEME.purple}55` }}>
                            <Plus size={14} />
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
          <div className="flex items-center justify-between gap-2 px-2 sm:px-4 py-2 sm:py-2.5 border-t shrink-0" style={{ borderColor: POS_THEME.border, background: POS_THEME.panel }}>
            <span className="hidden md:inline text-xs truncate" style={{ color: POS_THEME.muted }}>Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, displayItems.length)} of {displayItems.length}</span>
            <div className="flex items-center gap-1 mx-auto md:mx-0">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border hover:bg-black/5 disabled:opacity-30 transition-colors touch-manipulation"
                style={{ borderColor: POS_THEME.border, color: POS_THEME.text }}>
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg text-xs font-bold flex items-center justify-center border transition-colors touch-manipulation"
                    style={page === p
                      ? { background: POS_THEME.purple, borderColor: POS_THEME.purple, color: '#fff' }
                      : { borderColor: POS_THEME.border, color: POS_THEME.text, background: POS_THEME.card }}>{p}</button>
                )
              })}
              {totalPages > 5 && page < totalPages - 2 && <>
                <span className="text-xs px-0.5" style={{ color: POS_THEME.muted }}>…</span>
                <button onClick={() => setPage(totalPages)} className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg text-xs font-bold flex items-center justify-center border hover:bg-black/5 transition-colors touch-manipulation" style={{ borderColor: POS_THEME.border, color: POS_THEME.text }}>{totalPages}</button>
              </>}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border hover:bg-black/5 disabled:opacity-30 transition-colors touch-manipulation"
                style={{ borderColor: POS_THEME.border, color: POS_THEME.text }}>
                <ChevronRight size={12} />
              </button>
            </div>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}
              className="text-xs py-1 h-8 sm:h-7 rounded-lg px-1.5 sm:px-2 border outline-none shrink-0" style={{ width: 78, background: POS_THEME.card, borderColor: POS_THEME.border, color: POS_THEME.text }}>
              {[15, 20, 30, 50].map(n => <option key={n} value={n}>{n}/pg</option>)}
            </select>
          </div>
        )}
        bottomActions={(
          <div className="flex flex-nowrap gap-2 px-2 sm:px-4 py-2 sm:py-3 border-t shrink-0 overflow-x-auto scrollbar-none" style={{ borderColor: POS_THEME.border, background: POS_THEME.panel }}>
            {bottomActionButtons.map(btn => (
              <button key={btn.label} type="button" onClick={btn.onClick}
                className="flex-none min-w-[5.5rem] sm:flex-1 sm:min-w-[88px] h-10 rounded-xl text-[11px] sm:text-xs font-bold border touch-manipulation whitespace-nowrap"
                style={{ background: btn.bg, borderColor: POS_THEME.border, color: btn.color ?? '#ffffff' }}>
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
                    {completedSale.offline && (
                      <p className="text-[10px] text-amber-400">Offline — pending sync</p>
                    )}
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
                        {item.imei && <p className="text-[10px] font-mono text-slate-400 mt-0.5">IMEI: {item.imei}</p>}
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
                  <button onClick={() => {
                    const saleData: PosReceiptSale = { invoiceNumber: completedSale.invoiceNumber, createdAt: completedSale.createdAt, customerName: completedSale.customerName, customerPhone: completedSale.customerPhone, cashierName: completedSale.cashierName, items: completedSale.items ?? [], subtotal, discountAmount, total: completedSale.total ?? saleTotal, payments: completedSale.payments, paymentMethod: completedSale.paymentMethod, cashReceived: completedSale.cashReceived, changeAmount: completedSale.changeAmount, warrantyNumbers: completedSale.warrantyNumbers, warrantyMonths: completedSale.warrantyMonths, warranties: completedSale.warranties, dueAmount: completedSale.dueAmount }
                    printPosReceipt(saleData, invoiceSettings, thermalShopCtx)
                  }} className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">
                    <Printer size={12} /> {invoiceSettings.thermalWidthPOS === 'stockForm' ? 'Stock Form Print' : 'Thermal Print'}
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
                    {waSending ? 'Sending…' : waSendPdf ? 'Send WhatsApp Invoice (PDF)' : 'Send WhatsApp Invoice'}
                  </button>
                )}
                <button onClick={handleNewSale} className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.99]" style={{ background: 'var(--brand-gradient)', boxShadow: '0 4px 20px var(--brand-glow)' }}>+ New Sale (F10)</button>
              </div>
              {completedSale && (
                <div style={{ position: 'fixed', left: '-9999px', top: 0, width: 794, pointerEvents: 'none' }}>
                  <InvoiceA4View
                    ref={a4Ref}
                    sale={completedSale}
                    settings={invoiceSettings}
                    tenantSlug={tenantSlug}
                    shopName={shopName}
                    template={activeInvoiceTemplate}
                    extras={{ subtotal, discountAmount }}
                    hideControls
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: POS_THEME.border, background: POS_THEME.panel }}>
                {cartView === 'checkout' ? (
                  <>
                    <button type="button" onClick={() => setCartView('items')}
                      className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                      style={{ color: POS_THEME.muted }}>
                      <ChevronLeft size={14} /><span>Cart</span>
                    </button>
                    <span className="font-bold text-sm truncate" style={{ color: POS_THEME.text }}>Checkout</span>
                    <span className="pos-price text-sm font-bold shrink-0 ml-auto">{formatCurrency(saleTotal)}</span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setMobileView('products')} className="lg:hidden flex items-center gap-1 text-xs mr-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: POS_THEME.muted }}>
                        <ChevronLeft size={14} /><span>Products</span>
                      </button>
                      <ShoppingBag size={14} style={{ color: POS_THEME.purple }} />
                      <span className="font-bold text-sm" style={{ color: POS_THEME.text }}>Cart ({cart.length})</span>
                    </div>
                    {cart.length > 0 && (
                      <button type="button" onClick={clearCartWithConfirm} className="text-xs font-semibold hover:opacity-80" style={{ color: POS_THEME.red }}>
                        Clear Cart
                      </button>
                    )}
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
                        <button type="button" onClick={() => { setMobileView('cart'); setCartView('checkout'); setIncludeOutstanding(true) }}
                          className="mt-4 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                          style={{ background: 'var(--brand-gradient)' }}>
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
                  <div key={item.cartId} className="rounded-xl border overflow-hidden" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}>
                    <div className="flex items-start gap-2 p-2.5">
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
                      <p className="text-xs font-semibold leading-snug line-clamp-2" style={{ color: POS_THEME.text }}>{item.name}</p>
                      {item.isReload && item.reloadProvider && (
                        <p className="text-[10px] font-semibold mt-0.5" style={{ color: POS_THEME.teal }}>
                          {item.reloadProvider}
                          {item.reloadType === 'RECHARGE_CARD' ? ' · Recharge Card' : ' · Reload'}
                        </p>
                      )}
                      {item.isService && canSeeProductCost && (
                        <p className="text-[9px] mt-0.5" style={{ color: POS_THEME.muted }}>
                          Cost {formatCurrency((item.cost ?? 0) * item.quantity)}
                          {(item.cost ?? 0) > 0 && <span style={{ color: POS_THEME.green }}> · Margin {formatCurrency((item.price - (item.cost ?? 0)) * item.quantity)}</span>}
                        </p>
                      )}
                      {item.imei && <p className="text-[10px] font-mono mt-0.5 text-white/70 truncate">IMEI: {item.imei}</p>}
                      {hasWarranty && !item.isService && !item.isReload && (item.warrantyMonths ?? 0) > 0 && (
                        <span
                          className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold"
                          style={{
                            borderColor: 'rgba(16,185,129,0.35)',
                            color: POS_THEME.green,
                            background: 'rgba(16,185,129,0.1)',
                          }}
                        >
                          <Shield size={9} className="shrink-0" />
                          <span className="truncate">{posWarrantyMonthsLabel(item.warrantyMonths ?? 0)} warranty</span>
                          {item.warrantyNote?.trim() && <span className="shrink-0 opacity-60">· note</span>}
                        </span>
                      )}
                      <p className="mt-1.5 text-[10px]" style={{ color: POS_THEME.muted }}>
                        {formatCurrency(item.price)} each
                        {item.price !== item.originalPrice && <span className="text-white ml-1">✓</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                      {isQtyLockedLine(item) ? (
                        <span className="w-8 text-center text-xs font-bold" style={{ color: POS_THEME.text }}>{item.quantity}</span>
                      ) : (
                        <>
                      <button onClick={() => updateQty(item.cartId, -1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-md bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors touch-manipulation" aria-label="Decrease quantity"><Minus size={10} /></button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setQty(item.cartId, v) }}
                        onFocus={e => e.target.select()}
                        className="w-8 h-8 sm:h-6 text-center text-xs font-bold rounded border focus:outline-none focus:border-violet-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        style={{ color: POS_THEME.text, background: POS_THEME.card, borderColor: POS_THEME.border }}
                        aria-label="Quantity"
                      />
                      <button onClick={() => updateQty(item.cartId, 1)} className="w-8 h-8 sm:w-6 sm:h-6 rounded-md bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors touch-manipulation" aria-label="Increase quantity"><Plus size={10} /></button>
                        </>
                      )}
                    </div>
                    <span className="text-xs font-bold w-[4.5rem] text-right flex-shrink-0 pt-1" style={{ color: POS_THEME.text }}>{formatCurrency(item.price * item.quantity)}</span>
                    <button type="button" onClick={() => setCart(prev => prev.filter(i => i.cartId !== item.cartId))}
                      className="w-8 h-8 sm:w-6 sm:h-6 rounded-md flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 mt-0.5 touch-manipulation" aria-label="Remove item"><X size={11} /></button>
                    </div>
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
                  <button type="button" onClick={() => {
                    if (hasWarranty && warrantyCartItems.length > 0 && !selectedCustomer) {
                      toast.error('Select a customer — warranty products require customer details')
                      openCustomerPicker()
                      return
                    }
                    setMobileView('cart')
                    setCartView('checkout')
                    setTimeout(() => payNowRef.current?.focus(), 80)
                  }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-95"
                    style={{ background: 'var(--brand-gradient)', boxShadow: '0 4px 20px var(--brand-glow)' }}>
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
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--sidebar-active-border)' }}>
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
                      <button type="button" onClick={() => { setShowCartCustDrop(o => !o); setShowCustDrop(false); setCustSearch(''); setShowRegister(false) }}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold border text-white hover:bg-white/5"
                        style={{ borderColor: POS_THEME.border, background: POS_THEME.panel }}>
                        Change
                      </button>
                    </div>
                    {showCartCustDrop && (
                      <div className={`absolute left-0 right-0 top-full mt-1 z-[60] rounded-2xl shadow-2xl overflow-hidden border ${showRegister ? 'min-w-[min(320px,calc(100vw-2rem))]' : ''}`} style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}>
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
                  {hasServiceInCart && canSeeProductCost && (
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
                        <Switch
                          checked={includeOutstanding}
                          onChange={setIncludeOutstanding}
                          title="Keyboard: O"
                          trackStyle={{ background: includeOutstanding ? POS_THEME.red : POS_THEME.border }}
                        />
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
                            ref={outstandingPayRef}
                            type="number"
                            min="0"
                            max={customerOutstanding}
                            step="0.01"
                            value={outstandingPayAmount}
                            onChange={e => setOutstandingPayAmount(e.target.value)}
                            onKeyDown={submitCheckoutFromInput}
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
                        onKeyDown={submitCheckoutFromInput}
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
                  {hasWarranty && warrantyCartItems.length > 0 && (
                    <div className="rounded-xl border p-2.5" style={{ borderColor: `${POS_THEME.amber}66`, background: `${POS_THEME.amber}0D` }}>
                      <div className="flex items-center gap-1.5">
                        <Shield size={13} style={{ color: POS_THEME.amber }} />
                        <span className="text-xs font-semibold text-white">Warranty included</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-white/10 text-amber-300">
                          {warrantyCartItems.length} item{warrantyCartItems.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-[10px] mt-1.5" style={{ color: POS_THEME.muted }}>
                        {selectedCustomer
                          ? 'Warranty certificates will be created automatically at checkout.'
                          : 'Select a customer to issue warranty certificates.'}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {warrantyCartItems.map(i => (
                          <li key={i.cartId} className="text-[10px] truncate" style={{ color: POS_THEME.text }}>
                            {i.name} · {formatWarrantyMonths(i.warrantyMonths ?? 0)}{i.imei ? ` · ${i.imei}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className={`grid gap-1.5 ${payMethods.length <= 3 ? 'grid-cols-3' : payMethods.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    {payMethods.map(({ id, key: method, label }, idx) => {
                      const MI = method === 'CASH' ? Banknote : method === 'CARD' ? CreditCard : method === 'WALLET' ? Wallet : method === 'UPI' ? Smartphone : Banknote
                      const active = method === 'CASH'
                        ? { background: `${POS_THEME.green}26`, borderColor: `${POS_THEME.green}59`, color: POS_THEME.green }
                        : method === 'CARD'
                          ? { background: `${POS_THEME.blue}26`, borderColor: `${POS_THEME.blue}59`, color: POS_THEME.blue }
                          : { background: POS_THEME.card, borderColor: POS_THEME.border, color: POS_THEME.text }
                      return (
                        <button key={id} type="button" onClick={() => {
                          setPaymentMethodId(id)
                          if (method === 'CASH') {
                            setCustomerPaid(collectAtCheckout > 0 ? collectAtCheckout.toFixed(2) : '')
                          }
                        }}
                          className="flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-semibold border transition-all"
                          title={idx < 5 ? `Key: ${idx + 1}` : label}
                          style={paymentMethodId === id
                            ? { ...active, border: `1px solid ${active.borderColor}` }
                            : { background: POS_THEME.card, border: `1px solid ${POS_THEME.border}`, color: POS_THEME.muted }}>
                          <MI size={14} /><span className="truncate max-w-full px-0.5">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                  {paymentMethod === 'CHEQUE' && (
                    <ChequeDetailsFields
                      variant="pos"
                      chequeNumber={chequeNumber}
                      chequeDate={chequeDate}
                      onNumberChange={setChequeNumber}
                      onDateChange={setChequeDate}
                    />
                  )}
                  {!selectedCustomer && paymentMethod === 'CASH' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold" style={{ color: POS_THEME.text }}>
                          Customer Paid
                          <kbd className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold border" style={{ borderColor: POS_THEME.border, color: POS_THEME.muted }}>P</kbd>
                        </span>
                        <span className="text-[10px]" style={{ color: POS_THEME.muted }}>Due {formatCurrency(collectAtCheckout)}</span>
                      </div>
                      <input
                        ref={customerPaidRef}
                        type="number"
                        min="0"
                        step="0.01"
                        value={customerPaid}
                        onChange={e => setCustomerPaid(e.target.value)}
                        onKeyDown={submitCheckoutFromInput}
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
                  {checkoutError && (
                    <p className="text-xs text-center font-semibold px-3 py-2 rounded-xl border"
                      style={{ color: '#fecaca', background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.35)' }}>
                      {checkoutError}
                    </p>
                  )}
                  <button type="button" onClick={handleCheckout} disabled={checkoutLoading || (cart.length === 0 && outstandingPaying <= 0)}
                    className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-white font-bold text-base transition-all disabled:opacity-60"
                    style={{ background: 'var(--brand-gradient)', boxShadow: checkoutLoading ? 'none' : '0 8px 28px var(--brand-glow)' }}>
                    {checkoutLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                    <span>{checkoutLoading ? 'Processing…' : `Pay Now (F3 / Enter)`}</span>
                  </button>
              </div>
              ) : null}
            </>
          )}
          </div>
        )}
        hasDailyReload={hasDailyReload}
      />
      </div>

      {/* Mobile sticky cart bar removed — bottom Products|Cart tabs + toolbar cart icon */}

      {/* ── Calculator ── */}
      {showCalc && (
        <div data-pos="dark" className="fixed bottom-20 right-3 left-3 sm:left-auto sm:bottom-4 sm:right-4 z-[115] w-auto sm:w-72 rounded-2xl shadow-2xl overflow-hidden border" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}>
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

      {/* ── Day End / Cash Count ── */}
      {showDayEnd && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowDayEnd(false)}>
          <div data-pos="dark" className="w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden max-h-[92vh] flex flex-col" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: POS_THEME.border }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${POS_THEME.purple}22`, border: `1px solid ${POS_THEME.purple}44` }}>
                  <Lock size={15} style={{ color: POS_THEME.purple }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Day End</h3>
                  <p className="text-[10px] text-white/50">{new Date(businessDateStr + 'T12:00:00').toLocaleDateString('en-US')}</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowDayEnd(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/70"><X size={14} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {dayEndLoading && !dayEndData ? (
                <div className="flex items-center justify-center py-12 text-white/60">
                  <Loader2 size={22} className="animate-spin" />
                </div>
              ) : dayEndData ? (
                <>
                  {dayEndData.isClosed ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl border" style={{ background: `${POS_THEME.green}12`, borderColor: `${POS_THEME.green}40` }}>
                      <CheckCircle2 size={20} style={{ color: POS_THEME.green }} />
                      <div>
                        <p className="text-sm font-semibold text-white">Day closed successfully</p>
                        {dayEndData.closedByName && (
                          <p className="text-[11px] text-white/50 mt-0.5">
                            By {dayEndData.closedByName}
                            {dayEndData.closedAt ? ` · ${new Date(dayEndData.closedAt).toLocaleString('en-LK')}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Total Sales', value: formatCurrency(dayEndData.sales?.totalSales ?? 0) },
                      { label: 'Cash Sales', value: formatCurrency(dayEndData.cash?.cashSales ?? 0) },
                      { label: 'OpEx', value: formatCurrency(dayEndData.expenses?.totalExpenses ?? 0) },
                      { label: 'Supplier Pay', value: formatCurrency(dayEndData.expenses?.supplierPayments ?? 0) },
                      { label: 'Reload Pay', value: formatCurrency(dayEndData.expenses?.reloadProviderPayments ?? 0) },
                      { label: 'Opening Cash', value: formatCurrency(dayEndData.openingCash ?? 0) },
                      { label: 'Expected Cash', value: formatCurrency(dayEndExpectedCash) },
                    ].map(k => (
                      <div key={k.label} className="rounded-xl px-3 py-2 border" style={{ borderColor: POS_THEME.border, background: POS_THEME.bg }}>
                        <p className="text-[10px] text-white/50 uppercase tracking-wide">{k.label}</p>
                        <p className="text-sm font-bold text-white mt-0.5">{k.value}</p>
                      </div>
                    ))}
                  </div>
                  {!dayEndData.isClosed && (
                    <>
                      <div>
                        <p className="text-xs font-semibold text-white mb-2">Cash denomination count</p>
                        <div className="grid grid-cols-3 gap-2">
                          {DAY_END_DENOMS.map(den => (
                            <label key={den.key}>
                              <span className="text-[10px] text-white/50">Rs {den.label}</span>
                              <input type="number" min="0" className="w-full h-9 mt-0.5 px-2 rounded-lg text-sm font-semibold border outline-none text-white"
                                style={{ background: POS_THEME.bg, borderColor: POS_THEME.border }}
                                value={(dayEndCashCount as Record<string, number>)[den.key]}
                                onChange={e => setDayEndCashCount(p => ({ ...p, [den.key]: parseInt(e.target.value) || 0 }))} />
                            </label>
                          ))}
                          <label>
                            <span className="text-[10px] text-white/50">Coins</span>
                            <input type="number" min="0" step="0.01" className="w-full h-9 mt-0.5 px-2 rounded-lg text-sm font-semibold border outline-none text-white"
                              style={{ background: POS_THEME.bg, borderColor: POS_THEME.border }}
                              value={dayEndCashCount.coins}
                              onChange={e => setDayEndCashCount(p => ({ ...p, coins: parseFloat(e.target.value) || 0 }))} />
                          </label>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl px-3 py-2 border" style={{ borderColor: POS_THEME.border, background: POS_THEME.bg }}>
                          <p className="text-[10px] text-white/50">Expected</p>
                          <p className="text-sm font-bold text-white">{formatCurrency(dayEndExpectedCash)}</p>
                        </div>
                        <div className="rounded-xl px-3 py-2 border" style={{ borderColor: `${POS_THEME.green}40`, background: `${POS_THEME.green}12` }}>
                          <p className="text-[10px] text-white/50">Counted</p>
                          <p className="text-sm font-bold" style={{ color: POS_THEME.green }}>{formatCurrency(dayEndCashTotal)}</p>
                        </div>
                        <div className="rounded-xl px-3 py-2 border" style={{
                          borderColor: dayEndVariance === 0 ? `${POS_THEME.green}40` : Math.abs(dayEndVariance) <= 100 ? `${POS_THEME.amber}40` : '#ef444440',
                          background: dayEndVariance === 0 ? `${POS_THEME.green}12` : Math.abs(dayEndVariance) <= 100 ? `${POS_THEME.amber}12` : '#ef444412',
                        }}>
                          <p className="text-[10px] text-white/50">Difference</p>
                          <p className="text-sm font-bold text-white">{formatCurrency(dayEndVariance)}</p>
                        </div>
                      </div>
                      {dayEndVariance !== 0 && (
                        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border" style={{ borderColor: `${POS_THEME.amber}40`, background: `${POS_THEME.amber}12`, color: POS_THEME.amber }}>
                          <AlertTriangle size={14} />
                          {dayEndVariance > 0 ? `Shortage ${formatCurrency(dayEndVariance)}` : `Overage ${formatCurrency(Math.abs(dayEndVariance))}`}
                        </div>
                      )}
                      <textarea className="w-full min-h-[72px] px-3 py-2 rounded-xl text-sm border outline-none text-white placeholder:text-white/40 resize-none"
                        style={{ background: POS_THEME.bg, borderColor: POS_THEME.border }}
                        placeholder="Closing notes (optional)" value={dayEndNotes} onChange={e => setDayEndNotes(e.target.value)} />
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-white/60 text-center py-8">Could not load day summary</p>
              )}
            </div>
            <div className="px-5 py-4 border-t shrink-0 space-y-2" style={{ borderColor: POS_THEME.border }}>
              {dayEndData && !dayEndData.isClosed && (
                <div className="flex gap-2">
                  <button type="button" onClick={saveDayEndCashCount} disabled={dayEndSaving || dayEndLoading}
                    className="flex-1 h-11 rounded-xl text-sm font-semibold border text-white disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ borderColor: POS_THEME.border }}>
                    {dayEndSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Save Cash Count
                  </button>
                  {canCloseDay && (
                    <button type="button" onClick={closeBusinessDayFromPos} disabled={dayEndSaving || dayEndLoading}
                      className="flex-1 h-11 rounded-xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: `linear-gradient(135deg, ${POS_THEME.purple}, ${POS_THEME.purpleDark})` }}>
                      {dayEndSaving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                      Close Day
                    </button>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowDayEnd(false)} className="flex-1 h-10 rounded-xl text-sm font-semibold border text-white" style={{ borderColor: POS_THEME.border }}>Close</button>
                <button type="button" onClick={openFullDailyClosing} className="flex-1 h-10 rounded-xl text-sm font-semibold border text-white/90 hover:bg-white/5" style={{ borderColor: POS_THEME.border }}>
                  Full Daily Closing
                </button>
              </div>
              {!canCloseDay && dayEndData && !dayEndData.isClosed && (
                <p className="text-[10px] text-white/45 text-center">Only manager/owner can close the day. Save cash count here or ask your manager.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Opening Cash / Day Start ── */}
      {showOpeningCash && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowOpeningCash(false)}>
          <div data-pos="dark" className="w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: POS_THEME.border }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${POS_THEME.green}22`, border: `1px solid ${POS_THEME.green}44` }}>
                  <Banknote size={15} style={{ color: POS_THEME.green }} />
                </div>
                <h3 className="text-sm font-bold text-white">Opening Cash</h3>
              </div>
              <button type="button" onClick={() => setShowOpeningCash(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/70"><X size={14} /></button>
            </div>
            <div className="p-5 space-y-4">
              {hasDailyClosing && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-white/50 mb-0.5">Cashier</p>
                    <p className="font-semibold text-white truncate">{posUser?.name ?? posUser?.email ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-white/50 mb-0.5">Date</p>
                    <div className="relative">
                      <input
                        type="date"
                        max={businessDateStr}
                        value={openingCashDate}
                        onChange={e => onOpeningCashDateChange(e.target.value)}
                        className="w-full h-9 pl-2 pr-9 rounded-lg text-sm font-semibold border outline-none text-white [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        style={{ background: POS_THEME.bg, borderColor: POS_THEME.border }}
                      />
                      <Calendar
                        size={15}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: POS_THEME.text }}
                      />
                    </div>
                  </div>
                </div>
              )}
              {hasDailyClosing && openingCashDate !== businessDateStr && (
                <p className="text-[11px] font-medium" style={{ color: POS_THEME.amber }}>
                  Setting opening cash for a past business day
                </p>
              )}
              {hasDailyClosing && modalDayStatus && modalDayStatus.suggestedOpeningCash > 0 && (
                <p className="text-xs font-medium" style={{ color: POS_THEME.green }}>
                  Suggested from last close: {formatCurrency(modalDayStatus.suggestedOpeningCash)}
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Opening amount (LKR)</label>
                <input autoFocus type="number" min="0" step="1" placeholder="0" value={openingCashAmount} onChange={e => setOpeningCashAmount(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl text-lg font-bold border outline-none text-white placeholder:text-white/40"
                  style={{ background: POS_THEME.bg, borderColor: POS_THEME.purple }}
                  onKeyDown={e => { if (e.key === 'Enter') submitOpeningCash() }} />
              </div>
              {hasDailyClosing && (
                <div className="flex flex-wrap gap-2">
                  {[5000, 10000, 15000, 20000].map(amt => (
                    <button key={amt} type="button" onClick={() => setOpeningCashAmount(String(amt))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border text-white/90 hover:bg-white/5"
                      style={{ borderColor: POS_THEME.border, background: POS_THEME.bg }}>
                      {amt.toLocaleString()}
                    </button>
                  ))}
                  {(modalDayStatus?.suggestedOpeningCash ?? 0) > 0 && (
                    <button type="button" onClick={() => setOpeningCashAmount(String(Math.round(modalDayStatus!.suggestedOpeningCash)))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                      style={{ borderColor: POS_THEME.green, color: POS_THEME.green, background: `${POS_THEME.green}15` }}>
                      Use last close
                    </button>
                  )}
                </div>
              )}
              <p className="text-[11px] text-white/50 leading-relaxed">
                {hasDailyClosing
                  ? openingCashDate === businessDateStr
                    ? 'Count your drawer float before starting sales. This saves to Daily Closing opening cash.'
                    : 'Save opening cash for the selected past date. Use Daily Closing to close that day if needed.'
                  : 'Enter float amount in drawer at shift start. Saved to Finance.'}
              </p>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowOpeningCash(false)} className="flex-1 h-11 rounded-xl text-sm font-semibold border text-white" style={{ borderColor: POS_THEME.border }}>Cancel</button>
                <button type="button" onClick={submitOpeningCash} disabled={openingCashLoading || (hasDailyClosing && modalDayStatus?.isClosed)}
                  className="flex-1 h-11 rounded-xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${POS_THEME.green}, ${POS_THEME.greenDark})` }}>
                  {openingCashLoading ? <Loader2 size={14} className="animate-spin" /> : <><PlayCircle size={15} /> {hasDailyClosing ? (openingCashDate === businessDateStr ? 'Start Shift' : 'Save Opening Cash') : 'Save & Open Drawer'}</>}
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
                { label: 'Quote (Ctrl+F7)', icon: FileText, onClick: () => { setShowMoreMenu(false); cart.length > 0 ? setShowDocPreview('QUOTE') : toast.error('Cart is empty') } },
                { label: 'Draft invoice (Ctrl+F8)', icon: FilePlus2, onClick: () => { setShowMoreMenu(false); cart.length > 0 ? setShowDocPreview('DRAFT') : toast.error('Cart is empty') } },
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
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div data-pos="dark" className="w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border max-h-[88dvh] flex flex-col" style={{ background: POS_THEME.card, borderColor: POS_THEME.border }}>
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b flex-shrink-0 gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <Archive size={15} className="text-amber-400 shrink-0" />
                <h3 className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>Held Carts ({heldCarts.length})</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {cart.length > 0 && (
                  <button onClick={holdCart} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20 transition-colors">
                    <Archive size={12} /><span className="hidden sm:inline">Hold Current</span><span className="sm:hidden">Hold</span>
                  </button>
                )}
                <button onClick={() => setShowHeldCarts(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1" style={{ maxHeight: 360 }}>
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
        const color  = showDocPreview === 'QUOTE' ? '#2563eb' : 'var(--brand-primary)'
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
          <div className="w-full sm:w-[min(480px,100vw)] flex flex-col shadow-2xl max-h-dvh" style={{ background: POS_THEME.card, borderLeft: `1px solid ${POS_THEME.border}` }}>
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Receipt size={15} className="text-violet-400" />
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Recent Invoices</h3>
              </div>
              <button onClick={() => setShowRecentInvoices(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
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

  // Escape is handled inside POSContent (modal stack → checkout → confirm close).
  // Do not attach a second Esc listener here — it raced and closed POS mid-checkout.

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
        className="pos-shell fixed inset-0 z-[100] flex flex-col overflow-hidden h-dvh max-h-dvh supports-[height:100dvh]:h-dvh"
        style={{ background: '#0B0E14' }}
        role="dialog"
        aria-modal="true"
        aria-label="Point of Sale"
      >
        <POSContent onClose={closePos} />
      </motion.div>
    </AnimatePresence>
  )
}
