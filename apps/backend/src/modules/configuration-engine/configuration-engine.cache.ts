import type { ConfigDomain } from './configuration-engine.types'

type CacheEntry = { value: unknown; expiresAt: number }

const store = new Map<string, CacheEntry>()

function key(tenantId: string, domain: ConfigDomain) {
  return `${tenantId}::${domain}`
}

/** In-process TTL cache for config reads (Phase 1). */
export function cacheGet<T>(tenantId: string, domain: ConfigDomain): T | undefined {
  const entry = store.get(key(tenantId, domain))
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(key(tenantId, domain))
    return undefined
  }
  return entry.value as T
}

export function cacheSet(tenantId: string, domain: ConfigDomain, value: unknown, ttlMs: number) {
  store.set(key(tenantId, domain), { value, expiresAt: Date.now() + ttlMs })
}

export function cacheInvalidate(tenantId: string, domain?: ConfigDomain) {
  if (domain) {
    store.delete(key(tenantId, domain))
    return
  }
  for (const k of store.keys()) {
    if (k.startsWith(`${tenantId}::`)) store.delete(k)
  }
}

export function cacheClearAll() {
  store.clear()
}
