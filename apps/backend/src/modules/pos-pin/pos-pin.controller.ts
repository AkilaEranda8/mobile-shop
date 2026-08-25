import { Request, Response, NextFunction } from 'express'
import { posPinService } from './pos-pin.service'
import { sendSuccess } from '../../utils/response'
import { getClientIp } from '../../utils/activity-log'
import { resolveTenantSlugFromRequest } from '../../utils/tenant-slug'
import { AppError } from '../../middleware/error.middleware'

export const posPinController = {
  async coldLoginAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantSlug = resolveTenantSlugFromRequest(req)
      if (!tenantSlug) {
        sendSuccess(res, { available: false, pinLength: 6 })
        return
      }
      const data = await posPinService.getColdLoginAvailability(tenantSlug)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantSlug = resolveTenantSlugFromRequest(req)
      if (!tenantSlug) throw new AppError('Shop context required for PIN login', 400)
      const data = await posPinService.loginByPin({
        tenantSlug,
        pin: req.body.pin,
        ip: getClientIp(req),
      })
      sendSuccess(res, data, 'PIN login successful')
    } catch (e) { next(e) }
  },

  async switchUser(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await posPinService.switchByPin({
        tenantId: req.tenantId!,
        currentUserId: req.user!.userId,
        pin: req.body.pin,
        ip: getClientIp(req),
      })
      sendSuccess(res, data, 'Cashier switched')
    } catch (e) { next(e) }
  },

  async unlock(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await posPinService.unlockByPin({
        tenantId: req.tenantId!,
        userId: req.user!.userId,
        pin: req.body.pin,
        ip: getClientIp(req),
      })
      sendSuccess(res, data, 'POS unlocked')
    } catch (e) { next(e) }
  },

  async setOwnPin(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await posPinService.setOwnPin({
        tenantId: req.tenantId!,
        userId: req.user!.userId,
        pin: req.body.pin,
        currentPin: req.body.currentPin,
        currentPassword: req.body.currentPassword,
        ip: getClientIp(req),
      })
      sendSuccess(res, data, 'PIN saved')
    } catch (e) { next(e) }
  },

  async myStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await posPinService.getPinStatusForUser(req.tenantId!, req.user!.userId)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async adminReset(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await posPinService.adminResetPin({
        tenantId: req.tenantId!,
        actorUserId: req.user!.userId,
        actorEmail: req.user!.email,
        targetUserId: req.params.id,
        pin: req.body.pin,
        mustChange: req.body.mustChange,
        ip: getClientIp(req),
      })
      sendSuccess(res, data, 'PIN reset')
    } catch (e) { next(e) }
  },

  async adminDisable(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await posPinService.disablePin({
        tenantId: req.tenantId!,
        actorUserId: req.user!.userId,
        actorEmail: req.user!.email,
        targetUserId: req.params.id,
        ip: getClientIp(req),
      })
      sendSuccess(res, data, 'PIN disabled')
    } catch (e) { next(e) }
  },

  async userStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await posPinService.getPinStatusForUser(req.tenantId!, req.params.id)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'PLATFORM_ADMIN' && req.params.id !== req.tenantId) {
        throw new AppError('Forbidden: cannot access another tenant', 403)
      }
      sendSuccess(res, await posPinService.getSettings(req.params.id))
    } catch (e) { next(e) }
  },

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'PLATFORM_ADMIN' && req.params.id !== req.tenantId) {
        throw new AppError('Forbidden: cannot access another tenant', 403)
      }
      sendSuccess(res, await posPinService.updateSettings(req.params.id, req.body))
    } catch (e) { next(e) }
  },
}
