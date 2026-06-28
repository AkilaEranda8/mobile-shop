import { z } from 'zod'

export const stockTransferSchema = z.object({
  productId: z.string().min(1),
  fromBranchId: z.string().min(1),
  toBranchId: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: z.string().max(500).optional(),
  variationKey: z.string().min(1).optional(),
  imeis: z.array(z.string().min(8)).min(1).optional(),
})
