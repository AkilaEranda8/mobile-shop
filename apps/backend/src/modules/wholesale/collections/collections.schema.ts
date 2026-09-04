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

export const recordPaymentSchema = z.object({
  dealerId: z.string().min(1),
  branchId: z.string().min(1).optional().nullable(),
  amount: z.number().positive(),
  method: paymentMethod,
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  paidAt: z.string().optional().nullable(),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().min(1),
        amount: z.number().positive(),
      }),
    )
    .optional(),
})

export const createTaskSchema = z.object({
  dealerId: z.string().min(1),
  branchId: z.string().min(1).optional().nullable(),
  assigneeId: z.string().min(1).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  targetAmount: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export const updateTaskSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
  assigneeId: z.string().min(1).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  targetAmount: z.number().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
