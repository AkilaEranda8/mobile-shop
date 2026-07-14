import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface JwtPayload {
  userId: string
  tenantId: string
  role: string
  email: string
  /** Support-session / admin impersonation only — not used for normal Keycloak logins */
  impersonation?: boolean
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any })
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any })
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
