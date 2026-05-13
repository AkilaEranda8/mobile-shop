import { z } from 'zod'

export const createDeliveryOrderSchema = z.object({
  customerName:   z.string().min(1, 'Customer name is required'),
  customerPhone:  z.string().min(6, 'Phone is required'),
  customerEmail:  z.string().email().optional().or(z.literal('')),
  addressLine1:   z.string().min(1, 'Address is required'),
  addressLine2:   z.string().optional(),
  city:           z.string().min(1, 'City is required'),
  district:       z.string().optional(),
  postalCode:     z.string().optional(),
  subtotal:       z.number().min(0).default(0),
  deliveryCharge: z.number().min(0).default(0),
  isCOD:          z.boolean().default(false),
  codAmount:      z.number().min(0).optional(),
  notes:          z.string().optional(),
  branchId:       z.string().optional(),
  items:          z.array(z.object({
    description: z.string().min(1),
    quantity:    z.number().int().min(1).default(1),
    unitPrice:   z.number().min(0).default(0),
  })).min(1, 'At least one item is required'),
})

export const updateDeliveryOrderSchema = z.object({
  customerName:   z.string().min(1).optional(),
  customerPhone:  z.string().min(6).optional(),
  customerEmail:  z.string().email().optional().or(z.literal('')),
  addressLine1:   z.string().min(1).optional(),
  addressLine2:   z.string().optional(),
  city:           z.string().min(1).optional(),
  district:       z.string().optional(),
  postalCode:     z.string().optional(),
  subtotal:       z.number().min(0).optional(),
  deliveryCharge: z.number().min(0).optional(),
  isCOD:          z.boolean().optional(),
  codAmount:      z.number().min(0).optional(),
  notes:          z.string().optional(),
  status:         z.enum(['PENDING','PACKED','AWAITING_TRACKING','DISPATCHED','IN_TRANSIT','DELIVERED','CANCELLED']).optional(),
})

export const assignTrackingSchema = z.object({
  courierId:     z.string().min(1, 'Courier is required'),
  trackingNumber: z.string().min(1, 'Tracking number is required'),
  sendWhatsApp:  z.boolean().default(true),
})

export const createCourierSchema = z.object({
  name:      z.string().min(1, 'Name is required'),
  code:      z.string().min(1, 'Code is required').toUpperCase(),
  logoUrl:   z.string().url().optional().or(z.literal('')),
  website:   z.string().url().optional().or(z.literal('')),
  phone:     z.string().optional(),
  isDefault: z.boolean().default(false),
})

export const bulkAddTrackingSchema = z.object({
  courierId: z.string().min(1),
  numbers:   z.array(z.string().min(1)).min(1).max(500),
})

export type CreateDeliveryOrderInput = z.infer<typeof createDeliveryOrderSchema>
export type UpdateDeliveryOrderInput = z.infer<typeof updateDeliveryOrderSchema>
export type AssignTrackingInput      = z.infer<typeof assignTrackingSchema>
export type CreateCourierInput       = z.infer<typeof createCourierSchema>
export type BulkAddTrackingInput     = z.infer<typeof bulkAddTrackingSchema>
