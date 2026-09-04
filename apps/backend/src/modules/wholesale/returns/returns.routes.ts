import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../../../middleware/validate.middleware'
import { requireModuleAccess } from '../../../middleware/module-access.middleware'
import { sendPaginated, sendSuccess } from '../../../utils/response'
import { getPagination } from '../../../utils/pagination'
import { effectiveBranchId } from '../../../utils/active-branch'
import { createReturnSchema, dispositionSchema } from './returns.schema'
import * as returnsService from './returns.service'

export const returnsRouter = Router()

returnsRouter.get(
  '/',
  requireModuleAccess('WHOLESALE_RETURNS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, page } = getPagination(req)
      const { data, total } = await returnsService.listReturns(req.tenantId!, {
        skip,
        limit,
        status: req.query.status as string | undefined,
        dealerId: req.query.dealerId as string | undefined,
      })
      sendPaginated(res, data, total, page, limit)
    } catch (e) {
      next(e)
    }
  },
)

returnsRouter.post(
  '/',
  requireModuleAccess('WHOLESALE_RETURNS', 'edit'),
  validate(createReturnSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = { ...req.body }
      if (!body.branchId) body.branchId = effectiveBranchId(req) || undefined
      sendSuccess(
        res,
        await returnsService.createReturn(req.tenantId!, body),
        'Return created',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

returnsRouter.get(
  '/:id',
  requireModuleAccess('WHOLESALE_RETURNS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await returnsService.getReturn(req.tenantId!, req.params.id))
    } catch (e) {
      next(e)
    }
  },
)

returnsRouter.post(
  '/:id/approve',
  requireModuleAccess('WHOLESALE_RETURNS', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await returnsService.approveReturn(req.tenantId!, req.params.id),
        'Return approved',
      )
    } catch (e) {
      next(e)
    }
  },
)

returnsRouter.post(
  '/:id/qc',
  requireModuleAccess('WHOLESALE_RETURNS', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await returnsService.receiveQc(req.tenantId!, req.params.id), 'QC recorded')
    } catch (e) {
      next(e)
    }
  },
)

returnsRouter.post(
  '/:id/disposition',
  requireModuleAccess('WHOLESALE_RETURNS', 'edit'),
  validate(dispositionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await returnsService.setDisposition(req.tenantId!, req.params.id, req.body),
        'Disposition set',
      )
    } catch (e) {
      next(e)
    }
  },
)

returnsRouter.post(
  '/:id/credit-note',
  requireModuleAccess('WHOLESALE_RETURNS', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await returnsService.createCreditNote(req.tenantId!, req.params.id, {
        email: req.user?.email,
        performedBy: req.user?.email || req.user?.userId || 'system',
      })
      sendSuccess(res, result, 'Credit note created', 201)
    } catch (e) {
      next(e)
    }
  },
)

returnsRouter.post(
  '/:id/close',
  requireModuleAccess('WHOLESALE_RETURNS', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await returnsService.closeReturn(req.tenantId!, req.params.id), 'Return closed')
    } catch (e) {
      next(e)
    }
  },
)
