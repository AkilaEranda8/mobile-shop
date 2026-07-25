import { prisma } from '../config/database'
import { whatsappService } from '../modules/whatsapp/whatsapp.service'
import { sendMail } from '../utils/mailer'

let timer: NodeJS.Timeout | null = null
const HOUR = 60 * 60 * 1000

function utcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export async function runHirePurchaseMaintenance() {
  const enabledTenants = await prisma.tenantFeature.findMany({
    where: { feature: 'HIRE_PURCHASE', enabled: true },
    select: { tenantId: true },
  })
  const today = utcDay()
  const tomorrow = new Date(today.getTime() + 86_400_000)

  for (const { tenantId } of enabledTenants) {
    const overdue = await prisma.hirePurchaseInstallment.findMany({
      where: { tenantId, dueDate: { lt: today }, status: { in: ['PENDING', 'PARTIAL'] } },
      include: { agreement: true },
    })
    for (const installment of overdue) {
      const graceEnd = new Date(installment.dueDate)
      graceEnd.setUTCDate(graceEnd.getUTCDate() + installment.agreement.gracePeriodDays)
      if (graceEnd >= today) continue
      await prisma.$transaction(async tx => {
        await tx.hirePurchaseInstallment.update({ where: { id: installment.id }, data: { status: 'OVERDUE' } })
        await tx.hirePurchaseAgreement.update({ where: { id: installment.agreementId }, data: { status: 'DEFAULTED' } })
        if (installment.agreement.lateFee <= 0) return
        const exists = await tx.hirePurchasePenalty.findFirst({ where: { installmentId: installment.id, waivedAt: null } })
        if (exists) return
        await tx.hirePurchasePenalty.create({
          data: {
            tenantId, branchId: installment.branchId, agreementId: installment.agreementId,
            installmentId: installment.id, amount: installment.agreement.lateFee,
            reason: `Automatic late fee for installment ${installment.sequence}`,
          },
        })
        await tx.hirePurchaseAgreement.update({ where: { id: installment.agreementId }, data: { outstandingBalance: { increment: installment.agreement.lateFee } } })
        await tx.hirePurchaseLog.create({ data: { tenantId, branchId: installment.branchId, agreementId: installment.agreementId, action: 'PENALTY_APPLIED', metadata: { installmentId: installment.id, amount: installment.agreement.lateFee } } })
      })
    }

    const settings = await prisma.hirePurchaseSettings.findMany({ where: { tenantId } })
    for (const setting of settings) {
      const config = (setting.reminderSettings ?? {}) as Record<string, any>
      if (config.enabled !== true) continue
      const days: number[] = Array.isArray(config.days) ? config.days.map(Number) : [3, 1, 0, -1]
      const dueRows = await prisma.hirePurchaseInstallment.findMany({
        where: {
          tenantId, branchId: setting.branchId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          dueDate: { gte: new Date(today.getTime() - 30 * 86_400_000), lt: new Date(today.getTime() + 8 * 86_400_000) },
        },
        include: { agreement: { include: { customer: true } } },
      })
      for (const row of dueRows) {
        const dayOffset = Math.round((row.dueDate.getTime() - today.getTime()) / 86_400_000)
        if (!days.includes(dayOffset)) continue
        const alreadySent = await prisma.hirePurchaseLog.findFirst({
          where: { tenantId, agreementId: row.agreementId, action: 'AUTOMATIC_REMINDER_SENT', createdAt: { gte: today, lt: tomorrow } },
        })
        if (alreadySent) continue
        const message = `Payment reminder: ${row.agreement.agreementNumber} installment ${row.sequence} has ${row.outstanding.toFixed(2)} due ${row.dueDate.toISOString().slice(0, 10)}.`
        try {
          if (String(config.channel).toUpperCase() === 'EMAIL' && row.agreement.customer.email) {
            await sendMail(row.agreement.customer.email, `Payment reminder — ${row.agreement.agreementNumber}`, `<p>${message}</p>`)
          } else {
            await whatsappService.sendTextMessage(tenantId, row.agreement.customer.phone, message)
          }
          await prisma.hirePurchaseLog.create({ data: { tenantId, branchId: row.branchId, agreementId: row.agreementId, action: 'AUTOMATIC_REMINDER_SENT', metadata: { installmentId: row.id, dayOffset } } })
        } catch (error) {
          console.warn('[hire-purchase] reminder failed:', error instanceof Error ? error.message : error)
        }
      }
    }
  }
}

export function startHirePurchaseMaintenanceJob() {
  if (timer) return
  void runHirePurchaseMaintenance().catch(error => console.error('[hire-purchase] maintenance failed:', error))
  timer = setInterval(() => {
    void runHirePurchaseMaintenance().catch(error => console.error('[hire-purchase] maintenance failed:', error))
  }, HOUR)
  timer.unref()
}

export function stopHirePurchaseMaintenanceJob() {
  if (timer) clearInterval(timer)
  timer = null
}

