import crypto from 'crypto'

type Entry = { token: string; expiresAt: number }

const store = new Map<string, Entry>()
const TTL_MS = 10 * 60 * 1000

function pruneExpired() {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key)
  }
}

export function createImpersonationCode(token: string, ttlMs = TTL_MS): string {
  pruneExpired()
  const code = crypto.randomBytes(24).toString('base64url')
  store.set(code, { token, expiresAt: Date.now() + ttlMs })
  return code
}

/** Returns the JWT once, then invalidates the code. */
export function consumeImpersonationCode(code: string): string | null {
  const entry = store.get(code)
  if (!entry) return null
  store.delete(code)
  if (Date.now() > entry.expiresAt) return null
  return entry.token
}
