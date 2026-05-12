import nodemailer from 'nodemailer'
import { env } from '../config/env'

const transporter = nodemailer.createTransport({
  host:   env.SMTP_HOST    || 'smtp.gmail.com',
  port:   Number(env.SMTP_PORT || 587),
  secure: Number(env.SMTP_PORT || 587) === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
})

export async function sendMail(to: string, subject: string, html: string) {
  if (!env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new Error('SMTP not configured. Set SMTP_USER and SMTP_PASSWORD in .env')
  }
  return transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to,
    subject,
    html,
  })
}

export function warrantyEmailHtml(w: any, tenantName: string) {
  const start   = new Date(w.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const end     = new Date(w.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const created = new Date(w.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Warranty Certificate</title>
<style>
  body { margin:0; padding:0; background:#f1f5f9; font-family:'Segoe UI',Arial,sans-serif; }
  .wrap { max-width:620px; margin:30px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.10); }
  .header { background:linear-gradient(135deg,#6d28d9,#7c3aed); padding:32px 36px 24px; text-align:center; }
  .header h1 { margin:0; color:#fff; font-size:22px; letter-spacing:.5px; }
  .header p  { margin:4px 0 0; color:#c4b5fd; font-size:13px; }
  .code-badge { display:inline-block; margin:16px auto 0; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.3); border-radius:8px; padding:8px 24px; color:#fff; font-family:monospace; font-size:18px; letter-spacing:2px; }
  .body { padding:28px 36px; }
  .section-title { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#7c3aed; font-weight:700; margin:0 0 10px; }
  .grid { display:table; width:100%; border-collapse:collapse; margin-bottom:20px; }
  .grid-cell { display:table-cell; width:50%; padding:10px 12px; background:#f8f5ff; border:1px solid #ede9fe; vertical-align:top; }
  .grid-cell:first-child { border-radius:8px 0 0 8px; }
  .grid-cell:last-child  { border-radius:0 8px 8px 0; border-left:none; }
  .cell-label { font-size:10px; color:#8b5cf6; margin:0 0 3px; }
  .cell-value { font-size:13px; color:#1e1b4b; font-weight:600; margin:0; }
  .dates { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px 18px; display:table; width:calc(100% - 36px); margin-bottom:20px; }
  .date-cell { display:table-cell; width:50%; }
  .date-label { font-size:10px; color:#16a34a; margin:0 0 2px; }
  .date-value { font-size:13px; color:#14532d; font-weight:700; margin:0; }
  .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:18px 36px; text-align:center; }
  .footer p { margin:0; font-size:11px; color:#94a3b8; }
  .status { display:inline-block; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; letter-spacing:.5px; }
  .status-ACTIVE { background:#dcfce7; color:#16a34a; }
  .status-EXPIRED { background:#f1f5f9; color:#64748b; }
  .status-CLAIMED { background:#dbeafe; color:#1d4ed8; }
  .status-VOID    { background:#fee2e2; color:#dc2626; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🛡️ Warranty Certificate</h1>
    <p>${tenantName}</p>
    <div class="code-badge">${w.warrantyCode}</div>
    <p style="margin:10px 0 0;color:#c4b5fd;font-size:12px;">Issued: ${created} &nbsp;·&nbsp; <span class="status status-${w.status}">${w.status}</span></p>
  </div>

  <div class="body">
    <p class="section-title">Customer Details</p>
    <div class="grid">
      <div class="grid-cell">
        <p class="cell-label">Name</p>
        <p class="cell-value">${w.customerName}</p>
      </div>
      <div class="grid-cell">
        <p class="cell-label">Phone</p>
        <p class="cell-value">${w.customerPhone}</p>
      </div>
    </div>

    <p class="section-title">Product Details</p>
    <div class="grid">
      <div class="grid-cell">
        <p class="cell-label">Product</p>
        <p class="cell-value">${w.productName}</p>
      </div>
      <div class="grid-cell">
        <p class="cell-label">Brand</p>
        <p class="cell-value">${w.brandName || '—'}</p>
      </div>
    </div>
    ${w.imei ? `<div class="grid"><div class="grid-cell" style="width:100%;border-radius:8px;"><p class="cell-label">IMEI / Serial</p><p class="cell-value" style="font-family:monospace">${w.imei}</p></div></div>` : ''}

    <p class="section-title">Warranty Period</p>
    <div class="dates">
      <div class="date-cell">
        <p class="date-label">Start Date</p>
        <p class="date-value">${start}</p>
      </div>
      <div class="date-cell">
        <p class="date-label">End Date</p>
        <p class="date-value">${end}</p>
      </div>
    </div>
    <p style="font-size:12px;color:#64748b;margin:0 0 20px;">Duration: <strong>${w.monthsDuration} month${w.monthsDuration !== 1 ? 's' : ''}</strong>${w.invoiceNumber ? `&nbsp;·&nbsp;Invoice: <strong>${w.invoiceNumber}</strong>` : ''}</p>
  </div>

  <div class="footer">
    <p>This is an official warranty certificate issued by <strong>${tenantName}</strong>.</p>
    <p style="margin-top:4px;">Keep this document safe. Present it when making a warranty claim.</p>
  </div>
</div>
</body>
</html>`
}
