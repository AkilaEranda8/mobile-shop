import { z } from 'zod'

export const createTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(1).max(8000),
  category: z.enum(['BUG', 'BILLING', 'HOW_TO', 'ACCOUNT', 'FEATURE', 'OTHER']).default('OTHER'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
})

export const ticketMessageSchema = z.object({
  body: z.string().min(1).max(8000),
  isInternal: z.boolean().optional(),
})

export const adminPatchTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeAdminEmail: z.string().email().nullable().optional(),
})

export const createChatSessionSchema = z.object({
  subject: z.string().max(200).optional(),
  body: z.string().max(8000).optional(),
})

export const chatMessageSchema = z.object({
  body: z.string().min(1).max(8000),
})

export const convertChatSchema = z.object({
  subject: z.string().min(3).max(200).optional(),
  category: z.enum(['BUG', 'BILLING', 'HOW_TO', 'ACCOUNT', 'FEATURE', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
})

export const createCustomerSrSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(1).max(8000),
  customerId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
})

export const customerSrMessageSchema = z.object({
  body: z.string().min(1).max(8000),
})

export const customerSrPatchSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED']).optional(),
})
