import { z } from 'zod'

const paymentMethod = z.enum([
  'CASH',
  'CARD',
  'UPI',
  'BANK_TRANSFER',
  'WALLET',
  'CHEQUE',
  'CREDIT',
])

export const createTripSchema = z.object({
  branchId: z.string().min(1).optional(),
  vehicleId: z.string().min(1).optional().nullable(),
  driverUserId: z.string().min(1).optional().nullable(),
  plannedDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  stops: z
    .array(
      z.object({
        dealerId: z.string().min(1),
        salesOrderId: z.string().min(1).optional().nullable(),
        dispatchId: z.string().min(1).optional().nullable(),
        sequence: z.number().int().min(0).optional(),
        notes: z.string().max(1000).optional().nullable(),
      }),
    )
    .min(1),
})

export const addStopSchema = z.object({
  dealerId: z.string().min(1),
  salesOrderId: z.string().min(1).optional().nullable(),
  dispatchId: z.string().min(1).optional().nullable(),
  sequence: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional().nullable(),
})

export const podSchema = z.object({
  outcome: z.enum(['ACCEPT', 'PARTIAL', 'REJECT']),
  recipientName: z.string().max(200).optional().nullable(),
  signatureUrl: z.string().url().optional().nullable().or(z.literal('')),
  photoUrl: z.string().url().optional().nullable().or(z.literal('')),
  notes: z.string().max(2000).optional().nullable(),
  codCollected: z.number().min(0).optional(),
  /** Line-level accepted qty for PARTIAL; omit for full ACCEPT. */
  acceptedLines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive(),
        sellUnit: z.enum(['PIECE', 'BOX', 'CARTON']).optional(),
        sku: z.string().optional().nullable(),
        imei: z.string().optional().nullable(),
        unitPrice: z.number().min(0).optional().nullable(),
        discount: z.number().min(0).optional().nullable(),
      }),
    )
    .optional(),
  payments: z
    .array(
      z.object({
        method: paymentMethod,
        amount: z.number().positive(),
        reference: z.string().optional().nullable(),
      }),
    )
    .optional(),
})

export type CreateTripInput = z.infer<typeof createTripSchema>
export type PodInput = z.infer<typeof podSchema>
