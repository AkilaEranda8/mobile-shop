import { z } from 'zod'
import {
  FEATURE_SUGGESTION_CATEGORIES,
  MAX_PAGE_SIZE,
} from './feature-suggestions.types'
import { sanitizePlainText } from './sanitize.util'

const trimmedSanitized = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .transform((v) => sanitizePlainText(v))
    .refine((v) => v.length >= min, { message: `${label} must be at least ${min} characters` })
    .refine((v) => v.length <= max, { message: `${label} must be at most ${max} characters` })

export const createSuggestionSchema = z.object({
  category: z.enum(FEATURE_SUGGESTION_CATEGORIES, {
    errorMap: () => ({ message: 'Category is required' }),
  }),
  title: trimmedSanitized(10, 120, 'Title'),
  description: trimmedSanitized(30, 5000, 'Description'),
}).strict()

export const adminUpdateSuggestionSchema = z.object({
  status: z.enum([
    'NEW',
    'UNDER_REVIEW',
    'PLANNED',
    'IN_PROGRESS',
    'RELEASED',
    'DECLINED',
  ]).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  publicResponse: z
    .union([
      z.string().transform((v) => {
        const cleaned = sanitizePlainText(v)
        return cleaned.length ? cleaned : null
      }),
      z.null(),
    ])
    .optional(),
  internalNote: z
    .union([
      z.string().transform((v) => {
        const cleaned = sanitizePlainText(v)
        return cleaned.length ? cleaned : null
      }),
      z.null(),
    ])
    .optional(),
}).strict()
  .refine(
    (data) =>
      data.status !== undefined
      || data.priority !== undefined
      || data.publicResponse !== undefined
      || data.internalNote !== undefined,
    { message: 'At least one field is required' },
  )

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(20),
  cursor: z.string().optional(),
  search: z.string().optional(),
  status: z.enum([
    'NEW',
    'UNDER_REVIEW',
    'PLANNED',
    'IN_PROGRESS',
    'RELEASED',
    'DECLINED',
  ]).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  category: z.string().optional(),
  tenant: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(20),
})
