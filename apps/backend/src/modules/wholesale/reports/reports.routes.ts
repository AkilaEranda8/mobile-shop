import { Router, type Request, type Response, type NextFunction } from 'express'
import { requireModuleAccess } from '../../../middleware/module-access.middleware'
import { sendSuccess } from '../../../utils/response'
import { effectiveBranchId } from '../../../utils/active-branch'
import * as reportsService from './reports.service'

export const reportsRouter = Router()

function windowOpts(req: Request) {
  return {
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    branchId: (req.query.branchId as string) || effectiveBranchId(req) || undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    dealerId: req.query.dealerId as string | undefined,
  }
}

reportsRouter.get(
  '/sales-by-channel',
  requireModuleAccess('WHOLESALE_REPORTS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await reportsService.salesByChannel(req.tenantId!, windowOpts(req)))
    } catch (e) {
      next(e)
    }
  },
)

reportsRouter.get(
  '/sales-by-dealer',
  requireModuleAccess('WHOLESALE_REPORTS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await reportsService.salesByDealer(req.tenantId!, windowOpts(req)))
    } catch (e) {
      next(e)
    }
  },
)

reportsRouter.get(
  '/sales-by-product',
  requireModuleAccess('WHOLESALE_REPORTS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await reportsService.salesByProduct(req.tenantId!, windowOpts(req)))
    } catch (e) {
      next(e)
    }
  },
)

reportsRouter.get(
  '/movers',
  requireModuleAccess('WHOLESALE_REPORTS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await reportsService.movers(req.tenantId!, windowOpts(req)))
    } catch (e) {
      next(e)
    }
  },
)

reportsRouter.get(
  '/outstanding',
  requireModuleAccess('WHOLESALE_REPORTS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await reportsService.outstanding(req.tenantId!, windowOpts(req)))
    } catch (e) {
      next(e)
    }
  },
)
