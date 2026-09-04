/**
 * HelaPOS credentials & flags stored in PlatformConfig (admin-editable).
 * Env vars remain fallbacks when DB keys are empty.
 */
import { prisma } from '../../config/database'
import { env } from '../../config/env'

export const HELAPOS_SECRET_MASK = '••••••••'

export type HelaposAuthMode = 'basic' | 'headers' | 'bearer'

export type HelaposRuntimeConfig = {
  enabled: boolean
  mock: boolean
  appId: string
  appSecret: string
  merchantId: string
  baseUrl: string
  createQrPath: string
  authMode: HelaposAuthMode
  webhookSecret: string
  allowedIps: string
  requireSignature: boolean
  sessionTtlMinutes: number
}

/** Admin-facing shape — secrets masked */
export type HelaposAdminConfig = {
  enabled: boolean
  mock: boolean
  appId: string
  appSecret: string
  hasAppSecret: boolean
  merchantId: string
  baseUrl: string
  createQrPath: string
  authMode: HelaposAuthMode
  webhookSecret: string
  hasWebhookSecret: boolean
  allowedIps: string
  requireSignature: boolean
  sessionTtlMinutes: number
  notifyUrl: string
  configured: boolean
  source: 'database' | 'env' | 'mixed'
}

const KEYS = {
  enabled: 'helapos_enabled',
  mock: 'helapos_mock',
  appId: 'helapos_app_id',
  appSecret: 'helapos_app_secret',
  merchantId: 'helapos_merchant_id',
  baseUrl: 'helapos_base_url',
  createQrPath: 'helapos_create_qr_path',
  authMode: 'helapos_auth_mode',
  webhookSecret: 'helapos_webhook_secret',
  allowedIps: 'helapos_allowed_ips',
  requireSignature: 'helapos_require_signature',
  sessionTtlMinutes: 'helapos_session_ttl_minutes',
} as const

let cache: { at: number; value: HelaposRuntimeConfig } | null = null
const CACHE_MS = 5_000

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null || v === '') return fallback
  const n = v.trim().toLowerCase()
  if (n === 'true' || n === '1' || n === 'yes') return true
  if (n === 'false' || n === '0' || n === 'no') return false
  return fallback
}

function parseAuthMode(v: string | undefined, fallback: HelaposAuthMode): HelaposAuthMode {
  if (v === 'basic' || v === 'headers' || v === 'bearer') return v
  return fallback
}

function parseTtl(v: string | undefined, fallback: number): number {
  if (v == null || v === '') return fallback
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(60, Math.max(5, Math.floor(n)))
}

function envDefaults(): HelaposRuntimeConfig {
  return {
    enabled: env.HELAPOS_ENABLED === 'true',
    mock: env.HELAPOS_MOCK === 'true',
    appId: env.HELAPOS_APP_ID?.trim() || '',
    appSecret: env.HELAPOS_APP_SECRET?.trim() || '',
    merchantId: env.HELAPOS_MERCHANT_ID?.trim() || '',
    baseUrl: env.HELAPOS_BASE_URL || 'https://helapos.lk/merchant-api',
    createQrPath: env.HELAPOS_CREATE_QR_PATH || '/qr/create',
    authMode: (env.HELAPOS_AUTH_MODE as HelaposAuthMode) || 'basic',
    webhookSecret: env.HELAPOS_WEBHOOK_SECRET?.trim() || '',
    allowedIps: env.HELAPOS_ALLOWED_IPS?.trim() || '',
    requireSignature: env.HELAPOS_REQUIRE_SIGNATURE !== 'false',
    sessionTtlMinutes: env.HELAPOS_SESSION_TTL_MINUTES ?? 15,
  }
}

function pick(db: string | undefined, envVal: string): { value: string; fromDb: boolean } {
  if (db != null && db !== '') return { value: db, fromDb: true }
  return { value: envVal, fromDb: false }
}

export function invalidateHelaposConfigCache() {
  cache = null
}

export async function getHelaposRuntimeConfig(): Promise<HelaposRuntimeConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value

  const rows = await prisma.platformConfig.findMany({
    where: { key: { startsWith: 'helapos_' } },
  })
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value

  const defaults = envDefaults()
  const appId = pick(map[KEYS.appId], defaults.appId)
  const appSecret = pick(map[KEYS.appSecret], defaults.appSecret)
  const merchantId = pick(map[KEYS.merchantId], defaults.merchantId)
  const baseUrl = pick(map[KEYS.baseUrl], defaults.baseUrl)
  const createQrPath = pick(map[KEYS.createQrPath], defaults.createQrPath)
  const webhookSecret = pick(map[KEYS.webhookSecret], defaults.webhookSecret)
  const allowedIps = pick(map[KEYS.allowedIps], defaults.allowedIps)

  const value: HelaposRuntimeConfig = {
    enabled: map[KEYS.enabled] != null && map[KEYS.enabled] !== ''
      ? parseBool(map[KEYS.enabled], defaults.enabled)
      : defaults.enabled,
    mock: map[KEYS.mock] != null && map[KEYS.mock] !== ''
      ? parseBool(map[KEYS.mock], defaults.mock)
      : defaults.mock,
    appId: appId.value,
    appSecret: appSecret.value,
    merchantId: merchantId.value,
    baseUrl: baseUrl.value || defaults.baseUrl,
    createQrPath: createQrPath.value || defaults.createQrPath,
    authMode: parseAuthMode(map[KEYS.authMode], defaults.authMode),
    webhookSecret: webhookSecret.value,
    allowedIps: allowedIps.value,
    requireSignature: map[KEYS.requireSignature] != null && map[KEYS.requireSignature] !== ''
      ? parseBool(map[KEYS.requireSignature], defaults.requireSignature)
      : defaults.requireSignature,
    sessionTtlMinutes: map[KEYS.sessionTtlMinutes] != null && map[KEYS.sessionTtlMinutes] !== ''
      ? parseTtl(map[KEYS.sessionTtlMinutes], defaults.sessionTtlMinutes)
      : defaults.sessionTtlMinutes,
  }

  cache = { at: Date.now(), value }
  return value
}

export function helaposNotifyUrlFromEnv(): string {
  const base = env.BACKEND_URL.replace(/\/$/, '')
  const prefix = env.API_PREFIX.replace(/^\/+|\/+$/g, '')
  return `${base}/${prefix}/payments/helapos/webhook`
}

export async function getHelaposAdminConfig(): Promise<HelaposAdminConfig> {
  const cfg = await getHelaposRuntimeConfig()
  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: [KEYS.appId, KEYS.appSecret, KEYS.webhookSecret, KEYS.enabled] } },
    select: { key: true },
  })
  const dbKeys = new Set(rows.map((r) => r.key))
  const hasDbCreds = dbKeys.has(KEYS.appId) || dbKeys.has(KEYS.appSecret)
  const hasEnvCreds = !!(env.HELAPOS_APP_ID?.trim() || env.HELAPOS_APP_SECRET?.trim())
  let source: HelaposAdminConfig['source'] = 'env'
  if (hasDbCreds && hasEnvCreds) source = 'mixed'
  else if (hasDbCreds || dbKeys.has(KEYS.enabled)) source = 'database'

  const configured = !!(cfg.appId.trim() && cfg.appSecret.trim())

  return {
    enabled: cfg.enabled,
    mock: cfg.mock,
    appId: cfg.appId,
    appSecret: cfg.appSecret ? HELAPOS_SECRET_MASK : '',
    hasAppSecret: !!cfg.appSecret,
    merchantId: cfg.merchantId,
    baseUrl: cfg.baseUrl,
    createQrPath: cfg.createQrPath,
    authMode: cfg.authMode,
    webhookSecret: cfg.webhookSecret ? HELAPOS_SECRET_MASK : '',
    hasWebhookSecret: !!cfg.webhookSecret,
    allowedIps: cfg.allowedIps,
    requireSignature: cfg.requireSignature,
    sessionTtlMinutes: cfg.sessionTtlMinutes,
    notifyUrl: helaposNotifyUrlFromEnv(),
    configured,
    source,
  }
}

export type UpsertHelaposConfigInput = {
  enabled?: boolean
  mock?: boolean
  appId?: string
  /** Masked or empty → keep previous; non-empty new value → replace */
  appSecret?: string
  merchantId?: string
  baseUrl?: string
  createQrPath?: string
  authMode?: HelaposAuthMode
  webhookSecret?: string
  allowedIps?: string
  requireSignature?: boolean
  sessionTtlMinutes?: number
}

async function upsertKey(key: string, value: string) {
  await prisma.platformConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

export async function upsertHelaposConfig(input: UpsertHelaposConfigInput): Promise<HelaposAdminConfig> {
  const current = await getHelaposRuntimeConfig()
  const pairs: Array<[string, string]> = []

  if (input.enabled != null) pairs.push([KEYS.enabled, input.enabled ? 'true' : 'false'])
  if (input.mock != null) pairs.push([KEYS.mock, input.mock ? 'true' : 'false'])
  if (input.appId != null) pairs.push([KEYS.appId, input.appId.trim()])
  if (input.merchantId != null) pairs.push([KEYS.merchantId, input.merchantId.trim()])
  if (input.baseUrl != null) pairs.push([KEYS.baseUrl, input.baseUrl.trim() || current.baseUrl])
  if (input.createQrPath != null) {
    const p = input.createQrPath.trim() || current.createQrPath
    pairs.push([KEYS.createQrPath, p.startsWith('/') ? p : `/${p}`])
  }
  if (input.authMode != null) pairs.push([KEYS.authMode, input.authMode])
  if (input.allowedIps != null) pairs.push([KEYS.allowedIps, input.allowedIps.trim()])
  if (input.requireSignature != null) {
    pairs.push([KEYS.requireSignature, input.requireSignature ? 'true' : 'false'])
  }
  if (input.sessionTtlMinutes != null) {
    pairs.push([KEYS.sessionTtlMinutes, String(parseTtl(String(input.sessionTtlMinutes), current.sessionTtlMinutes))])
  }

  if (input.appSecret != null) {
    const s = input.appSecret.trim()
    if (s && s !== HELAPOS_SECRET_MASK) pairs.push([KEYS.appSecret, s])
  }
  if (input.webhookSecret != null) {
    const s = input.webhookSecret.trim()
    if (s && s !== HELAPOS_SECRET_MASK) pairs.push([KEYS.webhookSecret, s])
  }

  for (const [key, value] of pairs) {
    await upsertKey(key, value)
  }

  invalidateHelaposConfigCache()
  return getHelaposAdminConfig()
}
