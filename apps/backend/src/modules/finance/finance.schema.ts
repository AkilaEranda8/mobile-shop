import { z } from 'zod'

export const createTransactionSchema = z.object({
  branchId: z.string().min(1).optional(),
  type: z.enum(['INCOME', 'EXPENSE']),
  category: z.string().min(1, 'Category is required'),
  amount: z.number().positive('Amount must be greater than zero'),
  description: z.string().min(1, 'Description is required'),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'CHEQUE', 'CREDIT']),
  reference: z.string().optional(),
})

export const listTransactionsQuerySchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
})
