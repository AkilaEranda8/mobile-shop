import { z } from 'zod'

const releaseItemSchema = z.object({
  category: z.enum(['NEW_FEATURE', 'IMPROVEMENT', 'BUG_FIX', 'SECURITY', 'COMING_SOON']),
  module: z.string().optional().nullable(),
  featureName: z.string().min(1, 'Feature name is required'),
  description: z.string().min(1, 'Description is required'),
  badge: z.enum(['NEW', 'IMPROVED', 'FIXED', 'SECURITY', 'COMING_SOON', 'PREMIUM']).optional().nullable(),
  displayOrder: z.number().int().optional().default(0),
  imageUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  docUrl: z.string().optional().nullable(),
})

export const createReleaseSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  title: z.string().min(1, 'Title is required'),
  summary: z.string().min(1, 'Summary is required'),
  releaseDate: z.string().min(1, 'Release date is required'),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional().default('DRAFT'),
  popupEnabled: z.boolean().optional().default(true),
  active: z.boolean().optional().default(true),
  targetType: z.enum(['ALL', 'PACKAGES', 'COMPANIES']).optional().default('ALL'),
  targetPlans: z.array(z.string()).optional().default([]),
  targetTenants: z.array(z.string()).optional().default([]),
  imageUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  docUrl: z.string().optional().nullable(),
  items: z.array(releaseItemSchema).optional().default([]),
})

export const updateReleaseSchema = createReleaseSchema.partial()

export const releaseIdParamSchema = z.object({
  id: z.string().min(1),
})
