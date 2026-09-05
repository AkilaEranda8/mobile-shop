import { z } from 'zod'

const channelsSchema = z.object({
  sms: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
}).optional()

export const updateCreditControlSchema = z.object({
  reminder: z.object({
    enabled: z.boolean().optional(),
    minDaysOverdue: z.number().int().min(0).max(365).optional(),
    cooldownDays: z.number().int().min(0).max(90).optional(),
    channels: z.object({
      sms: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
    }).optional(),
  }).optional(),
  whatsappTemplate: z.object({
    enabled: z.boolean().optional(),
    body: z.string().max(1000).optional(),
  }).optional(),
})

export const creditReminderSendSchema = z.object({
  sms: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
})

export type UpdateCreditControlInput = z.infer<typeof updateCreditControlSchema>
export type CreditReminderSendInput = z.infer<typeof creditReminderSendSchema>
export { channelsSchema }
