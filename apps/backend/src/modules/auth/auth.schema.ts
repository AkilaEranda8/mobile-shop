import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const registerTenantSchema = z.object({
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  password: z.string().min(8),
  shopName: z.string().min(2),
  plan: z.enum(['STARTER', 'PRO', 'ENTERPRISE']).optional(),
})

export const refreshSchema = z.object({
  refreshToken: z.string(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
})
