import { NextRequest, NextResponse } from 'next/server'

const SALON_API =
  process.env.SALON_API_URL ||
  process.env.NEXT_PUBLIC_SALON_API_URL ||
  'http://localhost:5000'

const PLATFORM_SECRET = process.env.SALON_PLATFORM_SECRET || ''

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
    const body = await upstream.arrayBuffer()
    const outHeaders = new Headers()
    const upstreamType = upstream.headers.get('content-type')
    if (upstreamType) outHeaders.set('content-type', upstreamType)
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
