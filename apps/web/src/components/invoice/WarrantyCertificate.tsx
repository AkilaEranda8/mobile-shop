'use client'

import React, { forwardRef, useRef } from 'react'
import type { Warranty } from '@/types'
import type { InvoiceSettings } from '@/lib/invoiceSettings'

interface WarrantyCertificateProps {
  warranty:  Warranty
  settings:  InvoiceSettings
  hideControls?: boolean
}

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function daysLeft(endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)
}

// ── Printable HTML generator ───────────────────────────────────────────────

export function printWarrantyCertificate(warranty: Warranty, settings: InvoiceSettings) {
  const left = daysLeft(warranty.endDate)
  const total = warranty.monthsDuration * 30
  const elapsed = total - left
  const progress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))

  const statusColor = {
    ACTIVE:  '#16a34a',
    EXPIRED: '#64748b',
    CLAIMED: '#2563eb',
    VOID:    '#dc2626',
  }[warranty.status] ?? '#64748b'

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Warranty Certificate – ${warranty.warrantyCode}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#1e293b; }
    @media print {
      @page { size: A4 portrait; margin: 0; }
      body  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    .page {
      width: 794px; min-height: 1123px; margin: 0 auto;
      display: flex; flex-direction: column;
    }
    .top-bar { height: 8px; background: linear-gradient(90deg,#1e1b4b,#4f46e5,var(--brand-primary),#4f46e5,#1e1b4b); }
    .header { padding: 36px 50px 28px; border-bottom: 2px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
    .logo-area { display:flex; align-items:center; gap:14px; }
    .logo-area img { height:72px; width:72px; object-fit:contain; }
    .company-name { font-size:20px; font-weight:800; color:#1e1b4b; letter-spacing:.3px; }
    .company-sub  { font-size:10px; color:#64748b; letter-spacing:1px; text-transform:uppercase; margin-top:2px; }
    .cert-title   { text-align:right; }
    .cert-title h1 { font-size:22px; font-weight:900; color:#3730a3; letter-spacing:1.5px; text-transform:uppercase; }
    .cert-title p  { font-size:10px; color:#94a3b8; letter-spacing:.8px; margin-top:3px; }

    .badge-row { background: linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%); padding:22px 50px; display:flex; align-items:center; justify-content:space-between; }
    .wcode { font-family:'Courier New',monospace; font-size:24px; font-weight:800; color:#a5b4fc; letter-spacing:4px; }
    .wcode-label { font-size:9px; color:#6366f1; letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; }
    .status-badge { padding:6px 20px; border-radius:99px; font-size:11px; font-weight:700; letter-spacing:1px; border:2px solid; color:#fff; }

    .body { padding:30px 50px; flex:1; }
    .section-title { font-size:9px; font-weight:700; color:#6366f1; letter-spacing:2px; text-transform:uppercase; margin-bottom:10px; border-left:3px solid #6366f1; padding-left:8px; }
    .cards-row { display:flex; gap:12px; margin-bottom:22px; }
    .card { flex:1; background:#f8f7ff; border:1px solid #e0e7ff; border-radius:10px; padding:12px 14px; }
    .card-label { font-size:9px; color:#6366f1; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
    .card-value { font-size:13px; font-weight:700; color:#1e1b4b; }
    .card-sub   { font-size:10px; color:#94a3b8; margin-top:2px; }

    .period-box { background: linear-gradient(135deg,#f0fdf4,#dcfce7); border:1.5px solid #86efac; border-radius:12px; padding:18px 22px; margin-bottom:22px; }
    .period-grid { display:flex; gap:0; }
    .period-item { flex:1; padding:0 16px; border-right:1px solid #bbf7d0; }
    .period-item:first-child { padding-left:0; }
    .period-item:last-child  { border-right:none; }
    .period-label { font-size:9px; color:#16a34a; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px; }
    .period-value { font-size:13px; font-weight:700; color:#14532d; }

    .progress-wrap { margin-top:14px; }
    .progress-label { display:flex; justify-content:space-between; font-size:9px; color:#16a34a; margin-bottom:4px; }
    .progress-bar   { height:6px; background:#bbf7d0; border-radius:99px; overflow:hidden; }
    .progress-fill  { height:100%; border-radius:99px; background:linear-gradient(90deg,#16a34a,#4ade80); }

    .imei-box { background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; padding:10px 14px; margin-bottom:22px; display:flex; align-items:center; gap:10px; }
    .imei-label { font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:1px; }
    .imei-value { font-size:13px; font-weight:700; color:#0f172a; font-family:'Courier New',monospace; letter-spacing:1px; }

    .terms-box { background:#fafafa; border:1px solid #e2e8f0; border-radius:10px; padding:16px 18px; margin-bottom:22px; }
    .terms-title { font-size:9px; font-weight:700; color:#475569; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px; }
    .terms-list { list-style:decimal; padding-left:16px; }
    .terms-list li { font-size:10px; color:#64748b; line-height:1.6; }

    .sig-row { display:flex; gap:40px; margin-bottom:24px; }
    .sig-item { flex:1; text-align:center; }
    .sig-line  { border-bottom:1.5px solid #334155; margin-bottom:6px; height:40px; }
    .sig-name  { font-size:11px; font-weight:700; color:#1e293b; }
    .sig-title { font-size:9px; color:#94a3b8; letter-spacing:.5px; margin-top:2px; }

    .footer { background:#f1f5f9; border-top:2px solid #e2e8f0; padding:14px 50px; display:flex; justify-content:space-between; align-items:center; }
    .footer-left  { font-size:9px; color:#94a3b8; max-width:380px; line-height:1.5; }
    .footer-right { font-size:9px; color:#94a3b8; text-align:right; }
    .bottom-bar { height:5px; background:linear-gradient(90deg,#1e1b4b,#4f46e5,var(--brand-primary),#4f46e5,#1e1b4b); }
  </style>
</head>
<body>
<div class="page">
  <div class="top-bar"></div>

  <!-- HEADER -->
  <div class="header">
    <div class="logo-area">
      ${settings.logo ? `<img src="${settings.logo}" alt="logo"/>` : `<div style="width:72px;height:72px;background:#e0e7ff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:28px;">🛡️</div>`}
      <div>
        <div class="company-name">${settings.shopName || 'Company Name'}</div>
        ${settings.slogan ? `<div class="company-sub">${settings.slogan}</div>` : ''}
        ${settings.phone  ? `<div style="font-size:10px;color:#64748b;margin-top:4px;">${settings.phone}</div>` : ''}
        ${settings.email  ? `<div style="font-size:10px;color:#64748b;">${settings.email}</div>` : ''}
      </div>
    </div>
    <div class="cert-title">
      <h1>WARRANTY<br>CERTIFICATE</h1>
      <p>OFFICIAL WARRANTY DOCUMENT</p>
      ${warranty.invoiceNumber ? `<p style="margin-top:6px;font-size:10px;color:#475569;">Invoice: <strong>${warranty.invoiceNumber}</strong></p>` : ''}
    </div>
  </div>

  <!-- WARRANTY CODE BADGE -->
  <div class="badge-row" style="justify-content:center;gap:60px;">
    <div style="text-align:center;">
      <div class="wcode-label">Warranty Code</div>
      <div class="wcode">${warranty.warrantyCode}</div>
    </div>
    <div style="text-align:center;">
      <div class="wcode-label">Issued On</div>
      <div style="font-size:13px;font-weight:700;color:#c7d2fe;">${fmtDate(warranty.createdAt)}</div>
    </div>
    <div style="text-align:center;">
      <div class="wcode-label">Status</div>
      <div class="status-badge" style="background:${statusColor};border-color:${statusColor};">
        ${warranty.status}
      </div>
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- Customer -->
    <div class="section-title">Customer Details</div>
    <div class="cards-row">
      <div class="card">
        <div class="card-label">Customer Name</div>
        <div class="card-value">${warranty.customerName}</div>
      </div>
      <div class="card">
        <div class="card-label">Contact Number</div>
        <div class="card-value">${warranty.customerPhone}</div>
      </div>
    </div>

    <!-- Product -->
    <div class="section-title">Product Details</div>
    <div class="cards-row">
      <div class="card" style="flex:2">
        <div class="card-label">Product Name</div>
        <div class="card-value">${warranty.productName}</div>
        <div class="card-sub">${warranty.brandName || ''}</div>
      </div>
      <div class="card">
        <div class="card-label">Brand</div>
        <div class="card-value">${warranty.brandName || '—'}</div>
      </div>
    </div>
    ${warranty.imei ? `
    <div class="imei-box">
      <div>
        <div class="imei-label">IMEI / Serial Number</div>
        <div class="imei-value">${warranty.imei}</div>
      </div>
    </div>` : ''}

    <!-- Warranty Period -->
    <div class="section-title">Warranty Period</div>
    <div class="period-box">
      <div class="period-grid">
        <div class="period-item">
          <div class="period-label">Start Date</div>
          <div class="period-value">${fmtDate(warranty.startDate)}</div>
        </div>
        <div class="period-item">
          <div class="period-label">End Date</div>
          <div class="period-value">${fmtDate(warranty.endDate)}</div>
        </div>
        <div class="period-item" style="border-right:none;">
          <div class="period-label">Duration</div>
          <div class="period-value">${warranty.monthsDuration} Month${warranty.monthsDuration > 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>

    <!-- Terms -->
    <div class="section-title">Terms &amp; Conditions</div>
    <div class="terms-box">
      <ul class="terms-list">
        <li>This warranty covers manufacturing defects and hardware failures under normal usage conditions.</li>
        <li>Warranty is void if the product has been physically damaged, misused, or tampered with.</li>
        <li>Please present this certificate along with a valid purchase invoice when making a warranty claim.</li>
        <li>Warranty claims are subject to inspection and approval by our technical team.</li>
        <li>This warranty does not cover consumable parts, accessories, or damage caused by accidents.</li>
      </ul>
    </div>

    <!-- Signature -->
    <div class="sig-row">
      <div class="sig-item">
        <div class="sig-line"></div>
        <div class="sig-name">${settings.signatoryName || settings.shopName || 'Authorized Person'}</div>
        <div class="sig-title">${settings.signatoryTitle || 'Authorized Signatory'}</div>
      </div>
      <div class="sig-item" style="flex:2;display:flex;align-items:center;justify-content:center;">
        <div style="width:90px;height:90px;border:2px solid #e0e7ff;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f7ff;">
          <div style="font-size:9px;color:#6366f1;text-align:center;font-weight:700;letter-spacing:.5px;line-height:1.4;">OFFICIAL<br>STAMP</div>
        </div>
      </div>
      <div class="sig-item">
        <div class="sig-line"></div>
        <div class="sig-name">${warranty.customerName}</div>
        <div class="sig-title">Customer Signature</div>
      </div>
    </div>

  </div><!-- /body -->

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-left">
      This is an official warranty certificate issued by <strong>${settings.shopName || 'the company'}</strong>.
      Keep this document safe and present it when making a warranty claim.
      ${settings.address ? `<br>${settings.address}` : ''}
    </div>
    <div class="footer-right">
      ${settings.phone   ? `📞 ${settings.phone}<br>` : ''}
      ${settings.email   ? `✉ ${settings.email}<br>` : ''}
      ${settings.website ? `🌐 ${settings.website}` : ''}
    </div>
  </div>
  <div class="bottom-bar"></div>
</div>
</body></html>`

  const win = window.open('', '_blank', 'width=850,height=1100')
  if (!win) { alert('Please allow pop-ups to print the certificate.'); return }
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print(); win.close() }
}

// ── React forwardRef component (for PDF capture with html2canvas) ──────────

const WarrantyCertificate = forwardRef<HTMLDivElement, WarrantyCertificateProps>(
  function WarrantyCertificate({ warranty, settings, hideControls = false }, ref) {
    const localRef  = useRef<HTMLDivElement>(null)
    const certRef   = (ref as React.RefObject<HTMLDivElement>) ?? localRef
    const left      = daysLeft(warranty.endDate)
    const total     = warranty.monthsDuration * 30
    const elapsed   = total - left
    const progress  = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))

    const statusColor: Record<string, string> = {
      ACTIVE:  '#16a34a',
      EXPIRED: '#64748b',
      CLAIMED: '#2563eb',
      VOID:    '#dc2626',
    }

    const handleDownload = async () => {
      if (!certRef.current) return
      try {
        const html2canvas = (await import('html2canvas')).default
        const jsPDF = (await import('jspdf')).default
        const canvas = await html2canvas(certRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' })
        const pw = pdf.internal.pageSize.getWidth()
        const ph = pdf.internal.pageSize.getHeight()
        const iw = canvas.width / 2
        const ih = canvas.height / 2
        const scale = Math.min(pw / iw, ph / ih)
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, iw * scale, ih * scale)
        pdf.save(`Warranty_${warranty.warrantyCode}.pdf`)
      } catch { /* silent */ }
    }

    return (
      <div className={hideControls ? '' : 'min-h-screen bg-gray-100 py-8 px-4'}>
        {!hideControls && (
          <div className="flex items-center justify-center gap-3 mb-6 print:hidden">
            <button onClick={() => printWarrantyCertificate(warranty, settings)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1e1b4b] text-white rounded-lg text-sm font-medium hover:bg-[#312e81] transition-colors shadow">
              Print Certificate
            </button>
            <button onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow">
              Download PDF
            </button>
          </div>
        )}

        <div ref={certRef} style={{ fontFamily: "'Segoe UI', Arial, sans-serif", background: '#fff', width: '794px', minHeight: '1123px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
          {/* Top colour bar */}
          <div style={{ height: 8, background: 'linear-gradient(90deg,#1e1b4b,#4f46e5,var(--brand-primary),#4f46e5,#1e1b4b)' }} />

          {/* ── Header ── */}
          <div style={{ padding: '36px 50px 28px', borderBottom: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {settings.logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={settings.logo} alt="logo" style={{ width: 72, height: 72, objectFit: 'contain' }} />
                : <div style={{ width: 72, height: 72, background: '#e0e7ff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🛡️</div>}
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1e1b4b', letterSpacing: '.3px' }}>{settings.shopName || 'Company Name'}</div>
                {settings.slogan && <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginTop: 2 }}>{settings.slogan}</div>}
                {settings.phone  && <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{settings.phone}</div>}
                {settings.email  && <div style={{ fontSize: 10, color: '#64748b' }}>{settings.email}</div>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#3730a3', letterSpacing: '1.5px', lineHeight: 1.2 }}>WARRANTY<br/>CERTIFICATE</div>
              <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '.8px', marginTop: 3 }}>OFFICIAL WARRANTY DOCUMENT</div>
              {warranty.invoiceNumber && <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>Invoice: <strong>{warranty.invoiceNumber}</strong></div>}
            </div>
          </div>

          {/* ── Code badge row ── */}
          <div style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)', padding: '22px 50px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#6366f1', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Warranty Code</div>
              <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 800, color: '#a5b4fc', letterSpacing: 4 }}>{warranty.warrantyCode}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#6366f1', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Issued On</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c7d2fe' }}>{fmtDate(warranty.createdAt)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#6366f1', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
              <div style={{ padding: '6px 20px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: 1, background: statusColor[warranty.status] ?? '#64748b', color: '#fff', display: 'inline-block' }}>
                {warranty.status}
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: '30px 50px', flex: 1 }}>

            {/* Customer */}
            <div style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, borderLeft: '3px solid #6366f1', paddingLeft: 8 }}>Customer Details</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
              {[{ label: 'Customer Name', value: warranty.customerName }, { label: 'Contact Number', value: warranty.customerPhone }].map(({ label, value }) => (
                <div key={label} style={{ flex: 1, background: '#f8f7ff', border: '1px solid #e0e7ff', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 9, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Product */}
            <div style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, borderLeft: '3px solid #6366f1', paddingLeft: 8 }}>Product Details</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: warranty.imei ? 12 : 22 }}>
              <div style={{ flex: 2, background: '#f8f7ff', border: '1px solid #e0e7ff', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 9, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Product Name</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>{warranty.productName}</div>
                {warranty.brandName && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{warranty.brandName}</div>}
              </div>
              <div style={{ flex: 1, background: '#f8f7ff', border: '1px solid #e0e7ff', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 9, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Brand</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>{warranty.brandName || '—'}</div>
              </div>
            </div>
            {warranty.imei && (
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '10px 14px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>IMEI / Serial Number</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', letterSpacing: 1 }}>{warranty.imei}</div>
                </div>
              </div>
            )}

            {/* Warranty Period */}
            <div style={{ fontSize: 9, fontWeight: 700, color: '#16a34a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, borderLeft: '3px solid #16a34a', paddingLeft: 8 }}>Warranty Period</div>
            <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1.5px solid #86efac', borderRadius: 12, padding: '18px 22px', marginBottom: 22 }}>
              <div style={{ display: 'flex', gap: 0 }}>
                {[
                  { label: 'Start Date', value: fmtDate(warranty.startDate) },
                  { label: 'End Date',   value: fmtDate(warranty.endDate) },
                  { label: 'Duration',   value: `${warranty.monthsDuration} Month${warranty.monthsDuration > 1 ? 's' : ''}` },
                ].map(({ label, value }, i, arr) => (
                  <div key={label} style={{ flex: 1, paddingLeft: i === 0 ? 0 : 16, paddingRight: 16, borderRight: i < arr.length - 1 ? '1px solid #bbf7d0' : 'none' }}>
                    <div style={{ fontSize: 9, color: '#16a34a', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#14532d' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Terms */}
            <div style={{ fontSize: 9, fontWeight: 700, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, borderLeft: '3px solid #94a3b8', paddingLeft: 8 }}>Terms &amp; Conditions</div>
            <div style={{ background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 24 }}>
              <ol style={{ paddingLeft: 16 }}>
                {[
                  'This warranty covers manufacturing defects and hardware failures under normal usage conditions.',
                  'Warranty is void if the product has been physically damaged, misused, or tampered with.',
                  'Please present this certificate along with a valid purchase invoice when making a warranty claim.',
                  'Warranty claims are subject to inspection and approval by our technical team.',
                  'This warranty does not cover consumable parts, accessories, or damage caused by accidents.',
                ].map((t, i) => (
                  <li key={i} style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>{t}</li>
                ))}
              </ol>
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', gap: 40, marginBottom: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 40, borderBottom: '1.5px solid #334155', marginBottom: 6 }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>{settings.signatoryName || settings.shopName || 'Authorized Person'}</div>
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{settings.signatoryTitle || 'Authorized Signatory'}</div>
              </div>
              <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 90, height: 90, border: '2px solid #e0e7ff', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f7ff' }}>
                  <div style={{ fontSize: 9, color: '#6366f1', textAlign: 'center', fontWeight: 700, letterSpacing: '.5px', lineHeight: 1.4 }}>OFFICIAL<br/>STAMP</div>
                </div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 40, borderBottom: '1.5px solid #334155', marginBottom: 6 }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>{warranty.customerName}</div>
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Customer Signature</div>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{ background: '#f1f5f9', borderTop: '2px solid #e2e8f0', padding: '14px 50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', maxWidth: 380, lineHeight: 1.5 }}>
              This is an official warranty certificate issued by <strong>{settings.shopName || 'the company'}</strong>.
              Keep this document safe and present it when making a warranty claim.
              {settings.address && <><br />{settings.address}</>}
            </div>
            <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'right' }}>
              {settings.phone   && <div>📞 {settings.phone}</div>}
              {settings.email   && <div>✉ {settings.email}</div>}
              {settings.website && <div>🌐 {settings.website}</div>}
            </div>
          </div>
          <div style={{ height: 5, background: 'linear-gradient(90deg,#1e1b4b,#4f46e5,var(--brand-primary),#4f46e5,#1e1b4b)' }} />
        </div>
      </div>
    )
  }
)

WarrantyCertificate.displayName = 'WarrantyCertificate'
export default WarrantyCertificate
