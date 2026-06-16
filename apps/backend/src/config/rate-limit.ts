import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit'
import type { Request, Response } from 'express'
import { logPlatformActivity } from '../utils/activity-log'
import { getRateLimitSettings } from './rate-limit-settings'

function rateLimitWindowMessage(): string {
  const { windowMinutes } = getRateLimitSettings()
  return `Please try again in ${windowMinutes} minutes.`
}

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
  windowMs: () => getRateLimitSettings().windowMs,
  max: () => getRateLimitSettings().globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => rateLimitJsonHandler(`Too many requests. ${rateLimitWindowMessage()}`)(_req, res),
} as any)

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: () => getRateLimitSettings().windowMs,
  max: () => getRateLimitSettings().authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => authRateLimitKey(
    typeof req.body?.email === 'string' ? req.body.email : '',
    req.ip || req.socket.remoteAddress || 'unknown',
  ),
  handler: (_req: Request, res: Response) => rateLimitJsonHandler(`Too many login attempts. ${rateLimitWindowMessage()}`, true)(_req, res),
} as any)

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
