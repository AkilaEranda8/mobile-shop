import { Request, Response, NextFunction } from 'express'
import { AppError } from '../../middleware/error.middleware'
import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'

export const HR_PAYROLL_FEATURE = 'HR_PAYROLL'

export async function requireHrFeature(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!(await isTenantFeatureEnabled(req.tenantId!, HR_PAYROLL_FEATURE))) {
      throw new AppError('HR & Payroll is not enabled for this shop', 403)
    }
    next()
  } catch (e) {
    next(e)
  }
}
