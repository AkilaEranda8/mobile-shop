import { prisma } from '../config/database'
import { customerCreditControlService } from '../modules/customers/customer-credit-control.service'

let timer: NodeJS.Timeout | null = null
const HOUR = 60 * 60 * 1000

export async function runCustomerCreditReminderJob() {
  const [featureRows, trialTenants] = await Promise.all([
    prisma.tenantFeature.findMany({
      where: { feature: 'CUSTOMER_CREDIT', enabled: true },
      select: { tenantId: true },
    }),
    prisma.tenant.findMany({
      where: { status: 'TRIAL' },
      select: { id: true },
    }),
  ])

  const tenantIds = Array.from(
    new Set([...featureRows.map(r => r.tenantId), ...trialTenants.map(t => t.id)]),
  )

  for (const tenantId of tenantIds) {
    try {
      const result = await customerCreditControlService.runAutomatedForTenant(tenantId)
      if (result && !('skipped' in result && result.skipped === true) && result.sent) {
        console.log(
          `[customer-credit] tenant=${tenantId} sent=${result.sent} skipped=${result.skippedCount} failed=${result.failed}`,
        )
      }
    } catch (error) {
      console.warn(
        `[customer-credit] reminder failed for ${tenantId}:`,
        error instanceof Error ? error.message : error,
      )
    }
  }
}

export function startCustomerCreditReminderJob() {
  if (timer) return
  void runCustomerCreditReminderJob().catch(error =>
    console.error('[customer-credit] job failed:', error),
  )
  timer = setInterval(() => {
    void runCustomerCreditReminderJob().catch(error =>
      console.error('[customer-credit] job failed:', error),
    )
  }, HOUR)
  timer.unref()
}

export function stopCustomerCreditReminderJob() {
  if (!timer) return
  clearInterval(timer)
  timer = null
}
