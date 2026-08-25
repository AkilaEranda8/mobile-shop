import crypto from 'crypto'
import { redis } from '../config/redis'

export type SessionExchangePayload = {
  accessToken: string
  refreshToken: string
  user: Record<string, unknown>
}

const KEY_PREFIX = 'auth:session-ex:'
const DEFAULT_TTL_SEC = 10 * 60

/**
 * One-time post-register session exchange codes live in Redis with TTL —
 * never accumulate in process memory.
 */
export async function createSessionExchangeCode(
  payload: SessionExchangePayload,
  ttlMs = DEFAULT_TTL_SEC * 1000,
): Promise<string> {
  const code = crypto.randomBytes(24).toString('base64url')
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000))
  await redis.set(`${KEY_PREFIX}${code}`, JSON.stringify(payload), 'EX', ttlSec)
  return code
}

/** Returns session payload once, then invalidates the code. */
export async function consumeSessionExchangeCode(
  code: string,
): Promise<SessionExchangePayload | null> {
  const key = `${KEY_PREFIX}${code}`
  const raw = await redis.getdel(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionExchangePayload
  } catch {
    return null
  }
}
