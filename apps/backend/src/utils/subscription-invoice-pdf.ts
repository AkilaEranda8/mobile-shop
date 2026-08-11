/** Minimal A4 PDF for Hexalyte subscription invoices (no extra deps). */

export interface SubscriptionInvoicePdfInput {
  invoiceNo: string
  shopName: string
  ownerName: string
  ownerEmail?: string | null
  plan: string
  months: number
  mrr: number
  total: number
  periodStart: Date
  periodEnd: Date
  issueDate?: Date
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function money(n: number): string {
  return `Rs.${Math.round(n).toLocaleString('en-LK')}`
}

function fmtLk(d: Date): string {
  return d.toLocaleDateString('en-LK', {
    timeZone: 'Asia/Colombo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function periodLabel(months: number): string {
  if (months === 12) return '1 Year'
  if (months === 1) return '1 Month'
  return `${months} Months`
}

function planLabel(plan: string): string {
  return plan.charAt(0) + plan.slice(1).toLowerCase()
}

export function buildSubscriptionInvoicePdf(input: SubscriptionInvoicePdfInput): Buffer {
  const issue = input.issueDate ?? new Date()
  const plan = planLabel(input.plan)
  const period = periodLabel(input.months)
  const lines: string[] = []

  const text = (x: number, y: number, size: number, str: string, font: 'F1' | 'F2' = 'F1') => {
    lines.push(`BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfEscape(str)}) Tj ET`)
  }

  const rect = (x: number, y: number, w: number, h: number, fill?: string) => {
    if (fill) lines.push(`${fill} rg ${x} ${y} ${w} ${h} re f 0 0 0 rg`)
    else lines.push(`${x} ${y} ${w} ${h} re S`)
  }

  const rule = (x1: number, y: number, x2: number) => {
    lines.push(`${x1} ${y} m ${x2} ${y} l S`)
  }

  // Header
  text(48, 790, 14, 'Hexalyte Innovation (Pvt) Ltd', 'F2')
  text(48, 774, 9, 'www.hexalyte.com  |  info@hexalyte.com  |  +94 70 3130100')
  text(420, 790, 22, 'INVOICE', 'F2')
  text(420, 772, 10, `#${input.invoiceNo}`)

  rule(48, 758, 547)

  text(48, 738, 8, 'BILL TO')
  text(48, 722, 12, input.shopName, 'F2')
  if (input.ownerName) text(48, 708, 9, input.ownerName)
  if (input.ownerEmail) text(48, 694, 9, input.ownerEmail)

  text(400, 738, 8, 'ISSUE DATE')
  text(400, 722, 10, fmtLk(issue), 'F2')
  text(400, 704, 8, 'PERIOD END')
  text(400, 688, 10, fmtLk(input.periodEnd), 'F2')

  // Table header
  rect(48, 648, 499, 22, '0.97 0.98 0.98')
  text(56, 655, 8, 'DESCRIPTION')
  text(360, 655, 8, 'QTY')
  text(470, 655, 8, 'AMOUNT')

  text(56, 628, 11, `Hexalyte ${plan} Plan`, 'F2')
  text(56, 614, 9, `${period} subscription - ${money(input.mrr)} / month`)
  text(56, 600, 9, `Period: ${fmtLk(input.periodStart)}  -  ${fmtLk(input.periodEnd)}`)
  text(368, 620, 11, String(input.months))
  text(450, 620, 11, money(input.total), 'F2')

  rule(48, 586, 547)

  text(360, 566, 9, `Subtotal (${input.months} × ${money(input.mrr)})`)
  text(480, 566, 9, money(input.total))
  text(360, 550, 9, 'Tax (0%)')
  text(480, 550, 9, 'Rs.0')

  rect(350, 522, 197, 22, '0.07 0.09 0.11')
  lines.push('1 1 1 rg')
  text(360, 529, 10, `Total (${period})`, 'F2')
  text(470, 529, 10, money(input.total), 'F2')
  lines.push('0 0 0 rg')

  text(48, 500, 8, 'BANK TRANSFER DETAILS')
  rect(48, 418, 499, 72, '0.98 0.98 0.98')
  text(60, 470, 9, 'Bank: Commercial Bank')
  text(60, 454, 9, 'Account Name: Akila Eranda Gankewela')
  text(60, 438, 9, 'Account Number: 2000124779')
  text(300, 470, 9, 'SWIFT: CCEYLKLX')

  text(48, 390, 8, 'Thank you for choosing Hexalyte Innovation (Pvt) Ltd')
  text(48, 376, 8, 'Subscription is extended only after payment is confirmed.')

  const stream = lines.join('\n') + '\n'
  const objects: string[] = []
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n')
  objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n')
  objects.push(
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >> endobj\n',
  )
  objects.push(`4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}endstream\nendobj\n`)
  objects.push('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n')
  objects.push('6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj\n')

  let offset = '%PDF-1.4\n'.length
  const xref: number[] = [0]
  let body = '%PDF-1.4\n'
  for (const obj of objects) {
    xref.push(offset)
    body += obj
    offset += Buffer.byteLength(obj)
  }
  const xrefStart = offset
  let xrefTable = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const pos of xref.slice(1)) {
    xrefTable += `${String(pos).padStart(10, '0')} 00000 n \n`
  }
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  return Buffer.from(body + xrefTable + trailer)
}
