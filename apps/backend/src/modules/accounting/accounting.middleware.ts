import { Request, Response, NextFunction } from 'express'
import { AppError } from '../../middleware/error.middleware'
import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'

export async function requireAccountingFeature(req: Request, _res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenantId
    if (!tenantId) throw new AppError('Tenant context required', 401)
    const enabled = await isTenantFeatureEnabled(tenantId, 'ACCOUNTING')
    if (!enabled) {
      throw new AppError('Accounting module is not enabled for this shop. Contact your administrator.', 403)
    }
    next()
  } catch (e) {
    next(e)
  }
}
