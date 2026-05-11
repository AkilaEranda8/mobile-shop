import { Request, Response, NextFunction } from 'express'
import { createPublicKey } from 'crypto'
import jwt from 'jsonwebtoken'
import { verifyToken, JwtPayload } from '../utils/jwt'
import { sendError } from '../utils/response'
import { redis } from '../config/redis'
import { env } from '../config/env'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
      tenantId?: string
    }
  }
}

// ── JWKS cache (30 min TTL) ───────────────────────────────────────────────────
interface JwkKey { kid: string; kty: string; n: string; e: string; use: string; alg: string }
let jwksCache: { keys: JwkKey[]; expiresAt: number } | null = null

async function getPublicKey(kid: string): Promise<string> {
  if (!jwksCache || Date.now() > jwksCache.expiresAt) {
    const url = `${env.KEYCLOAK_URL}/realms/${env.KC_REALM}/protocol/openid-connect/certs`
    const res = await fetch(url)
    const data = await res.json() as { keys: JwkKey[] }
    jwksCache = { keys: data.keys ?? [], expiresAt: Date.now() + 30 * 60 * 1000 }
  }
  const jwk = jwksCache.keys.find(k => k.kid === kid)
  if (!jwk) throw new Error(`KC public key not found for kid: ${kid}`)
  const pubKey = createPublicKey({ key: jwk as any, format: 'jwk' })
  return pubKey.export({ format: 'pem', type: 'spki' }) as string
}

async function verifyKcToken(token: string): Promise<JwtPayload> {
  const decoded = jwt.decode(token, { complete: true })
  if (!decoded || typeof decoded.header !== 'object') throw new Error('Malformed token')
  const pem = await getPublicKey(decoded.header.kid as string)
  const payload = jwt.verify(token, pem, { algorithms: ['RS256'] }) as Record<string, unknown>
  const validRoles = ['PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']
  const role = String(payload['user_role'] ?? payload['salon_role'] ?? 'CASHIER')
  return {
    userId:   String(payload['db_user_id'] ?? payload['sub'] ?? ''),
    tenantId: String(payload['tenant_id'] ?? ''),
    role:     validRoles.includes(role) ? role : 'CASHIER',
    email:    String(payload['email'] ?? ''),
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 'Unauthorized', 401)
    return
  }
  const token = authHeader.slice(7)
  try {
    const blacklisted = await redis.get(`blacklist:${token}`)
    if (blacklisted) { sendError(res, 'Token revoked', 401); return }

    if (env.KEYCLOAK_AUTH_ENABLED === 'true' && env.KEYCLOAK_URL) {
      req.user = await verifyKcToken(token)
    } else {
      req.user = verifyToken(token)
    }
    req.tenantId = req.user.tenantId
    next()
  } catch {
    sendError(res, 'Invalid or expired token', 401)
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { sendError(res, 'Unauthorized', 401); return }
    if (roles.length && !roles.includes(req.user.role)) {
      sendError(res, 'Forbidden: insufficient permissions', 403)
      return
    }
    next()
  }
}
