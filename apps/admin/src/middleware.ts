import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PREFIXES = ['/login', '/api/hub']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token =
    req.cookies.get('admin_token')?.value ||
    req.cookies.get('hx_fashion_token')?.value ||
    req.cookies.get('hx_salon_token')?.value ||
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
