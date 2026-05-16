'use client'

import { useRef, forwardRef } from 'react'
import { Download, Printer, Phone, Mail, Globe, MapPin } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceItem {
  description: string
  details?: string
  price: number
  qty: number
}

export interface InvoiceData {
  companyName:    string
  companySlogan?: string
  companyLogo?:   string
  companyAddress: string
  companyPhone:   string
  companyEmail:   string
  companyWebsite: string
  invoiceNumber:  string
  dueDate:        string
  customerName:   string
  customerCompany?: string
  customerEmail:  string
  customerAddress:  string
  customerAddress2?: string
  items:          InvoiceItem[]
  bankName:       string
  accNumber:      string
  accHolder:      string
  swiftCode:      string
  taxRate:        number
  discountRate:   number
  terms:          string[]
  signatoryName:  string
  signatoryTitle: string
  currency?:      string
}

// ── Sample data ───────────────────────────────────────────────────────────────

export const SAMPLE_INVOICE: InvoiceData = {
  companyName:     'HEXALYTE',
  companySlogan:   'Smart POS & Business Solutions',
  companyAddress:  '123 Street Name, City Name\nState Name, Country',
  companyPhone:    '+94 123 456 7890',
  companyEmail:    'info@hexalyte.com',
  companyWebsite:  'www.hexalyte.com',
  invoiceNumber:   'INV-2026-001',
  dueDate:         '01 March 2026',
  customerName:    'Name Surname',
  customerCompany: 'Your Company',
  customerEmail:   'email@example.com',
  customerAddress: 'Your Address Goes Here',
  customerAddress2:'Your Address Goes Here 2',
  items: [
    { description: 'Item Description Here', details: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tin', price: 500, qty: 2 },
    { description: 'Item Description Here', details: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tin', price: 500, qty: 2 },
    { description: 'Item Description Here', details: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tin', price: 500, qty: 2 },
    { description: 'Item Description Here', details: 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tin', price: 500, qty: 2 },
  ],
  bankName:  'Bank Name',
  accNumber: '123456789',
  accHolder: 'Name Surname',
  swiftCode: '12345',
  taxRate:       10,
  discountRate:  10,
  terms: [
    'Lorem ipsum dolor sit amet, consectetuer adipiscing',
    'Sed diam nonummy nibh euismod tincidunt ut laoreet',
    'Ut wisi enim ad minim veniam, quis nostrud exerci',
  ],
  signatoryName:  'Name Surname',
  signatoryTitle: 'Accounting Manager',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeFmt = (currency = 'LKR') => (n: number) =>
  currency + ' ' + new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

// ── Component ─────────────────────────────────────────────────────────────────

const InvoicePrint = forwardRef<HTMLDivElement, { data?: InvoiceData; hideControls?: boolean }>(
function InvoicePrint({ data = SAMPLE_INVOICE, hideControls = false }, outerRef) {
  const localRef = useRef<HTMLDivElement>(null)
  const invoiceRef = (outerRef as React.RefObject<HTMLDivElement>) ?? localRef

  const fmt       = makeFmt(data.currency)
  const subtotal  = data.items.reduce((s, i) => s + i.price * i.qty, 0)
  const tax       = subtotal * (data.taxRate / 100)
  const discount  = subtotal * (data.discountRate / 100)
  const total     = subtotal + tax - discount

  // ── PDF download using jsPDF + html2canvas ──────────────────────────────
  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF }       = await import('jspdf')

    const canvas = await html2canvas(invoiceRef.current, {
      scale:   2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    const imgData  = canvas.toDataURL('image/png')
    const pdf      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pdfW     = pdf.internal.pageSize.getWidth()
    const pdfH     = (canvas.height * pdfW) / canvas.width

    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
    pdf.save(`invoice-${data.invoiceNumber}.pdf`)
  }

  // ── Print ──────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const printContents = invoiceRef.current?.innerHTML ?? ''
    const w = window.open('', '_blank', 'width=900,height=1200')
    if (!w) return
    w.document.write(`
      <html><head><title>Invoice ${data.invoiceNumber}</title>
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

  return (
    <div className={hideControls ? '' : 'min-h-screen bg-gray-100 py-8 px-4'}>
      {/* ── Action buttons ── */}
      {!hideControls && <div className="flex items-center justify-center gap-3 mb-6 print:hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#2E2E2E] text-white rounded-lg text-sm font-medium hover:bg-black transition-colors shadow"
        >
          <Printer size={16} /> Print Invoice
        </button>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow"
        >
          <Download size={16} /> Download PDF
        </button>
      </div>}

      {/* ── A4 Invoice sheet ── */}
      <div
        ref={invoiceRef}
        className="bg-white w-full max-w-[794px] mx-auto shadow-xl"
        style={{ fontFamily: "'Segoe UI', Arial, sans-serif", minHeight: '1123px', padding: '40px 50px' }}
      >
        {/* 1. Company header */}
        <div className="flex justify-between items-start mb-8">
          {/* Left: logo + name */}
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 flex items-center justify-center">
              {data.companyLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.companyLogo} alt="logo" className="w-12 h-12 object-contain" />
              ) : (
                <svg viewBox="0 0 48 48" className="w-12 h-12">
                  <polygon points="24,4 44,40 4,40" fill="#CC2200" />
                  <polygon points="24,14 38,38 10,38" fill="#991100" opacity="0.5" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-xl font-black tracking-widest text-[#2E2E2E] leading-tight">{data.companyName}</p>
              {data.companySlogan && (
                <p className="text-[10px] tracking-widest text-gray-500 uppercase">{data.companySlogan}</p>
              )}
            </div>
          </div>

          {/* Right: contact */}
          <div className="text-right text-xs text-gray-600 space-y-1">
            <p className="text-[11px] text-gray-700 whitespace-pre-line leading-snug">{data.companyAddress}</p>
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <Phone size={10} className="text-gray-400" />
              <span>{data.companyPhone}</span>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Mail size={10} className="text-gray-400" />
              <span>{data.companyEmail}</span>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Globe size={10} className="text-gray-400" />
              <span>{data.companyWebsite}</span>
            </div>
          </div>
        </div>

        {/* 2. INVOICE title */}
        <div className="border-t border-b border-gray-300 py-4 mb-6 text-center">
          <h1 className="text-4xl font-black tracking-widest text-[#2E2E2E]">INVOICE</h1>
        </div>

        {/* 3. Invoice info row */}
        <div className="flex justify-between mb-8 pb-4 border-b border-gray-200">
          <div>
            <span className="text-xs font-bold text-[#2E2E2E]">#Due Total: </span>
            <span className="text-xs text-gray-700">{fmt(total)}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-[#2E2E2E]">#Due Date: </span>
            <span className="text-xs text-gray-700">{data.dueDate}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-[#2E2E2E]">#Invoice No: </span>
            <span className="text-xs text-gray-700">{data.invoiceNumber}</span>
          </div>
        </div>

        {/* 4. Customer section */}
        <div className="mb-8">
          <p className="text-xs font-bold text-[#2E2E2E] mb-3 uppercase tracking-wider">Invoice To :</p>
          <table className="text-xs text-gray-700">
            <tbody>
              {[
                ['Name',    data.customerName],
                ...(data.customerCompany ? [['Company', data.customerCompany]] : []),
                ['Email',   data.customerEmail],
                ['Address', data.customerAddress],
                ...(data.customerAddress2 ? [['', data.customerAddress2]] : []),
              ].map(([label, value], i) => (
                <tr key={i}>
                  <td className="font-bold pr-6 py-0.5 align-top w-24">{label}</td>
                  <td className="py-0.5 text-gray-600">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 5. Items table */}
        <table className="w-full text-xs mb-8" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#2E2E2E', color: '#FFFFFF' }}>
              <th className="py-3 px-4 text-left font-semibold tracking-wider uppercase" style={{ width: '50%' }}>Item Description</th>
              <th className="py-3 px-4 text-center font-semibold tracking-wider uppercase" style={{ width: '17%' }}>Price</th>
              <th className="py-3 px-4 text-center font-semibold tracking-wider uppercase" style={{ width: '13%' }}>Qty</th>
              <th className="py-3 px-4 text-center font-semibold tracking-wider uppercase" style={{ width: '20%' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 1 ? '#F5F5F5' : '#FFFFFF' }}>
                <td className="py-3 px-4 align-top">
                  <p className="font-bold text-[#2E2E2E]">{item.description}</p>
                  {item.details && <p className="text-gray-500 text-[10px] mt-0.5 leading-snug">{item.details}</p>}
                </td>
                <td className="py-3 px-4 text-center text-gray-700">{fmt(item.price)}</td>
                <td className="py-3 px-4 text-center text-gray-700">{item.qty}</td>
                <td className="py-3 px-4 text-center font-medium text-gray-700">{fmt(item.price * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 6. Payment + Summary */}
        <div className="mb-4">
          <div className="flex justify-between gap-8 mb-0">
            {/* Payment details */}
            <div className="flex-1">
              <p className="text-xs font-bold text-[#2E2E2E] mb-3 uppercase tracking-wider">Payment:</p>
              <table className="text-xs text-gray-700">
                <tbody>
                  {[
                    ['Bank Name',   data.bankName],
                    ['Acc Number',  data.accNumber],
                    ['Acc Holder',  data.accHolder],
                    ['Swift Code',  data.swiftCode],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td className="font-bold pr-6 py-1 w-24">{label}</td>
                      <td className="py-1 text-gray-600">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sub-totals (no TOTAL row here) */}
            <div className="w-56">
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 text-right text-gray-500 uppercase tracking-wider font-medium">Sub Total</td>
                    <td className="py-2 text-right font-semibold text-gray-700 w-24">{fmt(subtotal)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 text-right text-gray-500 uppercase tracking-wider font-medium">Tax {data.taxRate}%</td>
                    <td className="py-2 text-right font-semibold text-gray-700">{fmt(tax)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 text-right text-gray-500 uppercase tracking-wider font-medium">Disc. {data.discountRate}%</td>
                    <td className="py-2 text-right font-semibold text-gray-700">{fmt(discount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Full-width TOTAL bar */}
          <div style={{ backgroundColor: '#2E2E2E', marginTop: 12 }}
            className="w-full flex items-center justify-center py-3 mb-8">
            <span className="font-bold text-white uppercase tracking-widest text-sm">
              TOTAL &nbsp;&nbsp;&nbsp; {fmt(total)}
            </span>
          </div>
        </div>

        {/* 7. Terms & Signature */}
        <div className="flex justify-between items-end mt-8 pt-6 border-t border-gray-200">
          {/* Terms */}
          <div className="flex-1 pr-8">
            <p className="text-xs font-bold text-[#2E2E2E] mb-3 uppercase tracking-wider">Terms &amp; Conditions :</p>
            <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
              {data.terms.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>

          {/* Signature */}
          <div className="text-center w-44">
            <div className="h-14 border-b border-gray-400 mb-2 flex items-end justify-center pb-1">
              <svg viewBox="0 0 120 40" className="w-28 h-10 opacity-60">
                <path d="M10,30 Q30,5 50,20 Q70,35 90,15 Q105,5 115,20" stroke="#444" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-xs font-bold text-[#2E2E2E]">{data.signatoryName}</p>
            <p className="text-[10px] text-gray-500">{data.signatoryTitle}</p>
          </div>
        </div>

        {/* Footer bar */}
        <div className="mt-10 pt-3 border-t-2 border-[#2E2E2E] text-center">
          <p className="text-[10px] text-gray-400 tracking-widest uppercase">
            Thank you for your business · {data.companyEmail} · {data.companyWebsite}
          </p>
        </div>
      </div>
    </div>
  )
})

export default InvoicePrint
