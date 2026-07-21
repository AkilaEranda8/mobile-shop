import { env } from '../config/env'

/** Base app host — `app.hexalyte.com` or `test.app.hexalyte.com`. */
export function tenantAppBaseDomain(): string {
  try {
    const host = new URL(env.FRONTEND_URL).hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1') return host
    return host
  } catch {
    return 'app.hexalyte.com'
  }
}

/** Per-tenant shop hostname, e.g. `my-shop.test.app.hexalyte.com`. */
export function tenantShopHost(slug: string): string {
  return `${slug}.${tenantAppBaseDomain()}`
}

export function tenantShopUrl(slug: string, path = '/dashboard'): string {
  const base = tenantAppBaseDomain()
  if (base === 'localhost' || base === '127.0.0.1') {
    const port = (() => {
      try { return new URL(env.FRONTEND_URL).port } catch { return '3000' }
    })()
    return `http://${base}:${port || '3000'}${path}`
  }
  return `https://${tenantShopHost(slug)}${path}`
}
