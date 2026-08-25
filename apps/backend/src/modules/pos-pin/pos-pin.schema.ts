import { z } from 'zod'

export const posPinLoginSchema = z.object({
  pin: z.string().regex(/^\d{4}$|^\d{6}$/, 'PIN must be 4 or 6 digits'),
})

export const posPinUnlockSchema = z.object({
  pin: z.string().regex(/^\d{4}$|^\d{6}$/, 'PIN must be 4 or 6 digits'),
})

export const posPinSwitchSchema = z.object({
  pin: z.string().regex(/^\d{4}$|^\d{6}$/, 'PIN must be 4 or 6 digits'),
})

export const setOwnPosPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$|^\d{6}$/, 'PIN must be 4 or 6 digits'),
  currentPin: z.string().regex(/^\d{4}$|^\d{6}$/).optional(),
  currentPassword: z.string().min(1).optional(),
}).refine(
  (v) => !!(v.currentPin || v.currentPassword),
  { message: 'currentPin or currentPassword required' },
)

export const adminResetPosPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$|^\d{6}$/, 'PIN must be 4 or 6 digits'),
  mustChange: z.boolean().optional(),
})

export const updatePosPinSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  pinLength: z.union([z.literal(4), z.literal(6)]).optional(),
  maxFailedAttempts: z.number().int().min(3).max(20).optional(),
  lockoutSeconds: z.number().int().min(60).max(86400).optional(),
  idleTimeoutSeconds: z.number().int().min(0).max(3600).optional(),
  requirePasswordAfterLock: z.boolean().optional(),
  allowColdPinLogin: z.boolean().optional(),
}).strict()
