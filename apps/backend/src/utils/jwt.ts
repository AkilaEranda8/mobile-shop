import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface JwtPayload {
  userId: string
  tenantId: string
  role: string
  email: string
  /** Support-session / admin impersonation only — not used for normal Keycloak logins */
  impersonation?: boolean
  /**
   * POS Quick PIN session when Keycloak subject Token Exchange is unavailable.
   * Issued only after Hexalyte verifies the tenant-scoped PIN.
   */
  posPinAuth?: boolean
}

const PLATFORM_ADMIN_ACCESS_TTL = '30d'
const PLATFORM_ADMIN_REFRESH_TTL = '30d'

function accessTtl(role?: string) {
  return role === 'PLATFORM_ADMIN' ? PLATFORM_ADMIN_ACCESS_TTL : env.JWT_EXPIRES_IN
}

function refreshTtl(role?: string) {
  return role === 'PLATFORM_ADMIN' ? PLATFORM_ADMIN_REFRESH_TTL : env.JWT_REFRESH_EXPIRES_IN
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: accessTtl(payload.role) as any })
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: refreshTtl(payload.role) as any })
}

/** Short-lived HS256 token for admin → shop support session */
export function signImpersonationToken(payload: Omit<JwtPayload, 'impersonation'>): string {
  return jwt.sign(
    { ...payload, impersonation: true },
    env.JWT_SECRET,
    { expiresIn: '2h' },
  )
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload
}

export function tryVerifyAppToken(token: string): JwtPayload | null {
  try {
    return verifyToken(token)
  } catch {
    return null
  }
}
