import { z } from 'zod'

export const connectSchema = z.object({
  accessToken:   z.string().min(10, 'Access token is required'),
  phoneNumberId: z.string().min(5, 'Phone Number ID is required'),
  wabaId:        z.string().min(5, 'WhatsApp Business Account ID is required'),
  verifyToken:   z.string().optional().default(''),
  enabled:       z.boolean().optional().default(true),
})

export const updateConfigSchema = z.object({
  accessToken:     z.string().min(10).optional(),
  phoneNumberId:   z.string().min(5).optional(),
  wabaId:          z.string().min(5).optional(),
  verifyToken:     z.string().optional(),
  enabled:         z.boolean().optional(),
  autoSendInvoice: z.boolean().optional(),
  sendPdfInvoice:  z.boolean().optional(),
  validatePhones:  z.boolean().optional(),
  invoiceTemplate: z.string().optional(),
})

export const sendTestMessageSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]\d{6,14}$/, 'Invalid phone number format'),
})

export const sendInvoiceSchema = z.object({
  orderId:      z.string().min(1, 'Order ID is required'),
  phone:        z.string().regex(/^\+?[0-9]\d{6,14}$/, 'Invalid phone number'),
  customerName: z.string().optional(),
  amount:       z.number().optional(),
})

export type ConnectInput       = z.infer<typeof connectSchema>
export type UpdateConfigInput  = z.infer<typeof updateConfigSchema>
export type SendInvoiceInput   = z.infer<typeof sendInvoiceSchema>
