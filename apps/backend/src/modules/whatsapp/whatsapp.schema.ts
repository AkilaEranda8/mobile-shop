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
  message:      z.string().min(1).max(4096).optional(),
  /** Raw base64 or data-URL of invoice PDF */
  pdfBase64:    z.string().max(22_000_000).optional(),
  pdfFilename:  z.string().max(200).optional(),
  /** Platform billing: attach PDF even when sendPdfInvoice is off */
  attachPdf:    z.boolean().optional(),
})

export const sendMessageSchema = z.object({
  phone:        z.string().regex(/^\+?[0-9]\d{6,14}$/, 'Invalid phone number'),
  message:      z.string().min(1, 'Message is required').max(4096),
  customerName: z.string().optional(),
  referenceId:  z.string().optional(),
  type:         z.enum(['invoice', 'quote', 'repair', 'custom']).optional().default('custom'),
  amount:       z.number().optional(),
})

export const sendOnboardCredentialsSchema = z.object({
  phone:      z.string().regex(/^\+?[0-9]\d{6,14}$/, 'Invalid phone number'),
  shopName:   z.string().min(1),
  ownerName:  z.string().min(1),
  email:      z.string().email(),
  password:   z.string().min(1),
  plan:       z.string().min(1),
  subdomain:  z.string().min(1),
})

export type ConnectInput       = z.infer<typeof connectSchema>
export type UpdateConfigInput  = z.infer<typeof updateConfigSchema>
export type SendInvoiceInput   = z.infer<typeof sendInvoiceSchema>
export type SendMessageInput   = z.infer<typeof sendMessageSchema>
