import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { env } from '../../config/env'
import { AppError } from '../../middleware/error.middleware'

function pepper(): string {
  const p = env.POS_PIN_PEPPER?.trim()
  if (p && p.length >= 16) return p
  // Dev fallback — production should set POS_PIN_PEPPER explicitly
  return crypto.createHash('sha256').update(`pos-pin:${env.JWT_SECRET}`).digest('hex')
}

/** Normalize digits-only PIN string. */
export function normalizePinInput(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '')
}

export function assertPinLength(pin: string, expected: 4 | 6): void {
  if (pin.length !== expected || !/^\d+$/.test(pin)) {
    throw new AppError(`PIN must be ${expected} digits`, 400)
  }
}

/** Fast tenant-scoped uniqueness index value (HMAC, not reversible). */
export function pinDigest(tenantId: string, pin: string): string {
  return crypto
    .createHmac('sha256', pepper())
    .update(`${tenantId}:${pin}`)
    .digest('hex')
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12)
}

export async function verifyPinHash(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}
