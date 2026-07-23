import { z } from 'zod'

export const completeExchangeSchema = z.object({
  branchId:         z.string().optional(),
  customerName:     z.string().min(1, 'Customer name is required'),
  customerPhone:    z.string().min(7, 'Customer phone is required'),
  customerAddress:  z.string().optional(),
  customerId:       z.string().optional(),

  oldProductName:   z.string().optional(),
  oldBrand:         z.string().min(1, 'Brand is required'),
  oldModel:         z.string().min(1, 'Model is required'),
  oldImei:          z.string().regex(/^\d{15}$/, 'IMEI must be 15 digits'),
  oldColor:         z.string().optional(),
  oldStorage:       z.string().optional(),
  oldCondition:     z.string().optional().default('GOOD'),
  buyPrice:         z.coerce.number().min(0, 'Buy price must be 0 or more'),
  oldProductId:     z.string().optional(),

  soldProductId:    z.string().min(1, 'Select a phone from stock'),
  soldImei:         z.string().regex(/^\d{15}$/, 'Sold IMEI must be 15 digits'),
  soldVariation:    z.string().optional(),
  soldSellPrice:    z.coerce.number().positive().optional(),

  paymentMethod:    z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'CHEQUE', 'CREDIT']).optional().default('CASH'),
  paidAmount:       z.coerce.number().optional(),
  notes:            z.string().optional(),
})

export type CompleteExchangeInput = z.infer<typeof completeExchangeSchema>
