import { z } from 'zod'

export const submitPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive(),
  channel: z.enum([
    'MANUAL_BANK_TRANSFER',
    'CASH',
    'OTHER',
    'PAYHERE',
    'WEBXPAY',
    'HELAPOS',
    'OTHER_GATEWAY',
  ]).optional().default('MANUAL_BANK_TRANSFER'),
  methodLabel: z.string().max(120).optional(),
  paymentDate: z.coerce.date(),
  bankName: z.string().max(120).optional(),
  accountRef: z.string().max(120).optional(),
  transactionRef: z.string().max(120).optional(),
  slipUrl: z.string().url().optional().or(z.literal('')).optional(),
  slipFilename: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
})

export const rejectPaymentSchema = z.object({
  reason: z.string().min(3).max(1000),
})

export const billingSettingsSchema = z.object({
  graceDays: z.coerce.number().int().min(0).max(60).optional(),
  dueDaysAfterIssue: z.coerce.number().int().min(0).max(31).optional(),
  bank: z.object({
    bankName: z.string().max(120).optional(),
    accountName: z.string().max(120).optional(),
    accountNumber: z.string().max(120).optional(),
    branch: z.string().max(120).optional(),
    swift: z.string().max(40).optional(),
    instructions: z.string().max(2000).optional(),
  }).optional(),
})

export const createInvoiceAdminSchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional().default(1),
  amount: z.coerce.number().min(0).optional(),
  invoiceNo: z.string().max(64).optional(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
})

export const requestPlanUpgradeSchema = z.object({
  targetPlan: z.enum(['STARTER', 'PRO']),
})
