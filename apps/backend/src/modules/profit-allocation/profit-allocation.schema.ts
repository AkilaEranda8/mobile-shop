import { z } from 'zod'

const noHtml = (v: string) => !/[<>]/.test(v)

export const createFundSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().trim().min(1, 'Fund name is required').max(200).refine(noHtml, 'HTML tags are not allowed'),
  type: z.enum(['FIXED_AMOUNT', 'PERCENTAGE', 'MANUAL']),
  fixedAmount: z.number().min(0).optional().default(0),
  percentage: z.number().min(0).max(100).optional().default(0),
  sortOrder: z.number().int().optional().default(0),
  description: z.string().trim().max(200).refine(noHtml, 'HTML tags are not allowed').optional(),
  isActive: z.boolean().optional().default(true),
})

export const updateFundSchema = createFundSchema.partial().omit({ branchId: true })

export const saveAllocationSchema = z.object({
  branchId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  notes: z.string().trim().max(200).refine(noHtml, 'HTML tags are not allowed').optional(),
})

export const fundMovementSchema = z.object({
  branchId: z.string().min(1),
  fundId: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  notes: z.string().trim().max(200).refine(noHtml, 'HTML tags are not allowed').optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
})

export const adjustmentSchema = fundMovementSchema.extend({
  amount: z.number().refine(v => v !== 0, 'Amount cannot be zero'),
})
