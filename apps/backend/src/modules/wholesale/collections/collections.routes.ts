import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../../../middleware/validate.middleware'
import { requireModuleAccess } from '../../../middleware/module-access.middleware'
import { sendPaginated, sendSuccess } from '../../../utils/response'
import { getPagination } from '../../../utils/pagination'
import { effectiveBranchId } from '../../../utils/active-branch'
import {
  recordPaymentSchema,
  createTaskSchema,
  updateTaskSchema,
} from './collections.schema'
import * as collectionsService from './collections.service'

export const collectionsRouter = Router()

collectionsRouter.get(
  '/ageing',
  requireModuleAccess('WHOLESALE_COLLECTIONS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await collectionsService.ageingReport(
          req.tenantId!,
          req.query.dealerId as string | undefined,
        ),
      )
    } catch (e) {
      next(e)
    }
  },
)

collectionsRouter.get(
  '/statement/:dealerId',
  requireModuleAccess('WHOLESALE_COLLECTIONS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await collectionsService.dealerStatement(
          req.tenantId!,
          req.params.dealerId,
          req.query.from as string | undefined,
          req.query.to as string | undefined,
        ),
      )
    } catch (e) {
      next(e)
    }
  },
)

collectionsRouter.get(
  '/payments',
  requireModuleAccess('WHOLESALE_COLLECTIONS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, page } = getPagination(req)
      const { data, total } = await collectionsService.listPayments(req.tenantId!, {
        skip,
        limit,
        dealerId: req.query.dealerId as string | undefined,
      })
      sendPaginated(res, data, total, page, limit)
    } catch (e) {
      next(e)
    }
  },
)

collectionsRouter.post(
  '/payments',
  requireModuleAccess('WHOLESALE_COLLECTIONS', 'edit'),
  validate(recordPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = { ...req.body }
      if (!body.branchId) body.branchId = effectiveBranchId(req) || null
      sendSuccess(
        res,
        await collectionsService.recordPayment(
          req.tenantId!,
          body,
          req.user?.userId,
          req.user?.email,
        ),
        'Payment recorded',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

collectionsRouter.get(
  '/tasks',
  requireModuleAccess('WHOLESALE_COLLECTIONS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, page } = getPagination(req)
      const { data, total } = await collectionsService.listTasks(req.tenantId!, {
        skip,
        limit,
        status: req.query.status as string | undefined,
        assigneeId: req.query.assigneeId as string | undefined,
      })
      sendPaginated(res, data, total, page, limit)
    } catch (e) {
      next(e)
    }
  },
)

collectionsRouter.post(
  '/tasks',
  requireModuleAccess('WHOLESALE_COLLECTIONS', 'edit'),
  validate(createTaskSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = { ...req.body }
      if (!body.branchId) body.branchId = effectiveBranchId(req) || null
      sendSuccess(
        res,
        await collectionsService.createTask(req.tenantId!, body),
        'Collection task created',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

collectionsRouter.patch(
  '/tasks/:id',
  requireModuleAccess('WHOLESALE_COLLECTIONS', 'edit'),
  validate(updateTaskSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await collectionsService.updateTask(req.tenantId!, req.params.id, req.body),
        'Task updated',
      )
    } catch (e) {
      next(e)
    }
  },
)
