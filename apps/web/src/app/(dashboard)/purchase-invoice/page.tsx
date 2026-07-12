'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Download, Printer, Mail, Share2, CheckCircle2, Clock, FileText,
  Phone, Globe, MapPin, Package, Building2, User, Truck, CreditCard,
  BarChart2, QrCode, ChevronRight, Zap, ArrowLeft, Loader2,
} from 'lucide-react'
import { suppliersApi, imeiApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { getInvoiceSettings } from '@/lib/invoiceSettings'
import { authStorage } from '@/lib/auth'
import { BarcodeLabelPreview } from '@/components/inventory/BarcodeLabelPreview'

/* ─── Static fallback company info ─────────────────────────────────── */
const COMPANY_DEFAULTS = {
  name:    'Our Shop',
  tagline: '',
  address: '',
  phone:   '',
  email:   '',
  website: '',
  vat:     '',
}

/* ─── Helpers ───────────────────────────────────────────────────────── */
const fmt = (n: number) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(n)

function itemTotal(it: { quantity: number; unitCost: number; total: number }) {
  return it.total ?? it.quantity * it.unitCost
}

/* ─── Mini QR SVG ───────────────────────────────────────────────────── */
function QRCodeSVG() {
  const pattern = [
    [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,1,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
    [1,0,1,1,0,1,1,1,0,0,1,1,0,1,0,1,0],
    [0,1,0,0,1,0,0,0,1,1,0,0,1,0,1,0,1],
    [1,1,1,1,1,1,1,0,0,1,1,0,1,1,0,1,1],
    [0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0],
    [1,1,1,1,1,1,1,0,0,1,1,1,0,0,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,0,0,1,1,0,1,0],
    [1,0,1,1,1,0,1,0,0,1,0,1,0,0,1,1,1],
    [1,0,0,0,0,0,1,0,1,0,1,0,0,1,0,0,1],
    [1,1,1,1,1,1,1,0,0,1,0,1,1,0,1,1,0],
  ]
  return (
    <svg width="80" height="80" viewBox="0 0 17 17" className="rounded-lg">
      {pattern.map((row, y) =>
        row.map((cell, x) =>
          cell ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#f97316" /> : null
        )
      )}
    </svg>
  )
}

/* ─── Status badge ──────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; dot: string; label: string }> = {
    PAID:    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Paid' },
    PENDING: { cls: 'bg-amber-50 text-amber-700 border-amber-200',         dot: 'bg-amber-500',   label: 'Pending' },
    DRAFT:   { cls: 'bg-gray-100 text-gray-500 border-gray-200',            dot: 'bg-gray-400',    label: 'Draft' },
  }
  const s = map[status] ?? map.DRAFT
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
      {s.label}
    </span>
  )
}

/* ─── Action buttons ────────────────────────────────────────────────── */
function ActionBar({ onDownload, onPrint, onWhatsApp, onEmail, downloading }: { onDownload: () => void; onPrint: () => void; onWhatsApp: () => void; onEmail: () => void; downloading: boolean }) {
  return (
    <div className="flex flex-wrap gap-3 justify-end mb-6 print:hidden">
      <button
        onClick={onDownload}
        disabled={downloading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/20 disabled:opacity-60 disabled:cursor-wait"
      >
        {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        {downloading ? 'Generating…' : 'Download PDF'}
      </button>
      <button onClick={onPrint} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-all">
        <Printer size={15} />Print
      </button>
      <button onClick={onWhatsApp} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all">
        <Share2 size={15} />WhatsApp
      </button>
      <button onClick={onEmail} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-all">
        <Mail size={15} />Send Email
      </button>
    </div>
  )
}

/* ─── Inner content (needs Suspense for useSearchParams) ────────────── */
function InvoiceContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const poId         = searchParams.get('id')

  const invSettings = getInvoiceSettings()
  const currentUser = authStorage.getUser()
  const COMPANY = {
    name:    invSettings.shopName    || COMPANY_DEFAULTS.name,
    tagline: invSettings.slogan      || COMPANY_DEFAULTS.tagline,
    address: invSettings.address     || COMPANY_DEFAULTS.address,
    phone:   invSettings.phone       || COMPANY_DEFAULTS.phone,
    email:   invSettings.email       || COMPANY_DEFAULTS.email,
    website: invSettings.website     || COMPANY_DEFAULTS.website,
    vat:     '',
  }

  const [po, setPo]           = useState<any>(null)
  const [poImeis, setPoImeis] = useState<{ imei: string; variation?: string; product?: { name?: string } }[]>([])
  const [loading, setLoading] = useState(!!poId)
  const [error, setError]     = useState('')
  const [downloading, setDownloading] = useState(false)
  const invoiceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!poId) return
    setLoading(true)
    suppliersApi.purchaseOrders({ id: poId })
      .then((res: any) => {
        const list  = res?.data ?? []
        const found = list.find((p: any) => p.id === poId) ?? list[0] ?? null
        if (!found) setError('Purchase order not found')
        else {
          setPo(found)
          imeiApi.list({ purchaseOrderId: found.id, limit: '500' })
            .then((ir: any) => setPoImeis(ir.data ?? []))
            .catch(() => setPoImeis([]))
        }
      })
      .catch(() => setError('Failed to load purchase order'))
      .finally(() => setLoading(false))
  }, [poId])

  const handleDownload = async () => {
    const el = invoiceRef.current
    if (!el) return
    setDownloading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { jsPDF }               = await import('jspdf')

      /* ── A4 dimensions ── */
      const A4_W_PX = 794   // A4 at 96 dpi
      const A4_W_MM = 210
      const A4_H_MM = 297

      /* Clone into an offscreen container at exactly A4 width */
      const wrapper = document.createElement('div')
      wrapper.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${A4_W_PX}px;overflow:visible;`
      const clone = el.cloneNode(true) as HTMLElement
      clone.style.cssText = `width:${A4_W_PX}px;max-width:${A4_W_PX}px;border-radius:0;`
      wrapper.appendChild(clone)
      document.body.appendChild(wrapper)

      const canvas = await html2canvas(clone, {
        scale:           2,
        useCORS:         true,
        backgroundColor: '#0b1425',
        logging:         false,
        width:           A4_W_PX,
        windowWidth:     A4_W_PX,
      })

      document.body.removeChild(wrapper)

      const pdf          = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const imgData      = canvas.toDataURL('image/jpeg', 0.95)
      const imgH_MM      = (canvas.height / canvas.width) * A4_W_MM

      /* Multi-page slicing */
      if (imgH_MM <= A4_H_MM) {
        pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, imgH_MM)
      } else {
        const scale   = canvas.width / A4_W_MM           // px per mm
        let   yMM     = 0
        while (yMM < imgH_MM) {
          const sliceHMM = Math.min(A4_H_MM, imgH_MM - yMM)
          const sy       = yMM   * scale
          const sh       = sliceHMM * scale
          const tmp      = document.createElement('canvas')
          tmp.width      = canvas.width
          tmp.height     = Math.ceil(sh)
          tmp.getContext('2d')!.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh)
          if (yMM > 0) pdf.addPage()
          pdf.addImage(tmp.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W_MM, sliceHMM)
          yMM += A4_H_MM
        }
      }

      pdf.save(po?.poNumber ? `Invoice-${po.poNumber}.pdf` : 'Purchase-Invoice.pdf')
    } catch (e) {
      console.error('PDF error', e)
      alert('PDF generation failed — use Print → Save as PDF instead.')
    } finally {
      setDownloading(false)
    }
  }

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(`Purchase Invoice ${po?.poNumber ?? ''} — Total: LKR ${grandTotal.toLocaleString()}\nSupplier: ${po?.supplierName ?? ''}\nDate: ${INVOICE.date}`)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  const handleEmail = () => {
    const subject = encodeURIComponent(`Purchase Invoice ${po?.poNumber ?? ''}`)
    const body    = encodeURIComponent(`Dear ${po?.supplierName ?? 'Supplier'},\n\nPlease find the purchase invoice details below.\n\nPO Number: ${po?.poNumber ?? ''}\nTotal: LKR ${grandTotal.toLocaleString()}\nDate: ${INVOICE.date}\n\nRegards,\n${COMPANY.name}`)
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
  }

  const handlePrint = () => window.print()

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-orange-400" />
    </div>
  )
  if (error) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <p className="text-red-400">{error}</p>
      <button onClick={() => router.back()} className="btn-secondary text-sm flex items-center gap-2"><ArrowLeft size={14} />Go Back</button>
    </div>
  )

  /* Map real PO → invoice shape, or use demo values */
  const INVOICE = po ? {
    number:        po.poNumber,
    date:          formatDate(po.createdAt),
    dueDate:       po.expectedDelivery ? formatDate(po.expectedDelivery) : '—',
    status:        po.status === 'RECEIVED' || po.paidAmount >= po.total ? 'PAID'
                 : po.status === 'DRAFT'                                 ? 'DRAFT'
                 :                                                          'PENDING',
    poNumber:      po.poNumber,
    warehouse:     'Main Warehouse',
    paymentMethod: 'Bank Transfer',
    createdBy:     currentUser?.name || 'Staff',
  } : {
    number: 'PI-DEMO-001', date: '11 May 2026', dueDate: '25 May 2026',
    status: 'DRAFT' as const, poNumber: 'PO-DEMO-001',
    warehouse: 'Main Warehouse', paymentMethod: 'Bank Transfer', createdBy: 'Demo',
  }

  const SUPPLIER = po ? {
    name:    po.supplierName,
    contact: '—', address: '—', email: '—',
    id:      po.supplierId?.slice(0, 8).toUpperCase(),
  } : { name: 'Demo Supplier', contact: '—', address: '—', email: '—', id: 'DEMO' }

  const ITEMS: any[] = po?.items ?? []

  const subtotal   = po ? Number(po.subtotal) : 0
  const totalDisc  = 0
  const totalTax   = po ? Number(po.tax) : 0
  const shipping   = 0
  const grandTotal = po ? Number(po.total) : 0
  const watermark  = INVOICE.status === 'PAID'

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-8 print:bg-white print:p-0">

      {/* Action bar */}
      <ActionBar onDownload={handleDownload} onPrint={handlePrint} onWhatsApp={handleWhatsApp} onEmail={handleEmail} downloading={downloading} />

      {/* Invoice Card */}
      <div
        ref={invoiceRef}
        id="invoice"
        className="relative max-w-5xl mx-auto bg-white rounded-3xl overflow-hidden shadow-lg shadow-black/10 border border-gray-100 print:shadow-none print:border-0 print:rounded-none print:bg-white"
      >
        {/* Orange top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-orange-600 via-orange-400 to-amber-400" />

        {/* Watermark */}
        {watermark && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 rotate-[-35deg] opacity-[0.04]">
            <span className="text-[140px] font-black tracking-widest text-orange-400 uppercase select-none">PAID</span>
          </div>
        )}

        <div className="relative z-10 p-8 sm:p-10 space-y-8">

          {/* ── HEADER ─────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
            {/* Logo + company */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/30 flex-shrink-0">
                <span className="text-2xl font-black text-white tracking-tight">HX</span>
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900 tracking-wide">{COMPANY.name}</h1>
                <p className="text-xs text-orange-400 font-medium mt-0.5">{COMPANY.tagline}</p>
                {COMPANY.vat && <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-0.5">VAT: {COMPANY.vat}</p>}
              </div>
            </div>

            {/* Invoice meta */}
            <div className="text-right space-y-1.5 sm:mx-auto">
              <div className="flex items-center gap-3 justify-end">
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-widest">Purchase Invoice</h2>
              </div>
              <p className="text-sm text-orange-400 font-mono font-semibold">{INVOICE.number}</p>
              <div className="flex items-center gap-4 justify-end text-xs text-gray-600 dark:text-slate-400 mt-2">
                <span>Issued: <span className="text-gray-700">{INVOICE.date}</span></span>
                <span>Due: <span className="text-gray-700">{INVOICE.dueDate}</span></span>
              </div>
              <div className="flex justify-end mt-2">
                <StatusBadge status={INVOICE.status} />
              </div>
            </div>

            {/* QR code */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="p-2.5 bg-gray-50 rounded-xl border border-orange-200 shadow-sm">
                <QRCodeSVG />
              </div>
              <span className="text-[9px] text-slate-600 font-mono">Scan to verify</span>
            </div>
          </div>

          {/* ── COMPANY + SUPPLIER CARDS ────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Company */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500 to-amber-400 rounded-l-2xl" />
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={14} className="text-orange-500" />
                <span className="text-[10px] uppercase tracking-widest text-orange-500 font-semibold">From</span>
              </div>
              <p className="text-base font-bold text-gray-900 mb-3">{COMPANY.name}</p>
              <div className="space-y-1.5">
                {[
                  { icon: MapPin, text: COMPANY.address },
                  { icon: Phone,  text: COMPANY.phone   },
                  { icon: Mail,   text: COMPANY.email   },
                  { icon: Globe,  text: COMPANY.website },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-2 text-xs text-gray-500">
                    <Icon size={11} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Supplier */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-blue-500 rounded-l-2xl" />
              <div className="flex items-center gap-2 mb-3">
                <Truck size={14} className="text-cyan-600" />
                <span className="text-[10px] uppercase tracking-widest text-cyan-600 font-semibold">Supplier</span>
              </div>
              <p className="text-base font-bold text-gray-900 mb-3">{SUPPLIER.name}</p>
              <div className="space-y-1.5">
                {[
                  { icon: Phone,   text: SUPPLIER.contact },
                  { icon: MapPin,  text: SUPPLIER.address  },
                  { icon: Mail,    text: SUPPLIER.email    },
                  { icon: User,    text: `ID: ${SUPPLIER.id}` },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-2 text-xs text-gray-500">
                    <Icon size={11} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── PURCHASE INFO BAR ───────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Package,    label: 'Warehouse',      value: INVOICE.warehouse    },
              { icon: FileText,   label: 'PO Reference',   value: INVOICE.poNumber     },
              { icon: CreditCard, label: 'Payment Method', value: INVOICE.paymentMethod },
              { icon: User,       label: 'Created By',     value: INVOICE.createdBy    },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-gray-100 rounded-xl px-4 py-3 border border-gray-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={11} className="text-orange-400" />
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</span>
                </div>
                <p className="text-xs font-semibold text-gray-800 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* ── PRODUCTS TABLE ──────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-6 h-0.5 bg-orange-500 inline-block rounded" />
              Order Items
            </h3>
            <div className="rounded-2xl overflow-hidden border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Product','IMEI','Specs','Qty','Unit Price','Disc.','Tax','Total'].map((h, i) => (
                      <th key={h} className={`px-4 py-3.5 text-[10px] uppercase tracking-widest font-bold text-slate-500 ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ITEMS.map((item: any, idx: number) => {
                    const name      = item.productName ?? item.name ?? '—'
                    const brand     = item.brand ?? item.brandName ?? null
                    const imei      = item.imei ?? null
                    const storage   = item.storage ?? null
                    const color     = item.colorName ?? item.color ?? null
                    const itemSku   = item.sku ?? null
                    const qty       = item.quantity   ?? item.qty   ?? 0
                    const unitPrice = item.unitCost   ?? item.unitPrice ?? 0
                    const discount  = item.discount   ?? 0
                    const tax       = item.tax        ?? null
                    const lineTotal = item.total      ?? (qty * unitPrice - discount)
                    return (
                      <tr key={item.id ?? idx} className="hover:bg-orange-50 transition-colors group">
                        {/* Product */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/20 flex items-center justify-center text-xl flex-shrink-0">
                              📦
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm leading-tight">{name}</p>
                              {brand && <span className="text-[10px] text-orange-400 font-medium bg-orange-500/10 px-1.5 py-0.5 rounded mt-0.5 inline-block">{brand}</span>}
                              {itemSku && <span className="text-[10px] font-mono text-gray-400 mt-0.5 block">{itemSku}</span>}
                            </div>
                          </div>
                        </td>
                        {/* IMEI */}
                        <td className="px-4 py-4">
                          {imei ? (
                            <div>
                              <p className="text-[11px] font-mono text-gray-600">{imei}</p>
                              <div className="mt-1"><BarcodeLabelPreview value={imei} className="bg-white rounded px-1" /></div>
                            </div>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        {/* Specs */}
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            {storage && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 w-fit">{storage}</span>}
                            {color   && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 w-fit">{color}</span>}
                            {!storage && !color && <span className="text-xs text-gray-400">—</span>}
                          </div>
                        </td>
                        {/* Qty */}
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg">{qty}</span>
                        </td>
                        {/* Unit price */}
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-semibold text-gray-700">{fmt(unitPrice)}</span>
                        </td>
                        {/* Discount */}
                        <td className="px-4 py-4 text-right">
                          <span className="text-xs text-red-400">{discount ? `-${fmt(discount)}` : '—'}</span>
                        </td>
                        {/* Tax */}
                        <td className="px-4 py-4 text-right">
                          <span className="text-xs text-amber-400">{tax != null ? `${tax}%` : '—'}</span>
                        </td>
                        {/* Total */}
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-bold text-gray-900">{fmt(lineTotal)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {poImeis.length > 0 && (
              <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/50 p-5">
                <h3 className="text-xs font-bold text-violet-700 uppercase tracking-widest mb-3">
                  Registered Device IMEIs ({poImeis.length})
                </h3>
                <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {poImeis.map((rec, i) => (
                    <div key={i} className="text-[11px] font-mono bg-white rounded-lg px-3 py-2 border border-violet-100">
                      <span className="text-violet-600">{rec.imei}</span>
                      {rec.product?.name && (
                        <span className="block text-[10px] text-gray-500 font-sans mt-0.5 truncate">{rec.product.name}</span>
                      )}
                      {rec.variation && (
                        <span className="block text-[10px] text-gray-400 font-sans">{rec.variation}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── TOTALS + NOTES ──────────────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-6">

            {/* Notes + Terms */}
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Notes</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  All products are brand new, sealed with manufacturer warranty. IMEI numbers verified at point of entry.
                  Delivery expected within 3–5 business days. Handle with care during transport.
                </p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Terms & Conditions</h4>
                <ul className="space-y-1.5">
                  {[
                    'Payment is due within 14 days of invoice date.',
                    'Goods once delivered are non-refundable unless defective.',
                    'Disputes must be raised within 48 hours of receipt.',
                    'This invoice is system-generated and digitally valid.',
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-gray-500">
                      <ChevronRight size={10} className="text-orange-500 mt-0.5 flex-shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Totals Card */}
            <div className="relative rounded-2xl overflow-hidden">
              {/* Gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-amber-50 to-gray-50" />
              <div className="absolute inset-0 border border-orange-100 rounded-2xl" />

              <div className="relative p-6 space-y-3">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-4">Summary</h4>

                {[
                  { label: 'Subtotal',        value: fmt(subtotal),  cls: 'text-gray-700' },
                  { label: 'Total Discount',  value: `-${fmt(totalDisc)}`, cls: 'text-red-500' },
                  { label: 'VAT (8%)',         value: fmt(totalTax),  cls: 'text-amber-600' },
                  { label: 'Shipping',         value: fmt(shipping),  cls: 'text-gray-700' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className={`text-sm font-semibold ${cls}`}>{value}</span>
                  </div>
                ))}

                <div className="h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent my-2" />

                {/* Grand Total */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Grand Total</span>
                  <div className="text-right">
                    <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
                      {fmt(grandTotal)}
                    </p>
                    <p className="text-[10px] text-gray-400">Sri Lankan Rupees</p>
                  </div>
                </div>

                {/* Payment status */}
                {INVOICE.status === 'PAID' && (
                  <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                    <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-700">Payment Received</p>
                      <p className="text-[10px] text-gray-400">Bank Transfer · {INVOICE.date}</p>
                    </div>
                  </div>
                )}
                {INVOICE.status === 'PENDING' && (
                  <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <Clock size={14} className="text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700">Payment Pending</p>
                      <p className="text-[10px] text-gray-400">Due by {INVOICE.dueDate}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── SIGNATURE + FOOTER ─────────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Authorized signature */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-6">Authorized Signature</p>
              <div className="border-b border-dashed border-gray-300 pb-2 mb-2 w-48">
                <p className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300 font-serif italic">{invSettings.signatoryName || currentUser?.name || 'Authorized'}</p>
              </div>
              <p className="text-xs text-gray-500">{invSettings.signatoryTitle || 'Authorized Signatory'}, {COMPANY.name}</p>
              <p className="text-[10px] text-gray-400 mt-1">{INVOICE.date}</p>
            </div>

            {/* Thank you + social */}
            <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className="text-orange-400" />
                  <p className="text-sm font-bold text-gray-900">Thank you for your business!</p>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mt-1">
                  We appreciate your trust in Hexalyte Mobile. For queries contact us at {COMPANY.email}
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-orange-100 flex items-center justify-between">
                <p className="text-[10px] text-gray-400 font-mono">{COMPANY.website}</p>
                <div className="flex gap-3">
                  {['FB','IG','WA'].map(s => (
                    <span key={s} className="text-[10px] text-orange-400 font-bold bg-orange-500/10 border border-orange-500/20 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-orange-500/20 transition-colors">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] text-gray-400 font-mono">Generated by Hexalyte ERP · {INVOICE.number}</p>
            <div className="flex items-center gap-1.5">
              <BarChart2 size={10} className="text-orange-500" />
              <p className="text-[10px] text-gray-400">Powered by Hexalyte SaaS Platform</p>
            </div>
          </div>

        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body, html { background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
          .print\\:hidden { display: none !important; }
          #invoice { box-shadow: none !important; border-radius: 0 !important; border: none !important; max-width: 100% !important; margin: 0 !important; }
          @page { margin: 0; size: A4; }
        }
      `}</style>
    </div>
  )
}

/* ─── Default export — Suspense boundary required by Next.js 14 ─────── */
export default function PurchaseInvoicePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-orange-500" />
      </div>
    }>
      <InvoiceContent />
    </Suspense>
  )
}
