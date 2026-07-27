import { NextRequest, NextResponse } from 'next/server'

const FASHION_API =
  process.env.FASHION_API_URL ||
  process.env.NEXT_PUBLIC_FASHION_API_URL ||
  'http://localhost:4000/api/v1'

async function proxy(req: NextRequest, pathParts: string[]) {
  const path = pathParts.join('/')
  const url = new URL(req.url)
  const target = `${FASHION_API.replace(/\/$/, '')}/${path}${url.search}`

  const headers = new Headers()
  const contentType = req.headers.get('content-type')
  const auth = req.headers.get('authorization')
  const tenant = req.headers.get('x-tenant-id')
  if (contentType) headers.set('content-type', contentType)
  if (auth) headers.set('authorization', auth)
  if (tenant) headers.set('x-tenant-id', tenant)

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
    const message = err instanceof Error ? err.message : 'Fashion proxy failed'
    return NextResponse.json(
      { message: `Fashion API unreachable (${FASHION_API}): ${message}` },
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
