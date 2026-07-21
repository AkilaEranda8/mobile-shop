import { NextRequest, NextResponse } from 'next/server'

function tenantSlugFromHost(host: string): string | null {
  const h = host.toLowerCase().split(':')[0]
  const testMatch = h.match(/^([a-z0-9-]+)\.test\.app\.hexalyte\.com$/)
  if (testMatch) return testMatch[1]
  const prodMatch = h.match(/^([a-z0-9-]+)\.app\.hexalyte\.com$/)
  if (prodMatch && prodMatch[1] !== 'app' && prodMatch[1] !== 'test') return prodMatch[1]
  return null
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const pathname = req.nextUrl.pathname

  const slug = tenantSlugFromHost(host)
  if (!slug) return NextResponse.next()

  const publicPaths = ['/login', '/register', '/privacy', '/terms', '/establish-session', '/support-session', '/api', '/_next', '/favicon', '/.well-known']
  if (publicPaths.some(p => pathname.startsWith(p))) return NextResponse.next()

  if (pathname === '/') {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('tenant', slug)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
