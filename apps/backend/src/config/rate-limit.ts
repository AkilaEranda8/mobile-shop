import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit'
import type { Request, Response } from 'express'
import { logPlatformActivity } from '../utils/activity-log'

function rateLimitJsonHandler(message: string, logAsLoginAttempt = false) {
  return (req: Request, res: Response) => {
    if (logAsLoginAttempt) {
      const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : ''
      logPlatformActivity({
        eventType: 'LOGIN_RATE_LIMITED',
        severity: 'WARN',
        actorType: 'SYSTEM',
        actor: email || 'unknown',
        target: email || '—',
        details: message,
        ip: req.ip || req.socket.remoteAddress || '—',
      }).catch(() => {})
    }
    res.status(429).json({ success: false, message })
  }
}

export const globalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitJsonHandler('Too many requests. Please try again in 15 minutes.'),
})

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => authRateLimitKey(
    typeof req.body?.email === 'string' ? req.body.email : '',
    req.ip || req.socket.remoteAddress || 'unknown',
  ),
  handler: rateLimitJsonHandler('Too many login attempts. Please try again in 15 minutes.', true),
})

export function authRateLimitKey(email: string, ip: string): string {
  const normalized = email.toLowerCase().trim()
  return normalized ? `${normalized}:${ip}` : ip
}

type RateLimitStore = { resetAll?: () => Promise<void> }

async function resetLimiterStore(limiter: RateLimitRequestHandler): Promise<void> {
  const store = (limiter as RateLimitRequestHandler & { store?: RateLimitStore }).store
  if (store?.resetAll) await store.resetAll()
}

export async function resetAuthRateLimitKeys(keys: string[]): Promise<string[]> {
  const cleared: string[] = []
  for (const key of keys) {
    try {
      await authLimiter.resetKey(key)
      cleared.push(key)
    } catch {
      /* key may not exist */
    }
  }
  return cleared
}

export async function resetGlobalRateLimitForIp(ip: string): Promise<void> {
  try {
    await globalLimiter.resetKey(ip)
  } catch {
    /* noop */
  }
}

export async function resetAllAuthRateLimits(): Promise<void> {
  await resetLimiterStore(authLimiter)
}

export async function resetAllGlobalRateLimits(): Promise<void> {
  await resetLimiterStore(globalLimiter)
}
