import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const pathname = req.nextUrl.pathname

  const tenantMatch = host.match(/^([^.]+)\.app\.hexalyte\.com$/)
  if (!tenantMatch) return NextResponse.next()

  const slug = tenantMatch[1]

  const publicPaths = ['/login', '/register', '/api', '/_next', '/favicon']
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
