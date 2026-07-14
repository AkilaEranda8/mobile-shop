import { Request, Response, NextFunction } from 'express'
import { createPublicKey } from 'crypto'
import jwt from 'jsonwebtoken'
import { tryVerifyAppToken, JwtPayload } from '../utils/jwt'
import { sendError } from '../utils/response'
import { AppError } from './error.middleware'
import { redis } from '../config/redis'
import { env } from '../config/env'
import { ensureTenantAccess } from '../utils/tenant-access'
import { resolveActiveBranch } from '../utils/active-branch'
import { isKcAuthEnabled } from '../utils/keycloakAdmin'
import { prisma } from '../config/database'

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
    if (!res.ok) throw new Error(`KC JWKS fetch failed: ${res.status}`)
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
  const claimUserId = String(payload['db_user_id'] ?? '')
  const email = String(payload['email'] ?? payload['preferred_username'] ?? '')

  // Hexalyte DB is source of truth for id/tenant/role. KC claim mappers are optional;
  // without them, missing user_role used to default everyone to CASHIER and break OWNER APIs
  // like Staff & Roles (GET /users → 403).
  const user = claimUserId
    ? await prisma.user.findFirst({
        where: { id: claimUserId, isActive: true },
        select: { id: true, tenantId: true, role: true, email: true },
      })
    : email
      ? await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' }, isActive: true },
          select: { id: true, tenantId: true, role: true, email: true },
        })
      : null

  if (!user) throw new Error('KC token could not be mapped to a Hexalyte user')

  return {
    userId: user.id,
    tenantId: user.tenantId,
    role: validRoles.includes(user.role) ? user.role : 'CASHIER',
    email: user.email,
  }
}

async function resolveRequestUser(token: string): Promise<JwtPayload> {
  // Support impersonation (HS256 app JWT) always allowed when claim is present
  const appPayload = tryVerifyAppToken(token)
  if (appPayload?.impersonation) return appPayload

  if (isKcAuthEnabled()) {
    try {
      return await verifyKcToken(token)
    } catch {
      // Fall through: allow legacy/non-impersonation app JWT only when KC auth is off.
      // When KC is on, reject plain app JWTs so cutover is real.
      throw new Error('Invalid Keycloak token')
    }
  }

  if (appPayload) return appPayload
  throw new Error('Invalid token')
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

    req.user = await resolveRequestUser(token)
    req.tenantId = req.user.tenantId
    if (req.user.role !== 'PLATFORM_ADMIN' && req.user.tenantId) {
      try {
        await ensureTenantAccess(req.user.tenantId)
      } catch (err) {
        if (err instanceof AppError) {
          sendError(res, err.message, err.statusCode)
          return
        }
        sendError(res, 'Account access denied', 403)
        return
      }
    }
    if (req.user.role !== 'PLATFORM_ADMIN' && req.tenantId) {
      try {
        await resolveActiveBranch(req, { allowAll: true })
      } catch (err) {
        if (err instanceof AppError) {
          sendError(res, err.message, err.statusCode)
          return
        }
        throw err
      }
    }
    next()
  } catch {
    sendError(res, 'Invalid or expired token', 401)
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { sendError(res, 'Unauthorized', 401); return }
    if (req.user.role === 'PLATFORM_ADMIN') { next(); return }
    if (roles.length && !roles.includes(req.user.role)) {
      sendError(res, 'Forbidden: insufficient permissions', 403)
      return
    }
    next()
  }
}
