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

export const createOrderSchema = z.object({
  dealerId: z.string().min(1),
  branchId: z.string().min(1).optional().nullable(),
  quotationId: z.string().min(1).optional().nullable(),
  requestedDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  lines: z.array(lineSchema).min(1),
})

export const updateOrderSchema = createOrderSchema.partial().extend({
  lines: z.array(lineSchema).min(1).optional(),
})

export const holdOrderSchema = z.object({
  type: z.enum(['CREDIT', 'MOQ', 'STOCK', 'MANUAL', 'PRICE']),
  reason: z.string().max(1000).optional().nullable(),
})

export const releaseHoldSchema = z
  .object({
    holdId: z.string().min(1).optional(),
  })
  .default({})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>
