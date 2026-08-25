import type { ConfigDomain } from './configuration-engine.types'

type CacheEntry = { value: unknown; expiresAt: number }

/** Bounded in-process TTL cache — expired entries pruned; hard cap prevents growth. */
const store = new Map<string, CacheEntry>()
const MAX_ENTRIES = 500

function key(tenantId: string, domain: ConfigDomain) {
  return `${tenantId}::${domain}`
}

function pruneExpired() {
  const now = Date.now()
  for (const [k, entry] of store) {
    if (entry.expiresAt <= now) store.delete(k)
  }
}

function enforceCap() {
  if (store.size <= MAX_ENTRIES) return
  // Drop oldest-expiring first
  const ranked = [...store.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)
  const overflow = store.size - MAX_ENTRIES
  for (let i = 0; i < overflow; i++) store.delete(ranked[i][0])
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
  pruneExpired()
  store.set(key(tenantId, domain), { value, expiresAt: Date.now() + ttlMs })
  enforceCap()
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
