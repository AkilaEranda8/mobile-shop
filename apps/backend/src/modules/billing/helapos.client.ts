/**
 * HelaPOS merchant API client (LankaQR).
 *
 * Partner guide only documents base URL + App ID/Secret. Paths and payload
 * shapes are env-configurable so we can align when HelaPay share OpenAPI.
 */
import { createHmac, timingSafeEqual } from 'crypto'
import { env } from '../../config/env'
import { AppError } from '../../middleware/error.middleware'
import { getHelaposFeePolicy } from './helapos-fees'

export type HelaposCreateQrInput = {
  amount: number
  reference: string
  notifyUrl: string
  description?: string
  invoiceNumber?: string
}

export type HelaposCreateQrResult = {
  qrPayload: string
  gatewayTxnId?: string | null
  raw: Record<string, unknown>
  mock: boolean
}

function isConfigured(): boolean {
  return !!(env.HELAPOS_APP_ID?.trim() && env.HELAPOS_APP_SECRET?.trim())
}

export function isHelaposEnabled(): boolean {
  // Mock alone is enough for local / staging end-to-end tests
  if (env.HELAPOS_MOCK === 'true') return true
  if (env.HELAPOS_ENABLED !== 'true') return false
  return isConfigured()
}

export function isHelaposMockMode(): boolean {
  return env.HELAPOS_MOCK === 'true' || (env.HELAPOS_ENABLED === 'true' && !isConfigured())
}

function authHeaders(): Record<string, string> {
  const appId = env.HELAPOS_APP_ID!.trim()
  const secret = env.HELAPOS_APP_SECRET!.trim()
  const mode = env.HELAPOS_AUTH_MODE ?? 'basic'
  if (mode === 'headers') {
    return {
      'X-App-Id': appId,
      'X-App-Secret': secret,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }
  if (mode === 'bearer') {
    const token = Buffer.from(`${appId}:${secret}`).toString('base64')
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }
  const basic = Buffer.from(`${appId}:${secret}`).toString('base64')
  return {
    Authorization: `Basic ${basic}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  // nested data / result
  for (const nestKey of ['data', 'result', 'payload', 'qr']) {
    const nested = obj[nestKey]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const found = pickString(nested as Record<string, unknown>, keys)
      if (found) return found
    }
  }
  return null
}

export async function createHelaposQr(input: HelaposCreateQrInput): Promise<HelaposCreateQrResult> {
  if (!isHelaposEnabled()) {
    throw new AppError('HelaPOS QR payments are not enabled', 503)
  }

  if (isHelaposMockMode()) {
    // Mock EMV-style payload: scanners won't settle, but UI + webhook flow work end-to-end.
    const qrPayload = `HELAPOS-MOCK|ref=${input.reference}|amount=${input.amount.toFixed(2)}|inv=${input.invoiceNumber ?? ''}`
    return {
      qrPayload,
      gatewayTxnId: `mock_${input.reference}`,
      raw: { mock: true, reference: input.reference, amount: input.amount },
      mock: true,
    }
  }

  const base = env.HELAPOS_BASE_URL.replace(/\/$/, '')
  const path = env.HELAPOS_CREATE_QR_PATH.startsWith('/')
    ? env.HELAPOS_CREATE_QR_PATH
    : `/${env.HELAPOS_CREATE_QR_PATH}`
  const url = `${base}${path}`

  const body: Record<string, unknown> = {
    amount: Number(input.amount.toFixed(2)),
    currency: 'LKR',
    reference: input.reference,
    order_id: input.reference,
    notify_url: input.notifyUrl,
    notifyUrl: input.notifyUrl,
    description: input.description ?? `Hexalyte subscription ${input.invoiceNumber ?? ''}`.trim(),
  }
  if (env.HELAPOS_MERCHANT_ID?.trim()) {
    body.merchant_id = env.HELAPOS_MERCHANT_ID.trim()
    body.merchantId = env.HELAPOS_MERCHANT_ID.trim()
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    })
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

  if (!res.ok) {
    const msg = pickString(json, ['message', 'error', 'error_message', 'status_message'])
      || `HelaPOS QR create failed (${res.status})`
    throw new AppError(msg, 502)
  }

  const qrPayload = pickString(json, [
    'qr',
    'qr_code',
    'qrCode',
    'qr_string',
    'qrString',
    'qr_payload',
    'qrPayload',
    'data',
    'payload',
    'emv',
    'emv_qr',
  ])
  if (!qrPayload) {
    throw new AppError('HelaPOS response did not include a QR payload — check HELAPOS_CREATE_QR_PATH / API contract', 502)
  }

  const gatewayTxnId = pickString(json, [
    'transaction_id',
    'transactionId',
    'txn_id',
    'payment_id',
    'paymentId',
    'id',
    'session_id',
    'sessionId',
  ])

  return { qrPayload, gatewayTxnId, raw: json, mock: false }
}

/** Extract reference / status / amount / txn id from a flexible webhook body */
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

  // Flatten common wrappers
  for (const nestKey of ['data', 'payload', 'result', 'payment', 'transaction']) {
    const nested = raw[nestKey]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      Object.assign(raw, nested as Record<string, unknown>)
    }
  }

  const reference = pickString(raw, [
    'reference',
    'order_id',
    'orderId',
    'merchant_reference',
    'merchantReference',
    'custom_1',
    'custom1',
    'external_id',
    'externalId',
  ])

  const status = pickString(raw, [
    'status',
    'payment_status',
    'paymentStatus',
    'txn_status',
    'status_message',
    'statusMessage',
  ])

  const statusCode = pickString(raw, ['status_code', 'statusCode', 'code'])
  const gatewayTxnId = pickString(raw, [
    'transaction_id',
    'transactionId',
    'payment_id',
    'paymentId',
    'txn_id',
    'txnId',
    'id',
  ])

  let amount: number | null = null
  for (const key of ['amount', 'pay_amount', 'payAmount', 'paid_amount', 'paidAmount', 'helapos_amount']) {
    const v = raw[key]
    if (typeof v === 'number' && Number.isFinite(v)) { amount = v; break }
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) { amount = Number(v); break }
  }

  const successTokens = new Set([
    'success', 'successful', 'paid', 'completed', 'complete', 'approved', 'ok', '2', '1', 'true',
  ])
  const failTokens = new Set([
    'failed', 'fail', 'cancelled', 'canceled', 'rejected', 'declined', '-1', '-2', '0', 'false',
  ])

  const normalized = (status || statusCode || '').toLowerCase().trim()
  let success = successTokens.has(normalized)
  if (!success && statusCode && successTokens.has(statusCode)) success = true
  if (failTokens.has(normalized)) success = false
  // Some gateways only send event type
  const event = pickString(raw, ['event', 'event_type', 'eventType', 'type'])
  if (event && /paid|success|complete/i.test(event)) success = true
  if (event && /fail|cancel|reject/i.test(event)) success = false

  return { reference, status: status || statusCode, amount, gatewayTxnId, success, raw }
}

export function verifyHelaposWebhookSignature(
  rawBody: string | Buffer,
  headers: Record<string, string | string[] | undefined>,
): { ok: boolean; reason?: string } {
  const secret = env.HELAPOS_WEBHOOK_SECRET?.trim()
  const requireSig = env.HELAPOS_REQUIRE_SIGNATURE !== 'false'
  const live = env.HELAPOS_ENABLED === 'true' && env.HELAPOS_MOCK !== 'true' && isConfigured()

  if (!secret) {
    // Live production must not accept unsigned webhooks
    if (live && env.NODE_ENV === 'production') {
      return { ok: false, reason: 'webhook_secret_required' }
    }
    if (requireSig && live) {
      return { ok: false, reason: 'webhook_secret_required' }
    }
    return { ok: true }
  }

  const get = (name: string) => {
    const v = headers[name] ?? headers[name.toLowerCase()]
    return Array.isArray(v) ? v[0] : v
  }

  const sig =
    get('x-helapos-signature')
    || get('x-signature')
    || get('x-hub-signature-256')
    || get('signature')

  if (!sig) return { ok: false, reason: 'missing_signature' }

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

  // Optional replay window when gateway sends timestamp
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

/** Return false if request IP is not in HELAPOS_ALLOWED_IPS (when configured). */
export function isHelaposIpAllowed(ip: string | undefined): boolean {
  const raw = env.HELAPOS_ALLOWED_IPS?.trim()
  if (!raw) return true
  if (!ip) return false
  const normalized = ip.replace(/^::ffff:/, '')
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return allowed.some((entry) => normalized === entry || ip === entry)
}

export function helaposNotifyUrl() {
  const base = env.BACKEND_URL.replace(/\/$/, '')
  const prefix = env.API_PREFIX.replace(/^\/+|\/+$/g, '')
  return `${base}/${prefix}/payments/helapos/webhook`
}

export function getHelaposPublicConfig() {
  return {
    enabled: isHelaposEnabled(),
    mock: isHelaposMockMode(),
    notifyUrl: helaposNotifyUrl(),
    sessionTtlMinutes: env.HELAPOS_SESSION_TTL_MINUTES ?? 15,
    signatureRequired: !!(
      env.HELAPOS_WEBHOOK_SECRET?.trim()
      || (env.HELAPOS_ENABLED === 'true' && env.HELAPOS_MOCK !== 'true' && env.NODE_ENV === 'production')
    ),
    fees: getHelaposFeePolicy(),
  }
}

export function helaposSessionExpiresAt(from = new Date()): Date {
  const mins = env.HELAPOS_SESSION_TTL_MINUTES ?? 15
  return new Date(from.getTime() + mins * 60_000)
}
