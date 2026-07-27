import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PREFIXES = ['/login', '/api/hub']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const adminToken = req.cookies.get('admin_token')?.value
  const fashionToken = req.cookies.get('hx_fashion_token')?.value
  const salonToken = req.cookies.get('hx_salon_token')?.value
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  let ok = false
  if (pathname.startsWith('/fashion')) {
    ok = !!(fashionToken || bearer)
  } else if (pathname.startsWith('/salon')) {
    ok = !!(salonToken || bearer)
  } else {
    // Enterprise admin pages — require Enterprise token specifically
    ok = !!(adminToken || bearer)
  }

  if (!ok) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('from', pathname)
    if (pathname.startsWith('/fashion')) loginUrl.searchParams.set('product', 'fashion')
    else if (pathname.startsWith('/salon')) loginUrl.searchParams.set('product', 'salon')
    else loginUrl.searchParams.set('product', 'enterprise')
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
