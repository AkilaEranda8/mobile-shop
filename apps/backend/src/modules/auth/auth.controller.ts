import { Request, Response, NextFunction } from 'express'
import { authService } from './auth.service'
import { sendSuccess } from '../../utils/response'

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      let tenantSlug = String(req.header('x-tenant-id') ?? '').trim()
      if (!tenantSlug) {
        const host = String(req.headers.host ?? '')
        const m = host.match(/^shop\.([^.]+)\.api\.hexalyte\.com$/)
        if (m) tenantSlug = m[1]
      }
      const result = await authService.login(req.body.email, req.body.password, tenantSlug || undefined)
      sendSuccess(res, result, 'Login successful')
    } catch (e) { next(e) }
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
      await authService.logout(token, req.user!.userId)
      sendSuccess(res, null, 'Logged out')
    } catch (e) { next(e) }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.me(req.user!.userId)
      sendSuccess(res, user)
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
