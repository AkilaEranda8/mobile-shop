import { z } from 'zod'

export const createPickListSchema = z.object({
  salesOrderId: z.string().min(1),
  branchId: z.string().min(1).optional(),
  assignedPickerId: z.string().min(1).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export const recordPickSchema = z.object({
  lines: z
    .array(
      z.object({
        pickLineId: z.string().min(1),
        pickedQty: z.number().min(0),
      }),
    )
    .min(1),
})

export const createDispatchSchema = z.object({
  pickListId: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(),
})

export const bindImeiSchema = z.object({
  dispatchLineId: z.string().min(1),
  imei: z.string().min(8),
})

export type CreatePickListInput = z.infer<typeof createPickListSchema>
export type RecordPickInput = z.infer<typeof recordPickSchema>
export type CreateDispatchInput = z.infer<typeof createDispatchSchema>
