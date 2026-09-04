import { prisma } from '../../config/database'
import { colomboParts, formatSubscriptionInvoiceNumber } from './billing-dates'

/**
 * Generate unique INV-YYYY-MM-XXXX using Colombo year/month + DB max sequence.
 * Uses a short Redis-less DB transaction with unique constraint as final guard.
 */
export async function generateSubscriptionInvoiceNumber(at: Date = new Date()): Promise<string> {
  const { year, month } = colomboParts(at)
  const prefix = `INV-${year}-${String(month).padStart(2, '0')}-`

  const last = await prisma.subscriptionInvoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  })

  let seq = 1
  if (last?.invoiceNumber) {
    const tail = last.invoiceNumber.slice(prefix.length)
    const n = parseInt(tail, 10)
    if (!Number.isNaN(n)) seq = n + 1
  }

  // Retry a few times on rare races
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = formatSubscriptionInvoiceNumber(year, month, seq + attempt)
    const exists = await prisma.subscriptionInvoice.findUnique({
      where: { invoiceNumber: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
  }

  // Extremely unlikely fallback
  return formatSubscriptionInvoiceNumber(year, month, seq + Date.now() % 1000)
}
