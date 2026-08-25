import { Request } from 'express'

/** Resolve tenant slug from headers / host (same rules as password login). */
export function resolveTenantSlugFromRequest(req: Request): string {
  let tenantSlug = String(req.header('x-tenant-id') ?? req.header('x-tenant-slug') ?? '').trim()
  if (tenantSlug) return tenantSlug

  const host = String(req.headers.host ?? '').toLowerCase().split(':')[0]
  const testMatch = host.match(/^([a-z0-9-]+)\.test\.app\.hexalyte\.com$/)
  if (testMatch) return testMatch[1]
  const appMatch = host.match(/^([a-z0-9-]+)\.app\.hexalyte\.com$/)
  if (appMatch && appMatch[1] !== 'app' && appMatch[1] !== 'test') return appMatch[1]
  const shopMatch = host.match(/^shop\.([^.]+)\.api\.hexalyte\.com$/)
  if (shopMatch) return shopMatch[1]
  return ''
}
