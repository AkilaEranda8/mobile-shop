'use client'

import { forwardRef } from 'react'
import { Download, Printer, Receipt } from 'lucide-react'
import type { InvoiceSettings } from '@/lib/invoiceSettings'
import {
  HEXALYTE_SOFTWARE_FOOTER,
  mergeReceiptSettings,
  thermalBodyFontWeight,
  thermalLogoMaxHeight,
  type ShopContext,
} from '@/lib/invoiceSettings'
import { printHtmlDocument } from '@/lib/printHtml'

export type PayslipLine = {
  code: string
  label: string
  amount: number
  kind: 'EARNING' | 'DEDUCTION' | 'EMPLOYER'
}

export type PayslipSlip = {
  id: string
  gross: number
  deductions: number
  net: number
  linesJson?: PayslipLine[] | string | null
  issuedAt: string
  employee: { fullName: string; employeeCode: string }
  run: { status: string; period: { label: string; startDate?: string; endDate?: string } }
}

const FONT = 'Arial, Helvetica, sans-serif'
const C = {
  text: '#111827',
  muted: '#6b7280',
  line: '#d1d5db',
  headerBg: '#111827',
  rowAlt: '#f3f4f6',
  valueBg: '#e5e7eb',
  earn: '#065f46',
  ded: '#991b1b',
}

const fmtMoney = (n: number, currency = 'LKR') =>
  `${currency} ${new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`

const fmtDate = (iso?: string) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function parsePayslipLines(raw: PayslipSlip['linesJson']): PayslipLine[] {
  if (!raw) return []
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as PayslipLine[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return Array.isArray(raw) ? raw : []
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', border: `1px solid ${C.line}` }}>
      <div
        style={{
          background: C.headerBg,
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          padding: '6px 10px',
          minWidth: 108,
          borderRight: `1px solid ${C.line}`,
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          background: C.valueBg,
          fontSize: 11,
          fontWeight: 600,
          padding: '6px 10px',
          color: C.text,
        }}
      >
        {value}
      </div>
    </div>
  )
}

export const PayslipSheet = forwardRef<
  HTMLDivElement,
  { slip: PayslipSlip; settings: InvoiceSettings }
>(function PayslipSheet({ slip, settings }, ref) {
  const currency = settings.currency || 'LKR'
  const brandName = settings.shopName || 'Your Business'
  const legalName = settings.companyLegalName || brandName
  const logo = settings.logo?.trim()
  const lines = parsePayslipLines(slip.linesJson)
  const earnings = lines.filter(l => l.kind === 'EARNING')
  const deductions = lines.filter(l => l.kind === 'DEDUCTION')
  const employer = lines.filter(l => l.kind === 'EMPLOYER')
  const slipNo = `PS-${slip.id.slice(0, 8).toUpperCase()}`

  const th: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    padding: '8px 8px',
    color: '#fff',
    background: C.headerBg,
    border: 'none',
    textAlign: 'left',
  }
  const td: React.CSSProperties = {
    fontSize: 11,
    padding: '8px',
    verticalAlign: 'top',
    color: C.text,
    borderBottom: `1px solid ${C.line}`,
  }

  const renderSection = (title: string, rows: PayslipLine[], amountColor: string) => {
    if (!rows.length) return null
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, marginBottom: 8, color: C.text }}>
          {title}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '22%' }}>Code</th>
              <th style={{ ...th, width: '58%' }}>Description</th>
              <th style={{ ...th, width: '20%', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((line, i) => (
              <tr key={`${line.code}-${i}`} style={{ background: i % 2 ? C.rowAlt : '#fff' }}>
                <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: 10 }}>{line.code}</td>
                <td style={td}>{line.label}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: amountColor, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(line.amount, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      style={{
        width: 794,
        minHeight: 1123,
        margin: '0 auto',
        background: '#fff',
        color: C.text,
        fontFamily: FONT,
        padding: '32px 40px 24px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        colorScheme: 'light',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 24,
          paddingBottom: 14,
          borderBottom: `1.5px solid ${C.text}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" style={{ maxHeight: 52, maxWidth: 120, objectFit: 'contain' }} />
            ) : null}
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>{brandName}</div>
              {legalName !== brandName && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{legalName}</div>
              )}
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            {[settings.address, settings.phone, settings.email].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.5 }}>PAYSLIP</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{slip.run.period.label}</div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6 }}>{slip.run.status}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16, marginBottom: 20 }}>
        <MetaCell label="Employee" value={slip.employee.fullName} />
        <MetaCell label="Emp. Code" value={slip.employee.employeeCode} />
        <MetaCell label="Payslip No" value={slipNo} />
        <MetaCell label="Issued" value={fmtDate(slip.issuedAt)} />
        <MetaCell label="Period" value={slip.run.period.label} />
        <MetaCell
          label="Dates"
          value={
            slip.run.period.startDate && slip.run.period.endDate
              ? `${fmtDate(slip.run.period.startDate)} – ${fmtDate(slip.run.period.endDate)}`
              : slip.run.period.label
          }
        />
      </div>

      {renderSection('Earnings', earnings, C.earn)}
      {renderSection('Deductions', deductions, C.ded)}
      {employer.length > 0 && (
        <div style={{ marginBottom: 18, opacity: 0.85 }}>
          {renderSection('Employer contributions (info)', employer, C.muted)}
        </div>
      )}

      {!lines.length && (
        <div style={{ marginBottom: 18, padding: 12, background: C.rowAlt, borderRadius: 8, fontSize: 12, color: C.muted }}>
          Line detail not stored for this slip — totals only.
        </div>
      )}

      <div style={{ marginTop: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
            padding: 14,
            background: C.headerBg,
            color: '#fff',
            borderRadius: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gross</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{fmtMoney(slip.gross, currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>Deductions</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{fmtMoney(slip.deductions, currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>Net pay</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{fmtMoney(slip.net, currency)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginTop: 28, fontSize: 11, color: C.muted }}>
          <div style={{ flex: 1, borderTop: `1px solid ${C.line}`, paddingTop: 8, textAlign: 'center' }}>Employee signature</div>
          <div style={{ flex: 1, borderTop: `1px solid ${C.line}`, paddingTop: 8, textAlign: 'center' }}>Authorized signature</div>
        </div>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 9, color: C.muted }}>
          {settings.footerNote || 'This is a computer-generated payslip.'}
          <div style={{ marginTop: 4 }}>{HEXALYTE_SOFTWARE_FOOTER}</div>
        </div>
      </div>
    </div>
  )
})

export async function downloadPayslipPdf(element: HTMLElement, slip: PayslipSlip) {
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF } = await import('jspdf')
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    onclone: (doc, el) => {
      doc.documentElement.classList.remove('dark')
      doc.documentElement.style.colorScheme = 'light'
      doc.body.style.background = '#ffffff'
      doc.body.style.color = '#111827'
      el.style.background = '#ffffff'
      el.style.color = '#111827'
      el.style.colorScheme = 'light'
    },
  })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pdfW = pdf.internal.pageSize.getWidth()
  const pdfH = (canvas.height * pdfW) / canvas.width
  pdf.addImage(imgData, 'PNG', 0, 0, pdfW, Math.min(pdfH, pdf.internal.pageSize.getHeight()))
  const code = slip.employee.employeeCode || slip.id.slice(0, 8)
  const period = slip.run.period.label.replace(/[^\w\-]+/g, '_')
  pdf.save(`payslip-${code}-${period}.pdf`)
}

export function printPayslipA4(element: HTMLElement, slip: PayslipSlip) {
  const w = window.open('', '_blank', 'width=820,height=1160')
  if (!w) return false
  w.document.write(`<!DOCTYPE html><html><head><title>Payslip ${esc(slip.employee.employeeCode)}</title>
    <style>@page{size:A4;margin:10mm}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#fff}</style></head>
    <body>${element.outerHTML}</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => {
    w.print()
  }, 120)
  return true
}

function thermalBodyWidth(paper: '58mm' | '80mm') {
  return paper === '80mm' ? '288px' : '200px'
}

function thermalFontScale(size: InvoiceSettings['thermalFontSize']) {
  if (size === 'sm') return { base: 12, title: 15, total: 15, small: 11 }
  if (size === 'lg') return { base: 16, title: 19, total: 19, small: 13 }
  return { base: 14, title: 17, total: 17, small: 12 }
}

export function printPayslipThermal(
  slip: PayslipSlip,
  settings: InvoiceSettings,
  ctx?: ShopContext,
  opts?: { targetWindow?: Window | null },
): boolean {
  settings = mergeReceiptSettings(settings, ctx)
  const currency = settings.currency || 'LKR'
  const f = (n: number) => esc(`${currency} ${new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2 }).format(n)}`)
  const fs = thermalFontScale(settings.thermalFontSize || 'md')
  const logoHeight = thermalLogoMaxHeight(settings.thermalLogoSize)
  const bodyWeight = thermalBodyFontWeight()
  const paperWidth = (settings.thermalWidthPOS === 'stockForm' ? '58mm' : (settings.thermalWidthPOS || '58mm')) as '58mm' | '80mm'
  const bodyWidth = thermalBodyWidth(paperWidth)
  const lines = parsePayslipLines(slip.linesJson)
  const earnings = lines.filter(l => l.kind === 'EARNING')
  const deductions = lines.filter(l => l.kind === 'DEDUCTION')
  const showLogo = settings.thermalShowLogo !== false && !!settings.logo?.trim()

  const lineBlock = (title: string, rows: PayslipLine[]) => {
    if (!rows.length) return ''
    return `
      <div class="dash"></div>
      <div class="center bold">${esc(title)}</div>
      ${rows.map(l => `
        <div class="row">
          <span class="wrap">${esc(l.label)}</span>
          <span class="bold nowrap">${f(l.amount)}</span>
        </div>
      `).join('')}
    `
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Payslip ${esc(slip.employee.employeeCode)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; overflow-x:hidden; }
    body {
      font-family:'Courier New',Courier,monospace;
      font-size:${fs.base}px;
      font-weight:${bodyWeight};
      line-height:1.45;
      max-width:${bodyWidth};
      margin:0 auto;
      padding:4px 2px 12px;
      color:#000;
      background:#fff;
    }
    .center { text-align:center; }
    .bold { font-weight:700; }
    .title { font-size:${fs.title}px; font-weight:800; }
    .small { font-size:${fs.small}px; }
    .dash { border-top:1px dashed #000; margin:8px 0; }
    .row { display:flex; justify-content:space-between; gap:8px; margin:2px 0; }
    .wrap { word-break:break-word; }
    .nowrap { white-space:nowrap; }
    .total { font-size:${fs.total}px; }
    img.logo { max-height:${logoHeight}px; max-width:100%; margin:0 auto 4px; display:block; }
    @page { size: ${paperWidth} auto; margin: 0; }
    @media print {
      html, body { width:${paperWidth}; max-width:${paperWidth}; }
      body { padding:2px 0 8px; }
    }
  </style>
</head>
<body>
  ${showLogo ? `<img class="logo" src="${esc(settings.logo!)}" alt=""/>` : ''}
  <div class="center title">${esc(settings.shopName || 'Payslip')}</div>
  ${settings.thermalShowAddress !== false && settings.address ? `<div class="center small">${esc(settings.address)}</div>` : ''}
  ${settings.thermalShowPhone !== false && settings.phone ? `<div class="center small">${esc(settings.phone)}</div>` : ''}
  <div class="dash"></div>
  <div class="center bold">PAYSLIP</div>
  <div class="center small">${esc(slip.run.period.label)}</div>
  <div class="dash"></div>
  <div class="row"><span>Employee</span><span class="bold wrap">${esc(slip.employee.fullName)}</span></div>
  <div class="row"><span>Code</span><span>${esc(slip.employee.employeeCode)}</span></div>
  <div class="row"><span>Issued</span><span>${esc(fmtDate(slip.issuedAt))}</span></div>
  <div class="row"><span>Status</span><span>${esc(slip.run.status)}</span></div>
  ${lineBlock('EARNINGS', earnings)}
  ${lineBlock('DEDUCTIONS', deductions)}
  <div class="dash"></div>
  <div class="row"><span>Gross</span><span>${f(slip.gross)}</span></div>
  <div class="row"><span>Deductions</span><span>${f(slip.deductions)}</span></div>
  <div class="row total"><span class="bold">NET PAY</span><span class="bold">${f(slip.net)}</span></div>
  <div class="dash"></div>
  <div class="center small">Thank you</div>
  <div class="center small" style="margin-top:6px">${esc(HEXALYTE_SOFTWARE_FOOTER)}</div>
</body>
</html>`

  return printHtmlDocument(html, {
    targetWindow: opts?.targetWindow,
    popupFeatures: 'width=400,height=700',
    alertOnBlock: 'Please allow pop-ups to print the payslip.',
  })
}

export function PayslipActionsBar({
  onDownload,
  onThermal,
  onPrintA4,
  busy,
}: {
  onDownload: () => void
  onThermal: () => void
  onPrintA4?: () => void
  busy?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={onDownload} className="btn-primary text-sm flex items-center gap-2">
        <Download className="w-4 h-4" /> Download PDF
      </button>
      <button type="button" disabled={busy} onClick={onThermal} className="btn-secondary text-sm flex items-center gap-2">
        <Receipt className="w-4 h-4" /> Thermal print
      </button>
      {onPrintA4 && (
        <button type="button" disabled={busy} onClick={onPrintA4} className="btn-secondary text-sm flex items-center gap-2">
          <Printer className="w-4 h-4" /> Print A4
        </button>
      )}
    </div>
  )
}
