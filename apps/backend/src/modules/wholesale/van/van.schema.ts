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
const sellUnit = z.enum(['PIECE', 'BOX', 'CARTON'])

export const createVehicleSchema = z.object({
  plateNumber: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  homeBranchId: z.string().min(1),
  assignedRepUserId: z.string().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
})

export const updateVehicleSchema = createVehicleSchema.partial()

export const createRepSchema = z.object({
  userId: z.string().min(1),
  territoryId: z.string().min(1).optional().nullable(),
  defaultVehicleId: z.string().min(1).optional().nullable(),
  monthlyTarget: z.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
})

export const updateRepSchema = createRepSchema.partial().omit({ userId: true })

export const vanLoadSchema = z.object({
  vehicleId: z.string().min(1),
  fromBranchId: z.string().min(1).optional(),
  notes: z.string().max(2000).optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        variationKey: z.string().optional(),
        imeis: z.array(z.string().min(8)).optional(),
      }),
    )
    .min(1),
})

export const vanSaleSchema = z.object({
  dealerId: z.string().min(1),
  vehicleId: z.string().min(1),
  visitId: z.string().min(1).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive(),
        sellUnit: sellUnit.optional(),
        sku: z.string().optional().nullable(),
        imei: z.string().optional().nullable(),
        unitPrice: z.number().min(0).optional().nullable(),
        discount: z.number().min(0).optional().nullable(),
      }),
    )
    .min(1),
  payments: z
    .array(
      z.object({
        method: paymentMethod,
        amount: z.number().positive(),
        reference: z.string().optional().nullable(),
      }),
    )
    .min(1),
})

export const createSettlementSchema = z.object({
  vehicleId: z.string().min(1),
  repUserId: z.string().min(1).optional(),
  settlementDate: z.string().optional(),
  branchId: z.string().min(1).optional().nullable(),
  expectedCash: z.number().min(0).optional(),
  declaredCash: z.number().min(0).optional(),
  notes: z.string().max(2000).optional().nullable(),
  paymentBuckets: z
    .array(
      z.object({
        method: paymentMethod,
        amount: z.number().min(0),
      }),
    )
    .optional(),
})

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>
export type CreateRepInput = z.infer<typeof createRepSchema>
export type UpdateRepInput = z.infer<typeof updateRepSchema>
export type VanLoadInput = z.infer<typeof vanLoadSchema>
export type VanSaleInput = z.infer<typeof vanSaleSchema>
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>

export const upsertVisitSchema = z.object({
  id: z.string().min(1).optional(),
  dealerId: z.string().min(1),
  vehicleId: z.string().min(1).optional().nullable(),
  status: z.enum(['PLANNED', 'CHECKED_IN', 'COMPLETED', 'SKIPPED', 'CANCELLED']).optional(),
  plannedAt: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  checkIn: z.boolean().optional(),
  complete: z.boolean().optional(),
})

export type UpsertVisitInput = z.infer<typeof upsertVisitSchema>
