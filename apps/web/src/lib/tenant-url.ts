/** Resolve tenant slug from a shop hostname. */
export function getTenantSlugFromHost(hostname?: string): string | null {
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase()

  const testMatch = host.match(/^([a-z0-9-]+)\.test\.app\.hexalyte\.com$/)
  if (testMatch) return testMatch[1]

  const prodMatch = host.match(/^([a-z0-9-]+)\.app\.hexalyte\.com$/)
  if (prodMatch && prodMatch[1] !== 'app' && prodMatch[1] !== 'test') return prodMatch[1]

  return null
}

/** Shared app host — `app.hexalyte.com` or `test.app.hexalyte.com` (not a shop subdomain). */
export function isSharedAppHost(hostname?: string): boolean {
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase()
  return (
    host === 'app.hexalyte.com'
    || host === 'test.app.hexalyte.com'
    || host === 'localhost'
    || host === '127.0.0.1'
  )
}

/**
 * PIN login UI is available on shop subdomains always,
 * and on the shared test host / localhost (shop code required there).
 * Production shared host `app.hexalyte.com` stays password-only.
 */
export function canUsePinLoginOnHost(hostname?: string): boolean {
  if (getTenantSlugFromHost(hostname)) return true
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase()
  return host === 'test.app.hexalyte.com' || host === 'localhost' || host === '127.0.0.1'
}

/** Shared app host — `app.hexalyte.com` or `test.app.hexalyte.com`. */
export function getAppBaseDomain(hostname?: string): string {
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1') return host
  if (host === 'test.app.hexalyte.com' || host.endsWith('.test.app.hexalyte.com')) return 'test.app.hexalyte.com'
  return 'app.hexalyte.com'
}

/** Full HTTPS URL for a tenant shop (register redirect, links). */
export function tenantShopUrl(slug: string, path = '/dashboard'): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      const port = window.location.port || '3000'
      return `${window.location.protocol}//${host}:${port}${path}`
    }
  }
  const base = getAppBaseDomain()
  if (base === 'localhost' || base === '127.0.0.1') return path
  return `https://${slug}.${base}${path}`
}
