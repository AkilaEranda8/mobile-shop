import { z } from 'zod'

const sellUnit = z.enum(['PIECE', 'BOX', 'CARTON'])

const lineSchema = z.object({
  productId: z.string().min(1).optional().nullable(),
  productName: z.string().min(1).max(300).optional(),
  sku: z.string().max(100).optional().nullable(),
  quantity: z.number().positive(),
  sellUnit: sellUnit.optional(),
  unitPrice: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  notes: z.string().max(1000).optional().nullable(),
})

export const createQuotationSchema = z.object({
  dealerId: z.string().min(1),
  branchId: z.string().min(1).optional().nullable(),
  validityEnd: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  lines: z.array(lineSchema).min(1),
})

export const updateQuotationSchema = createQuotationSchema.partial().extend({
  lines: z.array(lineSchema).min(1).optional(),
})

export const rejectQuotationSchema = z
  .object({
    reason: z.string().max(2000).optional(),
  })
  .default({})

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>
