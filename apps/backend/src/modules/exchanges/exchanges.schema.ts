import { z } from 'zod'
import { isValidUnitSerial, normalizeSerial } from '../../utils/serialNumber'

const unitSerial = z
  .string()
  .min(1, 'Serial number or IMEI is required')
  .transform((v) => normalizeSerial(v))
  .refine((v) => isValidUnitSerial(v), {
    message: 'Enter a Serial Number (5–64 chars) or a 15-digit IMEI',
  })

export const completeExchangeSchema = z.object({
  branchId:         z.string().optional(),
  customerName:     z.string().min(1, 'Customer name is required'),
  customerPhone:    z.string().min(7, 'Customer phone is required'),
  customerAddress:  z.string().optional(),
  customerId:       z.string().optional(),

  oldProductName:   z.string().optional(),
  oldBrand:         z.string().min(1, 'Brand is required'),
  oldModel:         z.string().min(1, 'Model is required'),
  oldImei:          unitSerial,
  oldColor:         z.string().optional(),
  oldStorage:       z.string().optional(),
  oldCondition:     z.string().optional().default('GOOD'),
  buyPrice:         z.coerce.number().min(0, 'Buy price must be 0 or more'),
  oldProductId:     z.string().optional(),

  soldProductId:    z.string().min(1, 'Select a unit from stock'),
  soldImei:         unitSerial,
  soldVariation:    z.string().optional(),
  soldSellPrice:    z.coerce.number().positive().optional(),

  paymentMethod:    z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'CHEQUE', 'CREDIT']).optional().default('CASH'),
  paidAmount:       z.coerce.number().optional(),
  notes:            z.string().optional(),
})

export type CompleteExchangeInput = z.infer<typeof completeExchangeSchema>
