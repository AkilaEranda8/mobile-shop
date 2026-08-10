import { Request, Response, NextFunction } from 'express'
import { AppError } from '../../middleware/error.middleware'
import { isFeatureEnabledForBranch } from '../../utils/tenant-feature.util'
import { effectiveBranchId } from '../../utils/active-branch'

export async function requireAccountingFeature(req: Request, _res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenantId
    if (!tenantId) throw new AppError('Tenant context required', 401)
    const enabled = await isFeatureEnabledForBranch(tenantId, effectiveBranchId(req), 'ACCOUNTING')
    if (!enabled) {
      throw new AppError('Accounting module is not enabled for this branch. Contact your administrator.', 403)
    }
    next()
  } catch (e) {
    next(e)
  }
}
