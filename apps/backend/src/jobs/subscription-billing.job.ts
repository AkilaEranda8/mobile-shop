import { processBillingLifecycle, ensureMonthlyInvoiceForTenant } from '../modules/billing/billing.service'
import { prisma } from '../config/database'
import { toColomboDateKey } from '../modules/billing/billing-dates'

const CHECK_EVERY_MS = 15 * 60 * 1000
const BILLING_SLUG = 'hexalyte-billing-internal'

let timer: ReturnType<typeof setInterval> | null = null

/**
 * Generate invoices for ACTIVE tenants whose subscriptionEndsAt is today (Colombo)
 * and who do not yet have an invoice for that period. Idempotent via unique constraint.
 */
async function generateDueMonthlyInvoices(): Promise<number> {
  const today = toColomboDateKey(new Date())
  const windowStart = new Date()
  windowStart.setUTCDate(windowStart.getUTCDate() - 1)
  const windowEnd = new Date()
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1)

  const tenants = await prisma.tenant.findMany({
    where: {
      status: { in: ['ACTIVE', 'SUSPENDED'] },
      slug: { not: BILLING_SLUG },
      mrr: { gt: 0 },
      subscriptionEndsAt: { gte: windowStart, lte: windowEnd },
    },
    select: { id: true, name: true, subscriptionEndsAt: true },
  })

  let created = 0
  for (const t of tenants) {
    if (!t.subscriptionEndsAt) continue
    if (toColomboDateKey(t.subscriptionEndsAt) !== today) continue
    try {
      const before = await prisma.subscriptionInvoice.count({ where: { tenantId: t.id } })
      await ensureMonthlyInvoiceForTenant(t.id)
      const after = await prisma.subscriptionInvoice.count({ where: { tenantId: t.id } })
      if (after > before) {
        created += 1
        console.log(`[billing-lifecycle] invoice generated for ${t.name}`)
      }
    } catch (err: any) {
      console.error(`[billing-lifecycle] invoice gen failed for ${t.name}:`, err?.message ?? err)
    }
  }
  return created
}

export async function processSubscriptionBillingJob(): Promise<{
  invoicesCreated: number
  overdueMarked: number
  graceLogged: number
  suspended: number
}> {
  const invoicesCreated = await generateDueMonthlyInvoices()
  const life = await processBillingLifecycle()
  if (invoicesCreated || life.overdueMarked || life.suspended) {
    console.log(
      `[billing-lifecycle] invoices=${invoicesCreated} overdue=${life.overdueMarked} grace=${life.graceLogged} suspended=${life.suspended}`,
    )
  }
  return { invoicesCreated, ...life }
}

export function startSubscriptionBillingJob(): void {
  void processSubscriptionBillingJob().catch(err => {
    console.error('[billing-lifecycle] initial run failed:', err?.message ?? err)
  })

  timer = setInterval(() => {
    void processSubscriptionBillingJob().catch(err => {
      console.error('[billing-lifecycle] scheduled run failed:', err?.message ?? err)
    })
  }, CHECK_EVERY_MS)

  if (typeof timer.unref === 'function') timer.unref()
  console.log('[billing-lifecycle] job started — invoice gen + overdue/grace/suspend every 15m (Asia/Colombo rules)')
}

export function stopSubscriptionBillingJob(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
