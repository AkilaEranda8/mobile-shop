import { prisma } from './database'

export const RATE_LIMIT_DEFAULTS = {
  globalMax: 700,
  authMax: 30,
  windowMinutes: 15,
}

export const RATE_LIMIT_CONFIG_KEYS = [
  'security.rateLimit.globalMax',
  'security.rateLimit.authMax',
  'security.rateLimit.windowMinutes',
] as const

type RateLimitSettings = typeof RATE_LIMIT_DEFAULTS

let cached: RateLimitSettings = { ...RATE_LIMIT_DEFAULTS }

function parseBoundedInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n < min) return fallback
  return Math.min(n, max)
}

export function getRateLimitSettings() {
  return {
    windowMs: cached.windowMinutes * 60 * 1000,
    globalMax: cached.globalMax,
    authMax: cached.authMax,
    windowMinutes: cached.windowMinutes,
  }
}

export async function refreshRateLimitSettings(): Promise<RateLimitSettings> {
  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: [...RATE_LIMIT_CONFIG_KEYS] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  cached = {
    globalMax: parseBoundedInt(map['security.rateLimit.globalMax'], RATE_LIMIT_DEFAULTS.globalMax, 50, 10000),
    authMax: parseBoundedInt(map['security.rateLimit.authMax'], RATE_LIMIT_DEFAULTS.authMax, 5, 500),
    windowMinutes: parseBoundedInt(map['security.rateLimit.windowMinutes'], RATE_LIMIT_DEFAULTS.windowMinutes, 1, 1440),
  }
  return cached
}
