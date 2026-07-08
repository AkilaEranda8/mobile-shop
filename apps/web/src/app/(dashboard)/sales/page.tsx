'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Receipt, Eye, X, Calendar, User, Package,
  CreditCard, Loader2, Hash, ShoppingBag,
  Banknote, Smartphone, TrendingUp, Download, Truck, RotateCcw,
} from 'lucide-react'
import { TableDensityToggle, type TableDensity } from '@/components/ui/TableDensityToggle'
import { type ColumnDef } from '@tanstack/react-table'
import { ClientSideTable } from '@/components/table/client-side-table'
import { DataTableColumnHeader } from '@/components/table/data-table-column-header'
import { TableActionsRow } from '@/components/table/table-actions-row'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { salesApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { getActiveBranchId } from '@/lib/active-branch'
import { formatDate, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { getInvoiceSettings, fetchInvoiceSettings, resolveInvoiceTemplate, type InvoiceSettings } from '@/lib/invoiceSettings'
import InvoiceA4View from '@/components/invoice/InvoiceA4View'
import { OpenPosButton } from '@/components/pos/OpenPosButton'

const statusColors: Record<string, string> = {
  PAID:           'bg-green-500/10  border-green-500/20  text-green-400',
  PARTIAL:        'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  UNPAID:         'bg-red-500/10    border-red-500/20    text-red-400',
  REFUNDED:       'bg-slate-500/10  border-slate-500/20  text-slate-400',
  RETURNED:       'bg-rose-500/10   border-rose-500/20   text-rose-400',
  DUE:            'bg-orange-500/10 border-orange-500/20 text-orange-400',
}


const methodIcon: Record<string, React.ReactNode> = {
  CASH:   <Banknote   size={11} />,
  CARD:   <CreditCard size={11} />,
  UPI:    <Smartphone size={11} />,
}

/* ── Printable Invoice Template ─────────────────────────────────────────── */
const INV_NAVY   = '#0d1b2e'
const INV_ORANGE = '#f59e0b'
const INV_DARK2  = '#162436'

function InvLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', background: INV_ORANGE, padding: '4px 12px 4px 10px', marginBottom: 10, clipPath: 'polygon(0 0,100% 0,calc(100% - 8px) 100%,0 100%)' }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</span>
    </div>
  )
}

function InvoiceTemplate({ sale, shopName, settings }: { sale: any; shopName: string; settings: InvoiceSettings }) {
  const fc = (n: number) => formatCurrency(n)
  const dateStr = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  const payMethod = sale.payments?.map((p: any) => p.method).join(' + ') || '—'
  const displayName = settings.shopName || shopName

  return (
    <div style={{ width: 794, background: '#fff', fontFamily: "'Segoe UI',Arial,sans-serif", color: '#1e293b' }}>

      {/* HEADER */}
      <div style={{ background: INV_NAVY, position: 'relative', overflow: 'hidden', padding: '30px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 110 }}>
        <div style={{ position: 'absolute', left: -18, top: 0, width: 90, height: '130%', background: INV_ORANGE, transform: 'skewX(-12deg)', opacity: 0.85 }} />
        <div style={{ position: 'absolute', left: 58, top: 0, width: 30, height: '130%', background: '#c97d06', transform: 'skewX(-12deg)', opacity: 0.7 }} />
        <div style={{ position: 'relative', zIndex: 2, paddingLeft: 60 }}>
          <p style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: 1 }}>{displayName.toUpperCase()}</p>
          <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: 11, letterSpacing: 2 }}>{settings.slogan || 'SALES INVOICE'}</p>
        </div>
        <div style={{ textAlign: 'right', zIndex: 2 }}>
          <p style={{ margin: 0, color: INV_ORANGE, fontSize: 28, fontWeight: 900, letterSpacing: 2 }}>INVOICE</p>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 11 }}>ID NO : {sale.invoiceNumber}</p>
          <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: 10 }}>{dateStr}</p>
        </div>
      </div>

      {/* BILL TO / BILL FROM */}
      <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '3px solid #e2e8f0', padding: '18px 36px', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <InvLabel>Invoice To :</InvLabel>
          <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700, color: INV_NAVY }}>{sale.customerName || 'Walk-in Customer'}</p>
          {sale.customerPhone && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Phone : {sale.customerPhone}</p>}
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Date : {dateStr}</p>
        </div>
        <div style={{ flex: 1 }}>
          <InvLabel>Invoice From :</InvLabel>
          <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700, color: INV_NAVY }}>{displayName}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{sale.cashierName}</p>
          {settings.phone   && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Phone : {settings.phone}</p>}
          {settings.email   && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>Email : {settings.email}</p>}
          {settings.address && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{settings.address}</p>}
        </div>
      </div>

      {/* ITEMS TABLE */}
      <div style={{ padding: '20px 36px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ background: INV_ORANGE, padding: '9px 12px', color: '#fff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', clipPath: 'polygon(0 0,100% 0,calc(100% - 6px) 100%,0 100%)' }}>Description</th>
              <th style={{ background: INV_DARK2, padding: '9px 12px', color: '#fff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Price</th>
              <th style={{ background: INV_DARK2, padding: '9px 12px', color: '#fff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Qty</th>
              <th style={{ background: INV_ORANGE, padding: '9px 12px', color: '#fff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right', clipPath: 'polygon(6px 0,100% 0,100% 100%,0 100%)' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items?.map((item: any, idx: number) => (
              <tr key={item.id ?? idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#1e293b', fontWeight: 500 }}>
                  {item.productName}
                  {item.sku && <span style={{ display: 'block', fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', marginTop: 1 }}>{item.sku}{item.imei ? ' · IMEI: ' + item.imei : ''}</span>}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#475569', textAlign: 'right' }}>{fc(item.unitPrice)}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#475569', textAlign: 'right' }}>{item.quantity}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: INV_NAVY, textAlign: 'right' }}>{fc(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FOOTER: payment | contact | totals */}
      <div style={{ display: 'flex', gap: 16, padding: '20px 36px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, background: INV_NAVY, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: INV_ORANGE, padding: '5px 12px', clipPath: 'polygon(0 0,100% 0,calc(100% - 8px) 100%,0 100%)' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment Method :</span>
          </div>
          <div style={{ padding: '10px 12px' }}>
            {sale.payments?.map((p: any, i: number) => (
              <p key={i} style={{ margin: '0 0 4px', fontSize: 11, color: '#94a3b8' }}><span style={{ color: '#cbd5e1', fontWeight: 600 }}>{p.method}</span> : {fc(p.amount)}{p.reference ? ` (${p.reference})` : ''}</p>
            ))}
            <p style={{ margin: '6px 0 0', fontSize: 10, color: '#64748b' }}>Status : <span style={{ color: '#4ade80', fontWeight: 700 }}>{sale.status || 'PAID'}</span></p>
          </div>
        </div>
        <div style={{ flex: 1, background: INV_NAVY, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: INV_ORANGE, padding: '5px 12px', clipPath: 'polygon(0 0,100% 0,calc(100% - 8px) 100%,0 100%)' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Contact Info :</span>
          </div>
          <div style={{ padding: '10px 12px' }}>
            {settings.phone   && <p style={{ margin: '0 0 3px', fontSize: 11, color: '#94a3b8' }}>Phone : <span style={{ color: '#cbd5e1' }}>{settings.phone}</span></p>}
            {settings.email   && <p style={{ margin: '0 0 3px', fontSize: 11, color: '#94a3b8' }}>Email : <span style={{ color: '#cbd5e1' }}>{settings.email}</span></p>}
            {settings.website && <p style={{ margin: '0 0 3px', fontSize: 11, color: '#94a3b8' }}>Web : <span style={{ color: '#cbd5e1' }}>{settings.website}</span></p>}
            {sale.customerPhone && <p style={{ margin: '0', fontSize: 11, color: '#94a3b8' }}>Customer : <span style={{ color: '#cbd5e1' }}>{sale.customerPhone}</span></p>}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {[
            { label: 'Subtotal :', value: fc(sale.subtotal) },
            { label: 'Discount :', value: sale.discount ? fc(sale.discount) : fc(0) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontWeight: 600 }}>{label}</span><span>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, background: INV_ORANGE, padding: '8px 12px', borderRadius: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: 1 }}>TOTAL</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{fc(sale.total)}</span>
          </div>
          {sale.dueAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, background: '#fef3c7', padding: '5px 10px', borderRadius: 4, fontSize: 11, color: '#92400e', fontWeight: 700 }}>
              <span>Due</span><span>{fc(sale.dueAmount)}</span>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 36px 20px' }}>
        <div>
          {sale.notes && <p style={{ margin: '0 0 4px', fontSize: 11, color: '#475569', fontStyle: 'italic' }}>{sale.notes}</p>}
          <p style={{ margin: '0 0 3px', fontSize: 12, color: '#475569', fontStyle: 'italic' }}>{settings.footerNote || 'Thanks for your business!'}</p>
          <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>Computer-generated invoice · {displayName}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '2px solid ' + INV_NAVY, paddingTop: 4, width: 140 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: INV_NAVY }}>{sale.cashierName}</p>
            <p style={{ margin: 0, fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Authorised Signature</p>
          </div>
        </div>
      </div>
      <div style={{ height: 8, background: `linear-gradient(90deg, ${INV_NAVY} 60%, ${INV_ORANGE} 100%)` }} />
    </div>
  )
}

/* ── Sale Details Modal ──────────────────────────────────────────────────── */
function SaleDetailsModal({ sale, onClose }: { sale: any; onClose: () => void }) {
  const invoiceRef  = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const shopName = authStorage.getUser()?.name?.split(' ')[0] + ' Shop' || 'Our Shop'
  const [invSettings, setInvSettings] = useState<InvoiceSettings>(() => getInvoiceSettings())
  const [tenantSlug, setTenantSlug] = useState<string | undefined>()
  const activeTemplate = resolveInvoiceTemplate(invSettings, tenantSlug)

  useEffect(() => {
    const user = authStorage.getUser()
    if (!user?.tenantId) return
    fetchInvoiceSettings(user.tenantId, getActiveBranchId()).then(setInvSettings).catch(() => {})
    import('@/lib/api').then(({ tenantApi }) => {
      tenantApi.get(user.tenantId).then((res: any) => {
        const tenant = res?.data ?? res
        setTenantSlug(tenant?.slug)
      }).catch(() => {})
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const downloadInvoice = async () => {
    if (!invoiceRef.current) return
    setDownloading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { jsPDF }               = await import('jspdf')
      const A4_W_PX = 794, A4_W_MM = 210, A4_H_MM = 297
      const wrapper = document.createElement('div')
      wrapper.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${A4_W_PX}px;overflow:visible;`
      const el = invoiceRef.current!
      const clone = el.cloneNode(true) as HTMLElement
      clone.style.cssText = `width:${A4_W_PX}px;max-width:${A4_W_PX}px;border-radius:0;`
      wrapper.appendChild(clone)
      document.body.appendChild(wrapper)
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, width: A4_W_PX, windowWidth: A4_W_PX })
      document.body.removeChild(wrapper)
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
      pdf.save(`Invoice_${sale.invoiceNumber}.pdf`)
      toast.success('Invoice downloaded')
    } catch { toast.error('Download failed') }
    finally { setDownloading(false) }
  }

  const printInvoice = () => {
    if (!invoiceRef.current) return
    const printContents = invoiceRef.current.innerHTML
    const w = window.open('', '_blank', 'width=900,height=1200')
    if (!w) return
    w.document.write(`
      <html><head><title>Invoice ${sale.invoiceNumber}</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@3/dist/tailwind.min.css" rel="stylesheet">
      <style>
        body { margin: 0; background: white; font-family: 'Segoe UI', sans-serif; }
        @page { size: A4; margin: 15mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
      </head><body>${printContents}</body></html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  const paymentStatus = sale?.dueAmount > 0 ? 'Partial' : 'Paid'
  const paymentStatusClass = sale?.dueAmount > 0
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200'

  const safeText = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white text-slate-900 border border-slate-200 rounded-xl w-full max-w-6xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-start gap-2">
            <Receipt size={16} className="text-emerald-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">
                Sell Details ( Invoice No : <span className="font-mono">{safeText(sale.invoiceNumber)}</span> )
              </p>
              <p className="text-[11px] text-slate-500">
                {safeText(sale.customerName || 'Walk-in Customer')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${paymentStatusClass}`}>
              {paymentStatus}
            </span>
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${statusColors[sale.status] ?? 'bg-slate-50 border-slate-200 text-slate-600'}`}>
              {safeText(sale.status)}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Top meta row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-400" />
                <span className="text-slate-500">Date:</span>
                <span className="font-medium">{safeText(formatDate(sale.createdAt))}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Hash size={13} className="text-slate-400" />
                <span className="text-slate-500">Invoice No:</span>
                <span className="font-mono">{safeText(sale.invoiceNumber)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Receipt size={13} className="text-slate-400" />
                <span className="text-slate-500">Status:</span>
                <span className="font-medium">{safeText(sale.status)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CreditCard size={13} className="text-slate-400" />
                <span className="text-slate-500">Payment status:</span>
                <span className="font-medium">{paymentStatus}</span>
              </div>
            </div>

            <div className="space-y-1 text-[12px]">
              <div className="flex items-center gap-1.5">
                <User size={13} className="text-slate-400" />
                <span className="text-slate-500">Customer name:</span>
                <span className="font-medium">{safeText(sale.customerName || 'Walk-in Customer')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package size={13} className="text-slate-400" />
                <span className="text-slate-500">Address:</span>
                <span className="font-medium">{safeText(sale.customerAddress)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User size={13} className="text-slate-400" />
                <span className="text-slate-500">Service staff:</span>
                <span className="font-medium">{safeText(sale.cashierName)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck size={13} className="text-slate-400" />
                <span className="text-slate-500">Shipping:</span>
                <span className="font-medium">{safeText(sale.shippingMethod || sale.source === 'DELIVERY' ? 'Delivery' : '')}</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px]">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                <span className="text-slate-600 font-semibold">Quick totals</span>
                <span className="text-slate-500 text-[11px]">{safeText(sale.currency || 'LKR')}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium">{formatCurrency(sale.subtotal ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="font-medium">{formatCurrency(sale.discount ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Order Tax</span><span className="font-medium">{formatCurrency(sale.tax ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span className="font-medium">{formatCurrency(sale.shippingFee ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Round Off</span><span className="font-medium">{formatCurrency(sale.roundOff ?? 0)}</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-semibold">Total Payable</span><span className="font-semibold">{formatCurrency(sale.total ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total paid</span><span className="font-medium">{formatCurrency(sale.paidAmount ?? (sale.total ?? 0) - (sale.dueAmount ?? 0))}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total remaining</span><span className="font-medium">{formatCurrency(sale.dueAmount ?? 0)}</span></div>
              </div>
            </div>
          </div>

          {/* Products + Payments + Totals layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left column: products + payment table + notes */}
            <div className="lg:col-span-2 space-y-4">
              {/* Products */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Products
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[860px] w-full text-[12px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-slate-600">
                        <th className="px-3 py-2 text-left w-10">#</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Lot &amp; Expiry</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                        <th className="px-3 py-2 text-right">Unit Price</th>
                        <th className="px-3 py-2 text-right">Discount</th>
                        <th className="px-3 py-2 text-right">Tax</th>
                        <th className="px-3 py-2 text-right">Price inc. tax</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sale.items ?? []).map((item: any, idx: number) => {
                        const qty = Number(item.quantity ?? 0)
                        const unit = Number(item.unitPrice ?? 0)
                        const subtotal = Number(item.total ?? qty * unit)
                        const itemDiscount = Number(item.discount ?? 0)
                        const itemTax = Number(item.tax ?? 0)
                        const priceIncTax = qty > 0 ? (subtotal + itemTax) / qty : (unit + (itemTax || 0))
                        return (
                          <tr key={item.id ?? idx} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{safeText(item.productName)}</div>
                              {(item.sku || item.imei) && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {safeText(item.sku)}{item.imei ? ` · ${item.imei}` : ''}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-500">{safeText(item.lotExpiry || item.lot || item.expiry)}</td>
                            <td className="px-3 py-2 text-right">{safeText(qty ? qty.toFixed(2) + ' Qty' : '')}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(unit)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{itemDiscount ? formatCurrency(itemDiscount) : '0.00'}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{itemTax ? formatCurrency(itemTax) : '0.00'}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(priceIncTax)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{formatCurrency(subtotal)}</td>
                          </tr>
                        )
                      })}
                      {(!sale.items || sale.items.length === 0) && (
                        <tr>
                          <td colSpan={9} className="px-3 py-6 text-center text-slate-500">No items</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment info */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Payment info
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-[12px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-slate-600">
                        <th className="px-3 py-2 text-left w-10">#</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Reference No</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-left">Payment mode</th>
                        <th className="px-3 py-2 text-left">Payment note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sale.payments ?? []).map((p: any, idx: number) => (
                        <tr key={p.id ?? idx} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                          <td className="px-3 py-2">{safeText(p.date ? formatDate(p.date) : formatDate(sale.createdAt))}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{safeText(p.reference)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{formatCurrency(p.amount ?? 0)}</td>
                          <td className="px-3 py-2">{safeText(p.method)}</td>
                          <td className="px-3 py-2 text-slate-500">{safeText(p.note)}</td>
                        </tr>
                      ))}
                      {(!sale.payments || sale.payments.length === 0) && (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-slate-500">No payments</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[11px] font-semibold text-slate-600 mb-1">Sell note:</p>
                  <p className="text-[12px] text-slate-700">{safeText(sale.notes)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[11px] font-semibold text-slate-600 mb-1">Staff note:</p>
                  <p className="text-[12px] text-slate-700">{safeText(sale.staffNote)}</p>
                </div>
              </div>
            </div>

            {/* Right column: totals (detailed) */}
            <div className="rounded-lg border border-slate-200 overflow-hidden h-fit">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-slate-700">Total</p>
                <p className="text-[12px] font-semibold text-slate-700">{formatCurrency(sale.total ?? 0)}</p>
              </div>
              <div className="p-3 text-[12px] space-y-2">
                {[
                  { label: 'Discount', value: sale.discount ?? 0 },
                  { label: 'Service Charge', value: sale.serviceCharge ?? 0 },
                  { label: 'Order Tax', value: sale.tax ?? 0 },
                  { label: 'Shipping', value: sale.shippingFee ?? 0 },
                  { label: 'Round Off', value: sale.roundOff ?? 0 },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-slate-500">{r.label}:</span>
                    <span className="font-medium">{formatCurrency(Number(r.value ?? 0))}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total Payable:</span>
                    <span className="font-semibold">{formatCurrency(sale.total ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Total paid:</span>
                    <span className="font-medium">{formatCurrency(sale.paidAmount ?? (sale.total ?? 0) - (sale.dueAmount ?? 0))}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Total remaining:</span>
                    <span className="font-medium">{formatCurrency(sale.dueAmount ?? 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={printInvoice}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold"
            >
              <Eye size={14} />
              Print Invoice
            </button>
            <button
              type="button"
              onClick={downloadInvoice}
              disabled={downloading}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold disabled:opacity-60"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? 'Generating…' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[12px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold"
            >
              Close
            </button>
          </div>

          {/* Hidden invoice for PDF capture / print */}
          <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
            <InvoiceA4View
              ref={invoiceRef}
              sale={sale}
              settings={invSettings}
              tenantSlug={tenantSlug}
              shopName={shopName}
              template={activeTemplate}
              hideControls
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main Sales Page ─────────────────────────────────────────────────────── */
export default function SalesPage() {
  const searchParams = useSearchParams()
  const [sales, setSales]           = useState<any[]>([])
  const [meta, setMeta]             = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [detailSale,  setDetailSale]  = useState<any>(null)
  const [density, setDensity]       = useState<TableDensity>('comfortable')
  const [textSearch, setTextSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'PARTIAL' | 'UNPAID' | 'RETURNED' | 'REFUNDED'>('all')

  const openDetail = useCallback((sale: any) => setDetailSale(sale), [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setTextSearch(q)
    const id = searchParams.get('id')
    if (!id || !sales.length) return
    const found = sales.find(s => s.id === id)
    if (found) setDetailSale(found)
  }, [searchParams, sales])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await salesApi.list({ limit: '500' })
      setSales(res?.data ?? [])
      setMeta(res?.meta ?? null)
    } catch { toast.error('Failed to load sales') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onSale = () => { load() }
    window.addEventListener('pos:sale-complete', onSale)
    return () => window.removeEventListener('pos:sale-complete', onSale)
  }, [load])

  const totalRevenue  = sales.reduce((s, r) => s + (r.total ?? 0), 0)
  const paidCount     = sales.filter(r => r.status === 'PAID').length
  const partialCount  = sales.filter(r => r.status === 'PARTIAL').length
  const returnedCount = sales.filter(r => r.status === 'RETURNED' || (r._count?.returns ?? 0) > 0).length

  const filteredSales = useMemo(() => {
    let rows = sales
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter)
    const q = textSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.invoiceNumber?.toLowerCase().includes(q) ||
      (r.customerName ?? '').toLowerCase().includes(q) ||
      (r.customerPhone ?? '').toLowerCase().includes(q)
    )
  }, [sales, statusFilter, textSearch])

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'invoiceNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
      cell: ({ row }) => {
        const s = row.original
        const returnCount = s._count?.returns ?? 0
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              className="font-mono text-xs text-violet-400 hover:text-violet-300 hover:underline"
              onClick={() => openDetail(s)}
            >
              {s.invoiceNumber}
            </button>
            {s.source === 'DELIVERY' && (
              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}>
                <Truck size={9} /> Delivery
              </span>
            )}
            {s.source === 'CREDIT_COLLECTION' && (
              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                <CreditCard size={9} /> Credit Pay
              </span>
            )}
            {returnCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.25)' }}>
                <RotateCcw size={8} /> {returnCount} return{returnCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => <span className="text-xs text-slate-300 whitespace-nowrap">{formatDate(row.original.createdAt)}</span>,
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div>
          <p className="text-xs font-semibold text-slate-200">{row.original.customerName || 'Walk-in'}</p>
          {row.original.customerPhone && <p className="text-[10px] text-slate-500">{row.original.customerPhone}</p>}
        </div>
      ),
    },
    {
      accessorKey: 'total',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
      cell: ({ row }) => {
        const s = row.original
        const totalRefunded = (s.returns ?? []).reduce((sum: number, r: any) => sum + (r.refundAmount ?? 0), 0)
        return (
          <div>
            <p className="text-xs font-bold text-white whitespace-nowrap">{formatCurrency(s.total)}</p>
            {totalRefunded > 0 && <p className="text-[10px] text-rose-400 whitespace-nowrap">Refunded: {formatCurrency(totalRefunded)}</p>}
            {s.dueAmount > 0 && <p className="text-[10px] text-yellow-400 whitespace-nowrap">Due: {formatCurrency(s.dueAmount)}</p>}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusColors[row.original.status] ?? ''}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const s = row.original
        return (
          <div className="flex items-center gap-2">
            <TableActionsRow showAction={{ action: () => openDetail(s) }} />
          </div>
        )
      },
    },
  ], [openDetail])

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="page-title">Sales</h1>
          <p className="page-subtitle">View and manage all sales transactions</p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <OpenPosButton label="New Sale" />
          <TableDensityToggle value={density} onChange={setDensity} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Sales', value: String(meta?.total ?? '—'), icon: ShoppingBag, color: 'violet', filter: 'all' as const },
          { label: 'Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'green', filter: 'all' as const },
          { label: 'Paid', value: String(paidCount), icon: Receipt, color: 'green', filter: 'PAID' as const },
          { label: 'Returned', value: String(returnedCount), icon: RotateCcw, color: 'rose', filter: 'RETURNED' as const },
        ].map(({ label, value, icon: Icon, color, filter }) => (
          <button
            key={label}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`card p-4 flex items-center gap-3 text-left w-full transition-all hover:border-violet-500/30 ${statusFilter === filter ? 'ring-2 ring-violet-500/40' : ''}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
              <Icon size={15} className={`text-${color}-400`} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-[11px] text-slate-500">{label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToolbarSearch
          value={textSearch}
          onChange={setTextSearch}
          placeholder="Search invoice, customer, phone…"
          className="w-full sm:w-auto sm:min-w-[220px]"
        />
        <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-subtle)' }}>
          {([
            { id: 'all', label: 'All' },
            { id: 'PAID', label: 'Paid' },
            { id: 'PARTIAL', label: 'Partial' },
            { id: 'UNPAID', label: 'Unpaid' },
            { id: 'RETURNED', label: 'Returned' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className="px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors"
              style={statusFilter === opt.id
                ? { background: '#6d28d9', color: '#fff' }
                : { color: 'var(--text-muted)' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={`table-${density}`}>
        <ClientSideTable
          data={filteredSales}
          columns={columns}
          isLoading={loading}
          pageCount={Math.ceil((filteredSales.length || 1) / 20)}
          searchableColumns={[]}
          showFilter={false}
        />
      </div>

      {detailSale && <SaleDetailsModal sale={detailSale} onClose={() => setDetailSale(null)} />}
    </div>
  )
}
