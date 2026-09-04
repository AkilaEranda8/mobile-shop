import { z } from 'zod'

const disposition = z.enum(['RESTOCK', 'DAMAGED', 'QUARANTINE'])

export const createReturnSchema = z.object({
  dealerId: z.string().min(1),
  branchId: z.string().min(1).optional(),
  invoiceId: z.string().min(1).optional().nullable(),
  reason: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1).optional().nullable(),
        productName: z.string().min(1).max(300).optional(),
        sku: z.string().optional().nullable(),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0).optional(),
        imei: z.string().optional().nullable(),
        disposition: disposition.optional(),
      }),
    )
    .min(1),
})

export const dispositionSchema = z.object({
  lines: z
    .array(
      z.object({
        returnLineId: z.string().min(1),
        disposition: disposition,
      }),
    )
    .min(1),
})

export type CreateReturnInput = z.infer<typeof createReturnSchema>
export type DispositionInput = z.infer<typeof dispositionSchema>
