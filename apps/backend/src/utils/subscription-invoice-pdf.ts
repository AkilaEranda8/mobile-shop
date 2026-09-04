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
  dueDate?: Date
  status?: string
  subtotal?: number
  discount?: number
  tax?: number
  paidAt?: Date | null
  paidByName?: string | null
  bank?: {
    bankName?: string
    accountName?: string
    accountNumber?: string
    branch?: string
    swift?: string
  }
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
  const due = input.dueDate
  const plan = planLabel(input.plan)
  const period = periodLabel(input.months)
  const subtotal = input.subtotal ?? input.total
  const discount = input.discount ?? 0
  const tax = input.tax ?? 0
  const bank = input.bank ?? {
    bankName: 'Commercial Bank',
    accountName: 'Hexalyte Innovation (Pvt) Ltd',
    accountNumber: '',
    branch: '',
    swift: '',
  }
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
  if (input.status) text(420, 758, 9, `Status: ${input.status}`)

  rule(48, 748, 547)

  text(48, 728, 8, 'BILL TO')
  text(48, 712, 12, input.shopName, 'F2')
  if (input.ownerName) text(48, 698, 9, input.ownerName)
  if (input.ownerEmail) text(48, 684, 9, input.ownerEmail)

  text(400, 728, 8, 'ISSUE DATE')
  text(400, 712, 10, fmtLk(issue), 'F2')
  text(400, 694, 8, 'DUE DATE')
  text(400, 678, 10, due ? fmtLk(due) : fmtLk(input.periodEnd), 'F2')
  text(400, 660, 8, 'BILLING PERIOD')
  text(400, 644, 9, `${fmtLk(input.periodStart)} - ${fmtLk(input.periodEnd)}`)

  // Table header
  rect(48, 608, 499, 22, '0.97 0.98 0.98')
  text(56, 615, 8, 'DESCRIPTION')
  text(360, 615, 8, 'QTY')
  text(470, 615, 8, 'AMOUNT')

  text(56, 588, 11, `Hexalyte ${plan} Plan`, 'F2')
  text(56, 574, 9, `${period} subscription - ${money(input.mrr)} / month`)
  text(368, 580, 11, String(input.months))
  text(450, 580, 11, money(subtotal), 'F2')

  rule(48, 556, 547)

  text(360, 536, 9, 'Subtotal')
  text(480, 536, 9, money(subtotal))
  text(360, 520, 9, 'Discount')
  text(480, 520, 9, money(discount))
  text(360, 504, 9, 'Tax')
  text(480, 504, 9, money(tax))

  rect(350, 476, 197, 22, '0.07 0.09 0.11')
  lines.push('1 1 1 rg')
  text(360, 483, 10, `Total (${period})`, 'F2')
  text(470, 483, 10, money(input.total), 'F2')
  lines.push('0 0 0 rg')

  if (input.paidAt) {
    text(48, 460, 9, `PAID on ${fmtLk(input.paidAt)}`, 'F2')
    if (input.paidByName) text(48, 446, 9, `Paid by: ${input.paidByName}`)
  }

  text(48, 440, 8, 'BANK TRANSFER DETAILS')
  rect(48, 358, 499, 72, '0.98 0.98 0.98')
  text(60, 410, 9, `Bank: ${bank.bankName || '—'}`)
  text(60, 394, 9, `Account Name: ${bank.accountName || '—'}`)
  text(60, 378, 9, `Account Number: ${bank.accountNumber || '—'}`)
  text(300, 410, 9, `Branch: ${bank.branch || '—'}`)
  text(300, 394, 9, `SWIFT: ${bank.swift || '—'}`)

  text(48, 330, 8, 'Thank you for choosing Hexalyte Innovation (Pvt) Ltd')
  text(48, 316, 8, 'Subscription is extended only after payment is confirmed.')

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
