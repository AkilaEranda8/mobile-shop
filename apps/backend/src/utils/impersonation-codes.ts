import crypto from 'crypto'
import { redis } from '../config/redis'

const KEY_PREFIX = 'auth:impersonate:'
const DEFAULT_TTL_SEC = 10 * 60

/**
 * One-time support impersonation codes live in Redis with TTL —
 * never accumulate in process memory.
 */
export async function createImpersonationCode(
  token: string,
  ttlMs = DEFAULT_TTL_SEC * 1000,
): Promise<string> {
  const code = crypto.randomBytes(24).toString('base64url')
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000))
  await redis.set(`${KEY_PREFIX}${code}`, token, 'EX', ttlSec)
  return code
}

/** Returns the JWT once, then invalidates the code. */
export async function consumeImpersonationCode(code: string): Promise<string | null> {
  const key = `${KEY_PREFIX}${code}`
  // GETDEL is atomic one-time consume (Redis 6.2+)
  const token = await redis.getdel(key)
  return token || null
}
