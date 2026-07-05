import { z } from 'zod'

export const masterCategorySchema = z.object({
  name: z.string().min(1).max(120),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const masterBrandSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['PHONE', 'ACCESSORY', 'BOTH']).optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const masterPhoneModelSchema = z.object({
  brandId: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().min(1).max(200),
  releaseYear: z.number().int().min(2000).max(2100).optional().nullable(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  trackImei: z.boolean().optional(),
  defaultWarrantyMonths: z.number().int().min(0).max(120).optional(),
})

export const masterPhoneVariantSchema = z.object({
  storage: z.string().min(1).max(40),
  colorName: z.string().min(1).max(60),
  colorHex: z.string().max(20).optional().nullable(),
  skuSuffix: z.string().max(40).optional().nullable(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const masterAccessorySchema = z.object({
  categoryId: z.string().min(1),
  brandId: z.string().optional().nullable(),
  name: z.string().min(1).max(200),
  modelOptional: z.string().max(120).optional().nullable(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const importFromMasterSchema = z.object({
  items: z.array(z.discriminatedUnion('type', [
    z.object({
      type: z.literal('PHONE'),
      modelId: z.string().min(1),
      variantIds: z.array(z.string()).optional(),
    }),
    z.object({
      type: z.literal('ACCESSORY'),
      accessoryId: z.string().min(1),
    }),
  ])).min(1).max(500),
  defaults: z.object({
    buyingPrice: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    stock: z.number().int().min(0).optional(),
  }).optional(),
  branchId: z.string().optional(),
})
