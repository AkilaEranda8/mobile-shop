export function getTenantSlugFromHost(hostname?: string): string | null {
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase()
  const match = host.match(/^([a-z0-9-]+)\.app\.hexalyte\.com$/)
  if (!match || match[1] === 'app') return null
  return match[1]
}
