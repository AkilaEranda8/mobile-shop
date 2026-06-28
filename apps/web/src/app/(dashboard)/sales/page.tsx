'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
import { salesApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { getActiveBranchId } from '@/lib/active-branch'
import { formatDate, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { getInvoiceSettings, fetchInvoiceSettings, isKasthuriInvoice, type InvoiceSettings } from '@/lib/invoiceSettings'
import KasthuriInvoicePrint, { buildKasthuriInvoiceData } from '@/components/invoice/KasthuriInvoicePrint'
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
  const useKasthuri = isKasthuriInvoice(invSettings, tenantSlug)
  const kasthuriData = useKasthuri ? buildKasthuriInvoiceData(sale, invSettings) : null

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623] z-10">
          <div className="flex items-center gap-2">
            <Receipt size={15} className="text-violet-400" />
            <div>
              <p className="text-xs font-mono text-violet-400">{sale.invoiceNumber}</p>
              <p className="text-sm font-bold text-white">{sale.customerName || 'Walk-in Customer'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${statusColors[sale.status] ?? ''}`}>
              {sale.status}
            </span>
            <button onClick={downloadInvoice} disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 transition-colors disabled:opacity-50 font-semibold">
              {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
              {downloading ? 'Generating…' : 'Download PDF'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Date',     value: formatDate(sale.createdAt),     icon: Calendar },
              { label: 'Cashier',  value: sale.cashierName,               icon: User     },
              { label: 'Invoice',  value: sale.invoiceNumber,             icon: Hash     },
              { label: 'Customer', value: sale.customerName || 'Walk-in', icon: User     },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white/3 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={10} className="text-slate-500" />
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                </div>
                <p className="text-xs font-semibold text-slate-200 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Items */}
          <div className="bg-white/3 rounded-xl border border-white/5 overflow-hidden">
            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Items ({sale.items?.length ?? 0})</p>
            </div>
            {sale.items?.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2.5 border-b border-white/3 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{item.productName}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{item.sku}{item.imei ? ` · ${item.imei}` : ''}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs font-bold text-white">{formatCurrency(item.total)}</p>
                  <p className="text-[10px] text-slate-500">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="bg-white/3 rounded-xl border border-white/5 p-3 space-y-1.5">
            {[
              { label: 'Subtotal', value: formatCurrency(sale.subtotal) },
              { label: 'Discount', value: `- ${formatCurrency(sale.discount)}`, hide: !sale.discount },
              { label: 'Tax',      value: `+ ${formatCurrency(sale.tax)}`,      hide: !sale.tax      },
            ].filter(r => !r.hide).map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs text-slate-400">
                <span>{label}</span><span>{value}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-white/5">
              <span>Total</span><span>{formatCurrency(sale.total)}</span>
            </div>
            {sale.dueAmount > 0 && (
              <div className="flex justify-between text-xs text-yellow-400">
                <span>Due</span><span>{formatCurrency(sale.dueAmount)}</span>
              </div>
            )}
          </div>

          {/* Payments */}
          {sale.payments?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Payments</p>
              {sale.payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-white/3 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-slate-300">
                    {methodIcon[p.method] ?? <CreditCard size={11} />}
                    <span className="text-xs">{p.method}</span>
                    {p.reference && <span className="text-[10px] text-slate-500 font-mono">{p.reference}</span>}
                  </div>
                  <span className="text-xs font-semibold text-white">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {sale.notes && (
            <div className="p-3 bg-white/3 rounded-xl border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-xs text-slate-300">{sale.notes}</p>
            </div>
          )}

          {/* Hidden invoice for PDF capture */}
          <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
            {useKasthuri && kasthuriData
              ? <KasthuriInvoicePrint ref={invoiceRef} data={kasthuriData} settings={invSettings} hideControls />
              : (
                <div ref={invoiceRef}>
                  <InvoiceTemplate sale={sale} shopName={shopName} settings={invSettings} />
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main Sales Page ─────────────────────────────────────────────────────── */
export default function SalesPage() {
  const [sales, setSales]           = useState<any[]>([])
  const [meta, setMeta]             = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [detailSale,  setDetailSale]  = useState<any>(null)
  const [density, setDensity]       = useState<TableDensity>('comfortable')

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

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'invoiceNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
      cell: ({ row }) => {
        const s = row.original
        const returnCount = s._count?.returns ?? 0
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs text-violet-400">{s.invoiceNumber}</span>
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
            <TableActionsRow showAction={{ action: () => setDetailSale(s) }} />
          </div>
        )
      },
    },
  ], [setDetailSale])

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
          { label: 'Total Sales',   value: String(meta?.total ?? '—'), icon: ShoppingBag, color: 'violet' },
          { label: 'Revenue',       value: formatCurrency(totalRevenue), icon: TrendingUp,  color: 'green'  },
          { label: 'Paid',          value: String(paidCount),            icon: Receipt,     color: 'green'  },
          { label: 'Returned',      value: String(returnedCount),        icon: RotateCcw,   color: 'rose'   },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-500/10 border border-${color}-500/20`}>
              <Icon size={15} className={`text-${color}-400`} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-[11px] text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className={`table-${density}`}>
        <ClientSideTable
          data={sales}
          columns={columns}
          isLoading={loading}
          pageCount={Math.ceil((sales.length || 1) / 20)}
          searchableColumns={[
            { id: 'invoiceNumber', title: 'Invoice' },
            { id: 'customerName',  title: 'Customer' },
          ]}
          filterableColumns={[{
            id: 'status',
            title: 'Status',
            options: [
              { label: 'Paid',     value: 'PAID'     },
              { label: 'Partial',  value: 'PARTIAL'  },
              { label: 'Unpaid',   value: 'UNPAID'   },
              { label: 'Returned', value: 'RETURNED' },
              { label: 'Refunded', value: 'REFUNDED' },
            ],
          }]}
        />
      </div>

      {detailSale && <SaleDetailsModal sale={detailSale} onClose={() => setDetailSale(null)} />}
    </div>
  )
}
