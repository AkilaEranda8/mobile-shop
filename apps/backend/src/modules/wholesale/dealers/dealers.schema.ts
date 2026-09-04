import { z } from 'zod'

const dealerStatus = z.enum(['DRAFT', 'ACTIVE', 'ON_HOLD', 'SUSPENDED', 'CLOSED'])

export const createDealerSchema = z.object({
  dealerCode: z.string().min(1).max(64).optional(),
  legalName: z.string().min(1).max(200),
  tradingName: z.string().max(200).optional().nullable(),
  phone: z.string().min(3).max(40),
  email: z.string().email().optional().nullable().or(z.literal('')),
  taxId: z.string().max(64).optional().nullable(),
  branchId: z.string().min(1).optional().nullable(),
  creditLimit: z.number().min(0).optional(),
  paymentTermsDays: z.number().int().min(0).optional(),
  cashOnly: z.boolean().optional(),
  assignedSalesRepId: z.string().min(1).optional().nullable(),
  tierId: z.string().min(1).optional().nullable(),
  customerId: z.string().min(1).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: dealerStatus.optional(),
})

export const updateDealerSchema = createDealerSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const dealerStatusActionSchema = z
  .object({
    notes: z.string().max(2000).optional(),
  })
  .default({})

export type CreateDealerInput = z.infer<typeof createDealerSchema>
export type UpdateDealerInput = z.infer<typeof updateDealerSchema>
