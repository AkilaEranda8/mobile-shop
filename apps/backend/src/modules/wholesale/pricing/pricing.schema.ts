import { z } from 'zod'

export const sellUnitSchema = z.enum(['PIECE', 'BOX', 'CARTON'])

export const createTierSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(40).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const updateTierSchema = createTierSchema.partial()

export const createPriceListSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(40).optional().nullable(),
  tierId: z.string().min(1).optional().nullable(),
  currency: z.string().max(8).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const updatePriceListSchema = createPriceListSchema.partial()

export const createPriceListItemSchema = z.object({
  productId: z.string().min(1),
  unitPrice: z.number().positive(),
  floorPrice: z.number().min(0).optional().nullable(),
  moq: z.number().int().positive().optional().nullable(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
  sellUnit: sellUnitSchema.optional(),
})

export const updatePriceListItemSchema = createPriceListItemSchema.partial()

export const createQtyBreakSchema = z.object({
  qtyFrom: z.number().int().positive(),
  qtyTo: z.number().int().positive().optional().nullable(),
  unitPrice: z.number().positive(),
})

export const updateQtyBreakSchema = createQtyBreakSchema.partial()

export const createDealerOverrideSchema = z.object({
  dealerId: z.string().min(1),
  productId: z.string().min(1),
  unitPrice: z.number().positive(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
  sellUnit: sellUnitSchema.optional().nullable(),
})

export const updateDealerOverrideSchema = createDealerOverrideSchema
  .omit({ dealerId: true, productId: true })
  .partial()

export const resolvePriceQuerySchema = z.object({
  dealerId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  sellUnit: sellUnitSchema.optional(),
})

export type CreateTierInput = z.infer<typeof createTierSchema>
export type UpdateTierInput = z.infer<typeof updateTierSchema>
export type CreatePriceListInput = z.infer<typeof createPriceListSchema>
export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>
export type CreatePriceListItemInput = z.infer<typeof createPriceListItemSchema>
export type UpdatePriceListItemInput = z.infer<typeof updatePriceListItemSchema>
export type CreateQtyBreakInput = z.infer<typeof createQtyBreakSchema>
export type UpdateQtyBreakInput = z.infer<typeof updateQtyBreakSchema>
export type CreateDealerOverrideInput = z.infer<typeof createDealerOverrideSchema>
export type UpdateDealerOverrideInput = z.infer<typeof updateDealerOverrideSchema>
