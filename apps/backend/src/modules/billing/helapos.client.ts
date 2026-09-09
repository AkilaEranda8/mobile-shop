/**
 * HelaPOS merchant API client (LankaQR).
 * Contract: HelaPOS Merchant QR API v1.2.0
 *  1) POST {base}/merchant/api/v1/getToken  (Basic appId:secret, grant_type=client_credentials)
 *  2) POST {base}/merchant/api/helapos/qr/generate  (Bearer accessToken, body { b, r, am })
 */
import { createHmac, timingSafeEqual } from 'crypto'
import { env } from '../../config/env'
import { AppError } from '../../middleware/error.middleware'
import { getHelaposFeePolicy } from './helapos-fees'
import {
  getHelaposRuntimeConfig,
  helaposNotifyUrlFromEnv,
  type HelaposRuntimeConfig,
} from './helapos-config'

export type HelaposCreateQrInput = {
  amount: number
  reference: string
  notifyUrl: string
  description?: string
  invoiceNumber?: string
  /** Admin connection probe — skip "enabled" gate, still needs credentials */
  adminProbe?: boolean
}

export type HelaposCreateQrResult = {
  qrPayload: string
  gatewayTxnId?: string | null
  qrReference?: string | null
  raw: Record<string, unknown>
  mock: false
}

const DEFAULT_TOKEN_PATH = '/merchant/api/v1/getToken'
const DEFAULT_QR_PATH = '/merchant/api/helapos/qr/generate'

type TokenCache = {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
  appId: string
}

let tokenCache: TokenCache | null = null

function isConfigured(cfg: HelaposRuntimeConfig): boolean {
  return !!(cfg.appId.trim() && cfg.appSecret.trim() && cfg.merchantId.trim())
}

export async function isHelaposEnabled(): Promise<boolean> {
  const cfg = await getHelaposRuntimeConfig()
  if (!cfg.enabled) return false
  return isConfigured(cfg)
}

/** @deprecated Mock payments removed — always false */
export async function isHelaposMockMode(): Promise<boolean> {
  return false
}

function jsonHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'Hexalyte-Billing/1.0',
    ...extra,
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  for (const nestKey of ['data', 'result', 'payload', 'qr', 'sale']) {
    const nested = obj[nestKey]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const found = pickString(nested as Record<string, unknown>, keys)
      if (found) return found
    }
  }
  return null
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}`
}

function resolveQrPath(cfg: HelaposRuntimeConfig): string {
  const p = (cfg.createQrPath || '').trim()
  // Migrate legacy / wrong paths to documented endpoint
  if (!p || p === '/merchant/qr' || p === '/qr/create') return DEFAULT_QR_PATH
  return p.startsWith('/') ? p : `/${p}`
}

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown>; text: string }> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err: any) {
    throw new AppError(`HelaPOS unreachable: ${err?.message || 'network error'}`, 502)
  }
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  return { ok: res.ok, status: res.status, json, text }
}

async function requestAccessToken(cfg: HelaposRuntimeConfig): Promise<TokenCache> {
  const url = joinUrl(cfg.baseUrl, DEFAULT_TOKEN_PATH)
  const basic = Buffer.from(`${cfg.appId.trim()}:${cfg.appSecret.trim()}`).toString('base64')
  const { ok, status, json } = await fetchJson(url, {
    method: 'POST',
    headers: jsonHeaders({ Authorization: `Basic ${basic}` }),
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  })

  if (!ok) {
    const msg = pickString(json, ['message', 'error', 'statusMessage', 'status_message'])
      || `HelaPOS getToken failed (${status})`
    throw new AppError(`${msg} [HTTP ${status}]`, 502)
  }

  const accessToken = pickString(json, ['accessToken', 'access_token'])
  if (!accessToken) {
    throw new AppError('HelaPOS getToken response missing accessToken', 502)
  }
  const refreshToken = pickString(json, ['refreshToken', 'refresh_token'])

  // Access tokens are short-lived; refresh before they expire. Docs don't publish TTL — cache ~50m.
  const cache: TokenCache = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + 50 * 60_000,
    appId: cfg.appId.trim(),
  }
  tokenCache = cache
  return cache
}

async function getAccessToken(cfg: HelaposRuntimeConfig, force = false): Promise<string> {
  if (
    !force
    && tokenCache
    && tokenCache.appId === cfg.appId.trim()
    && tokenCache.expiresAt > Date.now() + 60_000
  ) {
    return tokenCache.accessToken
  }
  const next = await requestAccessToken(cfg)
  return next.accessToken
}

export async function createHelaposQr(input: HelaposCreateQrInput): Promise<HelaposCreateQrResult> {
  const cfg = await getHelaposRuntimeConfig()
  if (!input.adminProbe && !cfg.enabled) {
    throw new AppError('HelaPOS QR payments are not enabled', 503)
  }
  if (!isConfigured(cfg)) {
    throw new AppError('HelaPOS QR payments are not configured (App ID / Secret / Business Id)', 503)
  }

  const url = joinUrl(cfg.baseUrl, resolveQrPath(cfg))
  const body = {
    b: cfg.merchantId.trim(),
    r: input.reference,
    am: Number(input.amount.toFixed(2)),
  }

  const tryCreate = async (forceToken: boolean) => {
    const token = await getAccessToken(cfg, forceToken)
    return fetchJson(url, {
      method: 'POST',
      headers: jsonHeaders({ Authorization: `Bearer ${token}` }),
      body: JSON.stringify(body),
    })
  }

  let result = await tryCreate(false)
  // Token may have expired server-side — retry once with a fresh token
  if (result.status === 401) {
    result = await tryCreate(true)
  }

  if (!result.ok) {
    const msg = pickString(result.json, ['message', 'error', 'statusMessage', 'status_message'])
      || `HelaPOS QR create failed (${result.status})`
    throw new AppError(`${msg} [HTTP ${result.status}]`, 502)
  }

  const statusCode = pickString(result.json, ['statusCode', 'status_code', 'code'])
  if (statusCode && statusCode !== '200' && statusCode !== '201') {
    const msg = pickString(result.json, ['statusMessage', 'status_message', 'message'])
      || `HelaPOS QR create rejected (${statusCode})`
    throw new AppError(msg, 502)
  }

  const qrPayload = pickString(result.json, [
    'qr_data',
    'qrData',
    'qr',
    'qr_code',
    'qrCode',
    'qr_string',
    'qrString',
    'qr_payload',
    'qrPayload',
    'emv',
    'emv_qr',
  ])
  if (!qrPayload) {
    throw new AppError('HelaPOS response did not include qr_data', 502)
  }

  const qrReference = pickString(result.json, ['qr_reference', 'qrReference'])
  const gatewayTxnId = qrReference
    || pickString(result.json, ['reference', 'transaction_id', 'transactionId', 'sale_id', 'saleId'])

  return {
    qrPayload,
    gatewayTxnId: gatewayTxnId ?? null,
    qrReference: qrReference ?? null,
    raw: result.json,
    mock: false,
  }
}

/** Extract reference / status / amount / txn id from HelaPay webhook body */
export function parseHelaposWebhook(body: unknown): {
  reference: string | null
  status: string | null
  amount: number | null
  gatewayTxnId: string | null
  success: boolean
  raw: Record<string, unknown>
} {
  const raw = (body && typeof body === 'object' && !Array.isArray(body)
    ? { ...(body as Record<string, unknown>) }
    : { value: body }) as Record<string, unknown>

  for (const nestKey of ['data', 'payload', 'result', 'payment', 'transaction', 'sale']) {
    const nested = raw[nestKey]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      Object.assign(raw, nested as Record<string, unknown>)
    }
  }

  const reference = pickString(raw, [
    'r', // HelaPay merchant reference used when generating QR
    'reference',
    'order_id',
    'orderId',
    'merchant_reference',
    'merchantReference',
    'merchant_ref',
    'merchantRef',
    'custom_1',
    'custom1',
    'external_id',
    'externalId',
    'trx_ref',
    'trxRef',
  ])

  const paymentStatusRaw = raw.payment_status ?? raw.paymentStatus
  const status = pickString(raw, [
    'status',
    'payment_status',
    'paymentStatus',
    'txn_status',
    'status_message',
    'statusMessage',
  ])

  const statusCode = pickString(raw, ['status_code', 'statusCode', 'code'])
  // Prefer gateway ids — do NOT treat merchant `r` / cuid as txn id here.
  const gatewayTxnId = pickString(raw, [
    'qr_reference',
    'qrReference',
    'reference_id',
    'referenceId',
    'sale_id',
    'saleId',
    'transaction_id',
    'transactionId',
    'payment_id',
    'paymentId',
    'txn_id',
    'txnId',
  ])

  let amount: number | null = null
  for (const key of ['amount', 'pay_amount', 'payAmount', 'paid_amount', 'paidAmount', 'helapos_amount', 'am', 'sale_amount', 'total']) {
    const v = raw[key]
    if (typeof v === 'number' && Number.isFinite(v)) { amount = v; break }
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) { amount = Number(v); break }
  }

  // Docs: payment_status 2 = Success, -1 = Failed, 0 = Pending
  let success = false
  if (typeof paymentStatusRaw === 'number') {
    success = paymentStatusRaw === 2
  } else if (typeof paymentStatusRaw === 'string' && paymentStatusRaw.trim() !== '') {
    success = paymentStatusRaw.trim() === '2'
  } else {
    const successTokens = new Set([
      'success', 'successful', 'paid', 'completed', 'complete', 'approved', 'ok', '2', '1', 'true',
    ])
    const failTokens = new Set([
      'failed', 'fail', 'cancelled', 'canceled', 'rejected', 'declined', '-1', '-2', '0', 'false',
    ])
    const normalized = (status || statusCode || '').toLowerCase().trim()
    success = successTokens.has(normalized)
    if (statusCode && successTokens.has(statusCode)) success = true
    if (failTokens.has(normalized)) success = false
  }

  return { reference, status: status || statusCode, amount, gatewayTxnId, success, raw }
}

export async function verifyHelaposWebhookSignature(
  rawBody: string | Buffer,
  headers: Record<string, string | string[] | undefined>,
): Promise<{ ok: boolean; reason?: string }> {
  const cfg = await getHelaposRuntimeConfig()
  const secret = cfg.webhookSecret.trim()
  const requireSig = cfg.requireSignature

  const get = (name: string) => {
    const v = headers[name] ?? headers[name.toLowerCase()]
    return Array.isArray(v) ? v[0] : v
  }

  const sig =
    get('x-helapos-signature')
    || get('x-signature')
    || get('x-hub-signature-256')
    || get('signature')

  // HelaPay Merchant QR API docs do not document HMAC signatures on callbacks.
  // Only enforce when a signature header is actually present, or admin forced require+secret.
  if (!sig) {
    if (requireSig && secret) return { ok: false, reason: 'missing_signature' }
    return { ok: true }
  }

  if (!secret) {
    return { ok: false, reason: 'webhook_secret_required' }
  }

  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
  const expectedHex = createHmac('sha256', secret).update(body).digest('hex')
  const expectedB64 = createHmac('sha256', secret).update(body).digest('base64')

  const candidates = [
    expectedHex,
    expectedHex.toUpperCase(),
    `sha256=${expectedHex}`,
    expectedB64,
  ]

  const provided = String(sig).trim()
  const matched = candidates.some((c) => {
    try {
      const a = Buffer.from(c)
      const b = Buffer.from(provided)
      return a.length === b.length && timingSafeEqual(a, b)
    } catch {
      return false
    }
  })
  if (!matched) return { ok: false, reason: 'bad_signature' }

  const tsRaw = get('x-helapos-timestamp') || get('x-timestamp') || get('timestamp')
  if (tsRaw) {
    const ts = Number(tsRaw)
    const ms = ts > 1e12 ? ts : ts * 1000
    if (!Number.isFinite(ms) || Math.abs(Date.now() - ms) > 5 * 60 * 1000) {
      return { ok: false, reason: 'stale_timestamp' }
    }
  }

  return { ok: true }
}

export async function isHelaposIpAllowed(ip: string | undefined): Promise<boolean> {
  const cfg = await getHelaposRuntimeConfig()
  const raw = cfg.allowedIps.trim()
  if (!raw) return true
  if (!ip) return false
  const normalized = ip.replace(/^::ffff:/, '')
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return allowed.some((entry) => normalized === entry || ip === entry)
}

export function helaposNotifyUrl() {
  return helaposNotifyUrlFromEnv()
}

export async function getHelaposPublicConfig() {
  const cfg = await getHelaposRuntimeConfig()
  const configured = isConfigured(cfg)
  const enabled = cfg.enabled && configured
  return {
    enabled,
    mock: false,
    notifyUrl: helaposNotifyUrl(),
    sessionTtlMinutes: cfg.sessionTtlMinutes,
    // Docs do not require webhook HMAC — only flag when admin enabled require+secret
    signatureRequired: !!(cfg.requireSignature && cfg.webhookSecret.trim()),
    configured,
    fees: getHelaposFeePolicy(),
  }
}

export async function helaposSessionExpiresAt(from = new Date()): Promise<Date> {
  const cfg = await getHelaposRuntimeConfig()
  return new Date(from.getTime() + cfg.sessionTtlMinutes * 60_000)
}
