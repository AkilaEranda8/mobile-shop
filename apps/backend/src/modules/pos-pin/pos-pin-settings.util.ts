export type PosPinSettings = {
  /** Master switch inside settings (feature flag POS_QUICK_PIN still required) */
  enabled: boolean
  /** Digits required for PIN */
  pinLength: 4 | 6
  /** Failed attempts before lockout */
  maxFailedAttempts: number
  /** Lockout duration in seconds */
  lockoutSeconds: number
  /** POS idle lock timeout in seconds (0 = disabled) */
  idleTimeoutSeconds: number
  /** After idle lock, require password instead of PIN */
  requirePasswordAfterLock: boolean
  /** Cold PIN login allowed without prior password session */
  allowColdPinLogin: boolean
}

export const DEFAULT_POS_PIN_SETTINGS: PosPinSettings = {
  enabled: true,
  pinLength: 6,
  maxFailedAttempts: 5,
  lockoutSeconds: 15 * 60,
  idleTimeoutSeconds: 0,
  requirePasswordAfterLock: false,
  allowColdPinLogin: true,
}

function asBool(v: unknown, fallback: boolean): boolean {
  if (v === true || v === 'true') return true
  if (v === false || v === 'false') return false
  return fallback
}

function asInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function normalizePosPinSettings(raw: unknown): PosPinSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const len = asInt(o.pinLength, DEFAULT_POS_PIN_SETTINGS.pinLength, 4, 6)
  return {
    enabled: asBool(o.enabled, DEFAULT_POS_PIN_SETTINGS.enabled),
    pinLength: len === 4 ? 4 : 6,
    maxFailedAttempts: asInt(o.maxFailedAttempts, DEFAULT_POS_PIN_SETTINGS.maxFailedAttempts, 3, 20),
    lockoutSeconds: asInt(o.lockoutSeconds, DEFAULT_POS_PIN_SETTINGS.lockoutSeconds, 60, 24 * 60 * 60),
    // Idle auto-lock off — no timeout (stored values ignored until product re-enables)
    idleTimeoutSeconds: 0,
    // Tied to idle lock — keep off while idle is product-disabled
    requirePasswordAfterLock: false,
    allowColdPinLogin: asBool(o.allowColdPinLogin, DEFAULT_POS_PIN_SETTINGS.allowColdPinLogin),
  }
}
