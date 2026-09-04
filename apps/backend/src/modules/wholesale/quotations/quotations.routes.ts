import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../../../middleware/validate.middleware'
import { requireModuleAccess } from '../../../middleware/module-access.middleware'
import { sendPaginated, sendSuccess } from '../../../utils/response'
import { getPagination } from '../../../utils/pagination'
import { effectiveBranchId } from '../../../utils/active-branch'
import {
  createQuotationSchema,
  updateQuotationSchema,
  rejectQuotationSchema,
} from './quotations.schema'
import * as quotationsService from './quotations.service'

export const quotationsRouter = Router()

quotationsRouter.get(
  '/',
  requireModuleAccess('WHOLESALE_ORDERS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, page, search } = getPagination(req)
      const { data, total } = await quotationsService.listQuotations(req.tenantId!, {
        skip,
        limit,
        search,
        status: req.query.status as string | undefined,
        dealerId: req.query.dealerId as string | undefined,
      })
      sendPaginated(res, data, total, page, limit)
    } catch (e) {
      next(e)
    }
  },
)

quotationsRouter.post(
  '/',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  validate(createQuotationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = { ...req.body }
      if (!body.branchId) body.branchId = effectiveBranchId(req) || null
      const row = await quotationsService.createQuotation(req.tenantId!, body, req.user?.userId)
      sendSuccess(res, row, 'Quotation created', 201)
    } catch (e) {
      next(e)
    }
  },
)

quotationsRouter.get(
  '/:id',
  requireModuleAccess('WHOLESALE_ORDERS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await quotationsService.getQuotation(req.tenantId!, req.params.id))
    } catch (e) {
      next(e)
    }
  },
)

quotationsRouter.patch(
  '/:id',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  validate(updateQuotationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await quotationsService.updateQuotation(req.tenantId!, req.params.id, req.body),
        'Quotation updated',
      )
    } catch (e) {
      next(e)
    }
  },
)

quotationsRouter.post(
  '/:id/issue',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await quotationsService.issueQuotation(req.tenantId!, req.params.id),
        'Quotation issued',
      )
    } catch (e) {
      next(e)
    }
  },
)

quotationsRouter.post(
  '/:id/accept',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await quotationsService.acceptQuotation(req.tenantId!, req.params.id, req.user?.userId),
        'Quotation accepted — sales order created',
      )
    } catch (e) {
      next(e)
    }
  },
)

quotationsRouter.post(
  '/:id/reject',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  validate(rejectQuotationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await quotationsService.rejectQuotation(req.tenantId!, req.params.id, req.body.reason),
        'Quotation rejected',
      )
    } catch (e) {
      next(e)
    }
  },
)

quotationsRouter.post(
  '/:id/revise',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await quotationsService.reviseQuotation(req.tenantId!, req.params.id, req.user?.userId),
        'Quotation revised',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)
