import { Request, Response, NextFunction } from 'express'
import { authService } from './auth.service'
import { sendSuccess } from '../../utils/response'
import { AppError } from '../../middleware/error.middleware'
import { getClientIp, logPlatformActivity } from '../../utils/activity-log'

async function logLoginAttempt(
  req: Request,
  email: string,
  success: boolean,
  result?: { user: { id: string; email: string; name: string; role: string; tenantId: string } },
  error?: unknown,
) {
  const ip = getClientIp(req)
  if (success && result) {
    const isAdmin = result.user.role === 'PLATFORM_ADMIN'
    await logPlatformActivity({
      eventType: isAdmin ? 'ADMIN_LOGIN' : 'TENANT_LOGIN',
      severity: 'INFO',
      actorType: isAdmin ? 'ADMIN' : 'TENANT',
      actor: result.user.email,
      target: result.user.name,
      details: `Successful login · role ${result.user.role}`,
      ip,
      tenantId: result.user.tenantId,
      userId: result.user.id,
    })
    return
  }

  let eventType = 'LOGIN_FAILED'
  let severity = 'WARN'
  let details = 'Invalid email or password'
  if (error instanceof AppError) {
    details = error.message
    if (error.statusCode === 503) {
      eventType = 'LOGIN_BLOCKED'
      severity = 'ERROR'
    }
  }
  await logPlatformActivity({
    eventType,
    severity,
    actorType: 'TENANT',
    actor: email,
    target: '—',
    details,
    ip,
  })
}

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    const email = String(req.body?.email ?? '').trim().toLowerCase() || 'unknown'
    try {
      let tenantSlug = String(req.header('x-tenant-id') ?? req.header('x-tenant-slug') ?? '').trim()
      if (!tenantSlug) {
        const host = String(req.headers.host ?? '').toLowerCase().split(':')[0]
        const testMatch = host.match(/^([a-z0-9-]+)\.test\.app\.hexalyte\.com$/)
        if (testMatch) tenantSlug = testMatch[1]
        const appMatch = host.match(/^([a-z0-9-]+)\.app\.hexalyte\.com$/)
        if (!tenantSlug && appMatch && appMatch[1] !== 'app' && appMatch[1] !== 'test') tenantSlug = appMatch[1]
        const shopMatch = host.match(/^shop\.([^.]+)\.api\.hexalyte\.com$/)
        if (shopMatch) tenantSlug = shopMatch[1]
      }
      const result = await authService.login(req.body.email, req.body.password, tenantSlug || undefined)
      await logLoginAttempt(req, email, true, result)
      sendSuccess(res, result, 'Login successful')
    } catch (e) {
      await logLoginAttempt(req, email, false, undefined, e)
      next(e)
    }
  },

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.registerTenant(req.body)
      sendSuccess(res, result, 'Account created', 201)
    } catch (e) { next(e) }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.refresh(req.body.refreshToken)
      sendSuccess(res, result)
    } catch (e) { next(e) }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization!.slice(7)
      const user = req.user!
      const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined
      await authService.logout(token, user.userId, refreshToken)
      const isAdmin = user.role === 'PLATFORM_ADMIN'
      await logPlatformActivity({
        eventType: 'LOGOUT',
        severity: 'INFO',
        actorType: isAdmin ? 'ADMIN' : 'TENANT',
        actor: user.email,
        target: user.email,
        details: `User logged out · role ${user.role}`,
        ip: getClientIp(req),
        tenantId: user.tenantId,
        userId: user.userId,
      })
      sendSuccess(res, null, 'Logged out')
    } catch (e) { next(e) }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.me(req.user!.userId)
      sendSuccess(res, user)
    } catch (e) { next(e) }
  },

  async impersonateExchange(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.impersonateExchange(req.body.code)
      sendSuccess(res, result, 'Support session ready')
    } catch (e) { next(e) }
  },

  async sessionExchange(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.sessionExchange(req.body.code)
      sendSuccess(res, result, 'Session ready')
    } catch (e) { next(e) }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.changePassword(req.user!.userId, req.body.currentPassword, req.body.newPassword)
      sendSuccess(res, null, 'Password changed')
    } catch (e) { next(e) }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.forgotPassword(req.body.email)
      sendSuccess(res, null, 'If that email exists, a reset link has been sent')
    } catch (e) { next(e) }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.resetPassword(req.body.token, req.body.newPassword)
      sendSuccess(res, null, 'Password has been reset. You can now log in.')
    } catch (e) { next(e) }
  },

  // ── Keycloak proxy ──────────────────────────────────────────────────────────
  async kcLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.kcLogin(req.body.username ?? req.body.email, req.body.password)
      sendSuccess(res, result, 'Login successful')
    } catch (e) { next(e) }
  },

  async kcRefresh(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.kcRefresh(req.body.refreshToken)
      sendSuccess(res, result)
    } catch (e) { next(e) }
  },

  async kcLogout(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.kcLogout(req.body.refreshToken)
      sendSuccess(res, null, 'Logged out')
    } catch (e) { next(e) }
  },
}
