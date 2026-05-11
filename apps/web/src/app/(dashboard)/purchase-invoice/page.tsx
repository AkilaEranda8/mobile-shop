'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Download, Printer, Mail, Share2, CheckCircle2, Clock, FileText,
  Phone, Globe, MapPin, Package, Building2, User, Truck, CreditCard,
  BarChart2, QrCode, ChevronRight, Zap, ArrowLeft, Loader2,
} from 'lucide-react'
import { suppliersApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'

/* ─── Static company info ───────────────────────────────────────────── */
const COMPANY = {
  name:    'HEXALYTE MOBILE',
  tagline: 'Premium Mobile Solutions',
  address: '42/B, Galle Road, Colombo 03, Sri Lanka',
  phone:   '+94 77 123 4567',
  email:   'info@hexalyte.com',
  website: 'www.hexalyte.com',
  vat:     'VAT-LK-20240312',
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

/* ─── Barcode SVG ───────────────────────────────────────────────────── */
function BarcodeSVG({ value }: { value: string }) {
  const bars = value.split('').map((c, i) => ({ w: (parseInt(c, 16) % 3) + 1, x: i * 5 }))
  return (
    <svg width="120" height="36" viewBox={`0 0 ${bars.reduce((s, b) => s + b.w + 1, 0)} 28`}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={28} fill="#f97316" opacity={0.8 + (i % 3) * 0.07} />
      ))}
    </svg>
  )
}

/* ─── Status badge ──────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; dot: string; label: string }> = {
    PAID:    { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', label: 'Paid' },
    PENDING: { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',      dot: 'bg-amber-400',   label: 'Pending' },
    DRAFT:   { cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30',      dot: 'bg-slate-400',   label: 'Draft' },
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
function ActionBar({ onPrint }: { onPrint: () => void }) {
  return (
    <div className="flex flex-wrap gap-3 justify-end mb-6 print:hidden">
      {[
        { icon: Download,  label: 'Download PDF',  cls: 'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/20' },
        { icon: Printer,   label: 'Print',         cls: 'bg-[#1a2540] hover:bg-[#1f2d4f] text-slate-200 border border-white/10', action: onPrint },
        { icon: Share2,    label: 'WhatsApp',       cls: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
        { icon: Mail,      label: 'Send Email',     cls: 'bg-[#1a2540] hover:bg-[#1f2d4f] text-slate-200 border border-white/10' },
      ].map(({ icon: Icon, label, cls, action }) => (
        <button
          key={label}
          onClick={action}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${cls}`}
        >
          <Icon size={15} />{label}
        </button>
      ))}
    </div>
  )
}

/* ─── Inner content (needs Suspense for useSearchParams) ────────────── */
function InvoiceContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const poId         = searchParams.get('id')

  const [po, setPo]           = useState<any>(null)
  const [loading, setLoading] = useState(!!poId)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!poId) return
    setLoading(true)
    suppliersApi.purchaseOrders({ id: poId })
      .then((res: any) => {
        const list  = res?.data ?? []
        const found = list.find((p: any) => p.id === poId) ?? list[0] ?? null
        if (!found) setError('Purchase order not found')
        else setPo(found)
      })
      .catch(() => setError('Failed to load purchase order'))
      .finally(() => setLoading(false))
  }, [poId])

  if (loading) return (
    <div className="min-h-screen bg-[#060d1a] flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-orange-400" />
    </div>
  )
  if (error) return (
    <div className="min-h-screen bg-[#060d1a] flex flex-col items-center justify-center gap-4">
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
    createdBy:     'Akila Eranda',
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
    <div className="min-h-screen bg-[#060d1a] py-8 px-4 sm:px-8 print:bg-white print:p-0">

      {/* Action bar */}
      <ActionBar onPrint={() => window.print()} />

      {/* Invoice Card */}
      <div
        id="invoice"
        className="relative max-w-5xl mx-auto bg-[#0b1425] rounded-3xl overflow-hidden shadow-2xl shadow-black/60 border border-white/5 print:shadow-none print:border-0 print:rounded-none print:bg-white"
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
                <h1 className="text-xl font-black text-white tracking-wide">{COMPANY.name}</h1>
                <p className="text-xs text-orange-400 font-medium mt-0.5">{COMPANY.tagline}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">VAT: {COMPANY.vat}</p>
              </div>
            </div>

            {/* Invoice meta */}
            <div className="text-right space-y-1.5 sm:mx-auto">
              <div className="flex items-center gap-3 justify-end">
                <h2 className="text-2xl font-black text-white uppercase tracking-widest">Purchase Invoice</h2>
              </div>
              <p className="text-sm text-orange-400 font-mono font-semibold">{INVOICE.number}</p>
              <div className="flex items-center gap-4 justify-end text-xs text-slate-400 mt-2">
                <span>Issued: <span className="text-slate-200">{INVOICE.date}</span></span>
                <span>Due: <span className="text-slate-200">{INVOICE.dueDate}</span></span>
              </div>
              <div className="flex justify-end mt-2">
                <StatusBadge status={INVOICE.status} />
              </div>
            </div>

            {/* QR code */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="p-2.5 bg-[#0d1a2d] rounded-xl border border-orange-500/20 shadow-lg">
                <QRCodeSVG />
              </div>
              <span className="text-[9px] text-slate-600 font-mono">Scan to verify</span>
            </div>
          </div>

          {/* ── COMPANY + SUPPLIER CARDS ────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Company */}
            <div className="bg-[#0d1a2d] rounded-2xl p-5 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500 to-amber-400 rounded-l-2xl" />
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={14} className="text-orange-400" />
                <span className="text-[10px] uppercase tracking-widest text-orange-400 font-semibold">From</span>
              </div>
              <p className="text-base font-bold text-white mb-3">{COMPANY.name}</p>
              <div className="space-y-1.5">
                {[
                  { icon: MapPin, text: COMPANY.address },
                  { icon: Phone,  text: COMPANY.phone   },
                  { icon: Mail,   text: COMPANY.email   },
                  { icon: Globe,  text: COMPANY.website },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-2 text-xs text-slate-400">
                    <Icon size={11} className="text-slate-600 mt-0.5 flex-shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Supplier */}
            <div className="bg-[#0d1a2d] rounded-2xl p-5 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-blue-500 rounded-l-2xl" />
              <div className="flex items-center gap-2 mb-3">
                <Truck size={14} className="text-cyan-400" />
                <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-semibold">Supplier</span>
              </div>
              <p className="text-base font-bold text-white mb-3">{SUPPLIER.name}</p>
              <div className="space-y-1.5">
                {[
                  { icon: Phone,   text: SUPPLIER.contact },
                  { icon: MapPin,  text: SUPPLIER.address  },
                  { icon: Mail,    text: SUPPLIER.email    },
                  { icon: User,    text: `ID: ${SUPPLIER.id}` },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-2 text-xs text-slate-400">
                    <Icon size={11} className="text-slate-600 mt-0.5 flex-shrink-0" />
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
              <div key={label} className="bg-[#0d1a2d]/70 rounded-xl px-4 py-3 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={11} className="text-orange-400" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
                </div>
                <p className="text-xs font-semibold text-slate-200 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* ── PRODUCTS TABLE ──────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-6 h-0.5 bg-orange-500 inline-block rounded" />
              Order Items
            </h3>
            <div className="rounded-2xl overflow-hidden border border-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0d1a2d] border-b border-white/5">
                    {['Product','IMEI','Specs','Qty','Unit Price','Disc.','Tax','Total'].map((h, i) => (
                      <th key={h} className={`px-4 py-3.5 text-[10px] uppercase tracking-widest font-bold text-slate-500 ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/3">
                  {ITEMS.map((item, idx) => {
                    const lineTotal = itemTotal(item)
                    return (
                      <tr key={idx} className="hover:bg-orange-500/3 transition-colors group">
                        {/* Product */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/20 flex items-center justify-center text-xl flex-shrink-0">
                              {item.image}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-100 text-sm leading-tight">{item.name}</p>
                              <span className="text-[10px] text-orange-400 font-medium bg-orange-500/10 px-1.5 py-0.5 rounded mt-0.5 inline-block">{item.brand}</span>
                            </div>
                          </div>
                        </td>
                        {/* IMEI */}
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-[11px] font-mono text-slate-300">{item.imei}</p>
                            <div className="mt-1">
                              <BarcodeSVG value={item.imei} />
                            </div>
                          </div>
                        </td>
                        {/* Specs */}
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 w-fit">{item.storage}</span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 w-fit">{item.color}</span>
                          </div>
                        </td>
                        {/* Qty */}
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-bold text-white bg-white/5 px-2.5 py-1 rounded-lg">{item.qty}</span>
                        </td>
                        {/* Unit price */}
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-semibold text-slate-200">{fmt(item.unitPrice)}</span>
                        </td>
                        {/* Discount */}
                        <td className="px-4 py-4 text-right">
                          <span className="text-xs text-red-400">-{fmt(item.discount)}</span>
                        </td>
                        {/* Tax */}
                        <td className="px-4 py-4 text-right">
                          <span className="text-xs text-amber-400">{item.tax}%</span>
                        </td>
                        {/* Total */}
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-bold text-white">{fmt(lineTotal)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── TOTALS + NOTES ──────────────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-6">

            {/* Notes + Terms */}
            <div className="space-y-4">
              <div className="bg-[#0d1a2d]/60 rounded-2xl p-5 border border-white/5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Notes</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  All products are brand new, sealed with manufacturer warranty. IMEI numbers verified at point of entry.
                  Delivery expected within 3–5 business days. Handle with care during transport.
                </p>
              </div>
              <div className="bg-[#0d1a2d]/60 rounded-2xl p-5 border border-white/5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Terms & Conditions</h4>
                <ul className="space-y-1.5">
                  {[
                    'Payment is due within 14 days of invoice date.',
                    'Goods once delivered are non-refundable unless defective.',
                    'Disputes must be raised within 48 hours of receipt.',
                    'This invoice is system-generated and digitally valid.',
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500">
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
              <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 via-amber-500/10 to-[#0d1a2d]" />
              <div className="absolute inset-0 border border-orange-500/20 rounded-2xl" />

              <div className="relative p-6 space-y-3">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-4">Summary</h4>

                {[
                  { label: 'Subtotal',        value: fmt(subtotal),  cls: 'text-slate-300' },
                  { label: 'Total Discount',  value: `-${fmt(totalDisc)}`, cls: 'text-red-400' },
                  { label: 'VAT (8%)',         value: fmt(totalTax),  cls: 'text-amber-400' },
                  { label: 'Shipping',         value: fmt(shipping),  cls: 'text-slate-300' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={`text-sm font-semibold ${cls}`}>{value}</span>
                  </div>
                ))}

                <div className="h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent my-2" />

                {/* Grand Total */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Grand Total</span>
                  <div className="text-right">
                    <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
                      {fmt(grandTotal)}
                    </p>
                    <p className="text-[10px] text-slate-500">Sri Lankan Rupees</p>
                  </div>
                </div>

                {/* Payment status */}
                {INVOICE.status === 'PAID' && (
                  <div className="mt-3 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                    <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-300">Payment Received</p>
                      <p className="text-[10px] text-slate-500">Bank Transfer · {INVOICE.date}</p>
                    </div>
                  </div>
                )}
                {INVOICE.status === 'PENDING' && (
                  <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
                    <Clock size={14} className="text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-300">Payment Pending</p>
                      <p className="text-[10px] text-slate-500">Due by {INVOICE.dueDate}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── SIGNATURE + FOOTER ─────────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Authorized signature */}
            <div className="bg-[#0d1a2d]/60 rounded-2xl p-5 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-6">Authorized Signature</p>
              <div className="border-b border-dashed border-white/10 pb-2 mb-2 w-48">
                <p className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300 font-serif italic">Akila Eranda</p>
              </div>
              <p className="text-xs text-slate-500">Owner, Hexalyte Mobile</p>
              <p className="text-[10px] text-slate-600 mt-1">{INVOICE.date}</p>
            </div>

            {/* Thank you + social */}
            <div className="bg-gradient-to-br from-orange-500/10 to-transparent rounded-2xl p-5 border border-orange-500/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className="text-orange-400" />
                  <p className="text-sm font-bold text-white">Thank you for your business!</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  We appreciate your trust in Hexalyte Mobile. For queries contact us at {COMPANY.email}
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <p className="text-[10px] text-slate-600 font-mono">{COMPANY.website}</p>
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
            <p className="text-[10px] text-slate-600 font-mono">Generated by Hexalyte ERP · {INVOICE.number}</p>
            <div className="flex items-center gap-1.5">
              <BarChart2 size={10} className="text-orange-500" />
              <p className="text-[10px] text-slate-600">Powered by Hexalyte SaaS Platform</p>
            </div>
          </div>

        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}

/* ─── Default export — Suspense boundary required by Next.js 14 ─────── */
export default function PurchaseInvoicePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060d1a] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    }>
      <InvoiceContent />
    </Suspense>
  )
}
