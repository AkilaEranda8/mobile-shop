import crypto from 'crypto'

export type SessionExchangePayload = {
  accessToken: string
  refreshToken: string
  user: Record<string, unknown>
}

type Entry = { payload: SessionExchangePayload; expiresAt: number }

const store = new Map<string, Entry>()
const TTL_MS = 10 * 60 * 1000

function pruneExpired() {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key)
  }
}

export function createSessionExchangeCode(payload: SessionExchangePayload, ttlMs = TTL_MS): string {
  pruneExpired()
  const code = crypto.randomBytes(24).toString('base64url')
  store.set(code, { payload, expiresAt: Date.now() + ttlMs })
  return code
}

/** Returns session payload once, then invalidates the code. */
export function consumeSessionExchangeCode(code: string): SessionExchangePayload | null {
  const entry = store.get(code)
  if (!entry) return null
  store.delete(code)
  if (Date.now() > entry.expiresAt) return null
  return entry.payload
}
