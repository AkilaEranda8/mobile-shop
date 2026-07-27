import { NextRequest, NextResponse } from 'next/server'

const SALON_API =
  process.env.SALON_API_URL ||
  process.env.NEXT_PUBLIC_SALON_API_URL ||
  'http://localhost:5000'

const PLATFORM_SECRET = process.env.SALON_PLATFORM_SECRET || ''

/** Salon legacy login puts JWT in httpOnly Set-Cookie — extract for hub clients. */
function extractTokenFromSetCookie(upstream: Response): string | null {
  const headers = upstream.headers as Headers & { getSetCookie?: () => string[] }
  const cookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [upstream.headers.get('set-cookie')].filter((c): c is string => !!c)

  for (const raw of cookies) {
    // May be comma-joined when getSetCookie unavailable
    for (const part of raw.split(/,(?=\s*[^;=]+=)/)) {
      const m = /^\s*token=([^;]+)/i.exec(part)
      if (m?.[1]) {
        try {
          return decodeURIComponent(m[1].trim())
        } catch {
          return m[1].trim()
        }
      }
    }
  }
  return null
}

function isAuthLoginPath(path: string) {
  return (
    path === 'auth/login' ||
    path === 'auth/2fa/verify-login' ||
    path.endsWith('/auth/login') ||
    path.endsWith('/auth/2fa/verify-login')
  )
}

async function proxy(req: NextRequest, pathParts: string[]) {
  const path = pathParts.join('/')
  const url = new URL(req.url)
  // Client paths are /auth/... or /platform/... → upstream /api/auth/... or /api/platform/...
  const target = `${SALON_API.replace(/\/$/, '')}/api/${path}${url.search}`

  const headers = new Headers()
  const contentType = req.headers.get('content-type')
  const auth = req.headers.get('authorization')
  if (contentType) headers.set('content-type', contentType)
  if (auth) headers.set('authorization', auth)
  if (PLATFORM_SECRET) headers.set('x-platform-key', PLATFORM_SECRET)

  const init: RequestInit = {
    method: req.method,
    headers,
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer()
  }

  try {
    const upstream = await fetch(target, init)
    const contentTypeOut = upstream.headers.get('content-type') || ''
    const isJson = contentTypeOut.includes('application/json')

    // Legacy Salon login: cookie-only token → inject into JSON for hub localStorage
    if (isAuthLoginPath(path) && isJson && upstream.ok) {
      const text = await upstream.text()
      let json: Record<string, unknown> = {}
      try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
      } catch {
        return new NextResponse(text, {
          status: upstream.status,
          headers: { 'content-type': contentTypeOut },
        })
      }

      const cookieToken = extractTokenFromSetCookie(upstream)
      if (cookieToken && !json.token && !json.access_token) {
        json.token = cookieToken
        json.access_token = cookieToken
      }

      return NextResponse.json(json, { status: upstream.status })
    }

    const body = await upstream.arrayBuffer()
    const outHeaders = new Headers()
    if (contentTypeOut) outHeaders.set('content-type', contentTypeOut)
    return new NextResponse(body, { status: upstream.status, headers: outHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Salon proxy failed'
    return NextResponse.json(
      { message: `Salon API unreachable (${SALON_API}): ${message}` },
      { status: 502 },
    )
  }
}

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}
