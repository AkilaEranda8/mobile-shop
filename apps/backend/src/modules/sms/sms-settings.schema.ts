import { z } from 'zod'
import { SMS_EVENT_TYPES, SMS_PROVIDER_IDS } from './sms-settings.util'

const smsTemplateSchema = z.object({
  enabled: z.boolean().optional(),
  body: z.string().max(500).optional(),
})

export const updateSmsSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(SMS_PROVIDER_IDS).optional(),
  apiKey: z.string().max(256).optional(),
  apiSecret: z.string().max(256).optional(),
  senderId: z.string().max(256).optional(),
  validatePhones: z.boolean().optional(),
  storeFullBody: z.boolean().optional(),
  templates: z.object({
    sale: smsTemplateSchema.optional(),
    repair: smsTemplateSchema.optional(),
    hpReminder: smsTemplateSchema.optional(),
    delivery: smsTemplateSchema.optional(),
    saleCredit: smsTemplateSchema.optional(),
    repairCredit: smsTemplateSchema.optional(),
  }).optional(),
})

export const sendSmsTestSchema = z.object({
  phone: z.string().min(9).max(20),
  message: z.string().min(1).max(500).optional(),
})

export const sendSmsMessageSchema = z.object({
  phone: z.string().min(9).max(20),
  message: z.string().min(1).max(500),
  customerName: z.string().max(120).optional(),
})

export const sendSaleSmsSchema = z.object({
  saleId: z.string().min(1).max(64),
  phone: z.string().min(9).max(20).optional(),
})

export const sendRepairSmsSchema = z.object({
  repairId: z.string().min(1).max(64),
  phone: z.string().min(9).max(20).optional(),
})

export const SMS_EVENT_LABELS: Record<(typeof SMS_EVENT_TYPES)[number], string> = {
  sale: 'New sale',
  repair: 'Repair complete',
  hpReminder: 'Hire Purchase reminder',
  delivery: 'Delivery update',
}
