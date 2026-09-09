import { createHash, randomBytes } from 'crypto'
import { z } from 'zod'

export const registerManagedDeviceSchema = z.object({
  agreementId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  imei1: z.string().min(8).max(32),
  imei2: z.string().min(8).max(32).optional().nullable(),
  serialNumber: z.string().max(64).optional().nullable(),
  brand: z.string().max(64).optional().nullable(),
  model: z.string().max(64).optional().nullable(),
  androidVersion: z.string().max(32).optional().nullable(),
  imeiRecordId: z.string().min(1).optional().nullable(),
  consentVersion: z.string().min(1).optional(),
  consented: z.boolean().optional(),
})

export const createEnrollmentSchema = z.object({
  consentVersion: z.string().min(1).optional(),
  consented: z.literal(true),
  ttlMinutes: z.number().int().min(5).max(60).optional().default(15),
})

export const deviceActionSchema = z.object({
  reason: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
})

export const updateEmiLockerSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  dryRunEnabled: z.boolean().optional(),
  automaticRestriction: z.boolean().optional(),
  manualApprovalRequired: z.boolean().optional(),
  gracePeriodDays: z.number().int().min(0).max(90).optional(),
  warningDays: z.number().int().min(0).max(30).optional(),
  restrictionExtraGraceDays: z.number().int().min(0).max(90).optional(),
  offlineThresholdHours: z.number().int().min(1).max(168).optional(),
  restoreWithRemainingOverdue: z.boolean().optional(),
  autoRestoreEnabled: z.boolean().optional(),
  autoReleaseEnabled: z.boolean().optional(),
  consentTextVersion: z.string().min(1).max(32).optional(),
  consentText: z.string().max(8000).optional().nullable(),
  supportPhone: z.string().max(32).optional().nullable(),
  supportEmail: z.string().email().optional().nullable().or(z.literal('')),
  paymentInfoText: z.string().max(2000).optional().nullable(),
  restrictionPolicyHint: z.string().max(2000).optional().nullable(),
  amapiEnterpriseName: z.string().max(256).optional().nullable(),
})

export const updateManagedDeviceSchema = z.object({
  imei2: z.string().min(8).max(32).optional().nullable(),
  serialNumber: z.string().max(64).optional().nullable(),
  brand: z.string().max(64).optional().nullable(),
  model: z.string().max(64).optional().nullable(),
  androidVersion: z.string().max(32).optional().nullable(),
  activePolicyId: z.string().min(1).optional().nullable(),
})

export const createPolicySchema = z.object({
  name: z.string().min(1).max(64),
  kind: z.enum(['ACTIVE', 'WARNING', 'RESTRICTED', 'RELEASED']),
  amapiPolicyName: z.string().max(256).optional().nullable(),
  policyJson: z.record(z.unknown()).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const updatePolicySchema = createPolicySchema.partial()

export const listDevicesQuerySchema = z.object({
  status: z.string().optional(),
  enrollmentStatus: z.string().optional(),
  onlineStatus: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const listCommandsQuerySchema = z.object({
  commandType: z.string().optional(),
  status: z.string().optional(),
  deviceId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export function hashEnrollmentToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function generateEnrollmentSecrets(): { enrollmentCode: string; rawToken: string; tokenHash: string } {
  const enrollmentCode = `ENR-${randomBytes(3).toString('hex').toUpperCase()}`
  const rawToken = randomBytes(24).toString('base64url')
  return { enrollmentCode, rawToken, tokenHash: hashEnrollmentToken(rawToken) }
}

export function buildIdempotencyKey(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 40)
}
