import { prisma } from '../config/database'
import { whatsappService } from '../modules/whatsapp/whatsapp.service'
import { sendMail } from '../utils/mailer'
import { notifyHpReminderSms } from '../modules/sms/sms-notify.service'

let timer: NodeJS.Timeout | null = null
const HOUR = 60 * 60 * 1000

function utcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function resolvePenaltyAmount(agreementLateFee: number, penaltyRules: unknown): number | null {
  const rules = (penaltyRules && typeof penaltyRules === 'object' ? penaltyRules : {}) as Record<string, any>
  if (rules.enabled === false) return null
  const amount = Number(rules.amount)
  if (Number.isFinite(amount) && amount > 0) {
    const max = Number(rules.maxPerInstallment)
    if (Number.isFinite(max) && max > 0) return Math.min(amount, max)
    return amount
  }
  if (agreementLateFee > 0) return agreementLateFee
  return null
}

export async function runHirePurchaseMaintenance() {
  const enabledTenants = await prisma.tenantFeature.findMany({
    where: { feature: 'HIRE_PURCHASE', enabled: true },
    select: { tenantId: true },
  })
  const today = utcDay()
  const tomorrow = new Date(today.getTime() + 86_400_000)

  for (const { tenantId } of enabledTenants) {
    const settings = await prisma.hirePurchaseSettings.findMany({ where: { tenantId } })
    const settingsByBranch = new Map(settings.map(s => [s.branchId, s]))

    const overdue = await prisma.hirePurchaseInstallment.findMany({
      where: { tenantId, dueDate: { lt: today }, status: { in: ['PENDING', 'PARTIAL'] } },
      include: { agreement: true },
    })
    for (const installment of overdue) {
      const graceEnd = new Date(installment.dueDate)
      graceEnd.setUTCDate(graceEnd.getUTCDate() + installment.agreement.gracePeriodDays)
      if (graceEnd >= today) continue
      const branchSettings = settingsByBranch.get(installment.branchId)
      const penaltyAmt = resolvePenaltyAmount(installment.agreement.lateFee, branchSettings?.penaltyRules)
      await prisma.$transaction(async tx => {
        await tx.hirePurchaseInstallment.update({ where: { id: installment.id }, data: { status: 'OVERDUE' } })
        await tx.hirePurchaseAgreement.update({ where: { id: installment.agreementId }, data: { status: 'DEFAULTED' } })
        if (penaltyAmt == null || penaltyAmt <= 0) return
        const exists = await tx.hirePurchasePenalty.findFirst({ where: { installmentId: installment.id, waivedAt: null } })
        if (exists) return
        await tx.hirePurchasePenalty.create({
          data: {
            tenantId,
            branchId: installment.branchId,
            agreementId: installment.agreementId,
            installmentId: installment.id,
            amount: penaltyAmt,
            reason: `Automatic late fee for installment ${installment.sequence}`,
          },
        })
        await tx.hirePurchaseAgreement.update({
          where: { id: installment.agreementId },
          data: { outstandingBalance: { increment: penaltyAmt } },
        })
        await tx.hirePurchaseLog.create({
          data: {
            tenantId,
            branchId: installment.branchId,
            agreementId: installment.agreementId,
            action: 'PENALTY_APPLIED',
            metadata: { installmentId: installment.id, amount: penaltyAmt },
          },
        })
      })
    }

    for (const setting of settings) {
      const config = (setting.reminderSettings ?? {}) as Record<string, any>
      if (config.enabled !== true) continue
      const days: number[] = Array.isArray(config.days) ? config.days.map(Number) : [3, 1, 0, -1]
      const channel = String(config.channel || 'WHATSAPP').toUpperCase()
      const dueRows = await prisma.hirePurchaseInstallment.findMany({
        where: {
          tenantId,
          branchId: setting.branchId,
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          dueDate: {
            gte: new Date(today.getTime() - 30 * 86_400_000),
            lt: new Date(today.getTime() + 8 * 86_400_000),
          },
        },
        include: { agreement: { include: { customer: true } } },
      })
      for (const row of dueRows) {
        const dayOffset = Math.round((row.dueDate.getTime() - today.getTime()) / 86_400_000)
        if (!days.includes(dayOffset)) continue
        const alreadySent = await prisma.hirePurchaseLog.findFirst({
          where: {
            tenantId,
            agreementId: row.agreementId,
            action: 'AUTOMATIC_REMINDER_SENT',
            createdAt: { gte: today, lt: tomorrow },
          },
        })
        if (alreadySent) continue
        const message = `Payment reminder: ${row.agreement.agreementNumber} installment ${row.sequence} has ${row.outstanding.toFixed(2)} due ${row.dueDate.toISOString().slice(0, 10)}.`
        try {
          if (channel === 'EMAIL') {
            if (!row.agreement.customer.email) throw new Error('Customer email missing')
            await sendMail(row.agreement.customer.email, `Payment reminder — ${row.agreement.agreementNumber}`, `<p>${message}</p>`)
          } else if (channel === 'SMS') {
            await notifyHpReminderSms({
              tenantId,
              customerPhone: row.agreement.customer.phone,
              customerName: row.agreement.customer.name,
              agreementNumber: row.agreement.agreementNumber,
              dueAmount: row.outstanding,
              branchId: row.branchId,
            })
          } else {
            await whatsappService.sendTextMessage(tenantId, row.agreement.customer.phone, message)
          }
          await prisma.hirePurchaseLog.create({
            data: {
              tenantId,
              branchId: row.branchId,
              agreementId: row.agreementId,
              action: 'AUTOMATIC_REMINDER_SENT',
              metadata: { installmentId: row.id, dayOffset, channel },
            },
          })
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
