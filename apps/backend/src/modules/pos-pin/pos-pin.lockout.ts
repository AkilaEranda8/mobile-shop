import { redis } from '../../config/redis'

const FAIL_PREFIX = 'pospin:fail:'
const LOCK_PREFIX = 'pospin:lock:'
const RATE_PREFIX = 'pospin:rate:'
const UNKNOWN_PREFIX = 'pospin:unknown:'

export async function getPinFailCount(tenantId: string, userId: string): Promise<number> {
  const v = await redis.get(`${FAIL_PREFIX}${tenantId}:${userId}`)
  return v ? parseInt(v, 10) || 0 : 0
}

export async function incrPinFail(
  tenantId: string,
  userId: string,
  lockoutSeconds: number,
): Promise<number> {
  const key = `${FAIL_PREFIX}${tenantId}:${userId}`
  const n = await redis.incr(key)
  if (n === 1) await redis.expire(key, lockoutSeconds)
  return n
}

export async function clearPinFail(tenantId: string, userId: string): Promise<void> {
  await redis.del(`${FAIL_PREFIX}${tenantId}:${userId}`)
  await redis.del(`${LOCK_PREFIX}${tenantId}:${userId}`)
}

export async function setPinLock(tenantId: string, userId: string, lockoutSeconds: number): Promise<void> {
  await redis.set(`${LOCK_PREFIX}${tenantId}:${userId}`, '1', 'EX', lockoutSeconds)
}

export async function isPinLocked(tenantId: string, userId: string): Promise<boolean> {
  const v = await redis.get(`${LOCK_PREFIX}${tenantId}:${userId}`)
  return !!v
}

export async function getPinLockTtl(tenantId: string, userId: string): Promise<number> {
  const ttl = await redis.ttl(`${LOCK_PREFIX}${tenantId}:${userId}`)
  return ttl > 0 ? ttl : 0
}

/**
 * Unknown-PIN bucket (digest-scoped). Prevents brute force when digest doesn't match a user.
 */
export async function incrUnknownPinFail(
  tenantId: string,
  digest: string,
  lockoutSeconds: number,
): Promise<number> {
  const key = `${UNKNOWN_PREFIX}${tenantId}:${digest.slice(0, 32)}`
  const n = await redis.incr(key)
  if (n === 1) await redis.expire(key, lockoutSeconds)
  return n
}

export async function isUnknownPinThrottled(
  tenantId: string,
  digest: string,
  maxFails: number,
): Promise<boolean> {
  const key = `${UNKNOWN_PREFIX}${tenantId}:${digest.slice(0, 32)}`
  const v = await redis.get(key)
  const n = v ? parseInt(v, 10) || 0 : 0
  return n >= maxFails
}

/** IP + tenant rate limit for PIN posts. Returns true if over limit. */
export async function isPinRateLimited(
  tenantId: string,
  ip: string,
  max = 20,
  windowSeconds = 300,
): Promise<boolean> {
  const key = `${RATE_PREFIX}${tenantId}:${ip || 'unknown'}`
  const n = await redis.incr(key)
  if (n === 1) await redis.expire(key, windowSeconds)
  return n > max
}
