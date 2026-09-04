import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../../../middleware/validate.middleware'
import { requireModuleAccess } from '../../../middleware/module-access.middleware'
import { sendPaginated, sendSuccess } from '../../../utils/response'
import { getPagination } from '../../../utils/pagination'
import { effectiveBranchId } from '../../../utils/active-branch'
import {
  createPickListSchema,
  recordPickSchema,
  createDispatchSchema,
  bindImeiSchema,
} from './warehouse.schema'
import * as warehouseService from './warehouse.service'

export const warehouseRouter = Router()

warehouseRouter.get(
  '/pick-queue',
  requireModuleAccess('WHOLESALE_WAREHOUSE', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, page } = getPagination(req)
      const branchId =
        (req.query.branchId as string | undefined) || effectiveBranchId(req) || undefined
      const { data, total } = await warehouseService.pickQueue(req.tenantId!, {
        branchId,
        skip,
        limit,
      })
      sendPaginated(res, data, total, page, limit)
    } catch (e) {
      next(e)
    }
  },
)

warehouseRouter.get(
  '/pick-lists',
  requireModuleAccess('WHOLESALE_WAREHOUSE', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, page } = getPagination(req)
      const { data, total } = await warehouseService.listPickLists(req.tenantId!, {
        skip,
        limit,
        branchId: (req.query.branchId as string) || effectiveBranchId(req) || undefined,
        status: req.query.status as string | undefined,
      })
      sendPaginated(res, data, total, page, limit)
    } catch (e) {
      next(e)
    }
  },
)

warehouseRouter.post(
  '/pick-lists',
  requireModuleAccess('WHOLESALE_WAREHOUSE', 'edit'),
  validate(createPickListSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = { ...req.body }
      if (!body.branchId) body.branchId = effectiveBranchId(req) || undefined
      sendSuccess(
        res,
        await warehouseService.createPickList(req.tenantId!, body),
        'Pick list created',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

warehouseRouter.get(
  '/pick-lists/:id',
  requireModuleAccess('WHOLESALE_WAREHOUSE', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await warehouseService.getPickList(req.tenantId!, req.params.id))
    } catch (e) {
      next(e)
    }
  },
)

warehouseRouter.post(
  '/pick-lists/:id/pick',
  requireModuleAccess('WHOLESALE_WAREHOUSE', 'edit'),
  validate(recordPickSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await warehouseService.recordPick(req.tenantId!, req.params.id, req.body),
        'Pick recorded',
      )
    } catch (e) {
      next(e)
    }
  },
)

warehouseRouter.post(
  '/pick-lists/:id/complete',
  requireModuleAccess('WHOLESALE_WAREHOUSE', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await warehouseService.completePick(req.tenantId!, req.params.id),
        'Pick completed',
      )
    } catch (e) {
      next(e)
    }
  },
)

warehouseRouter.post(
  '/pick-lists/:id/pack',
  requireModuleAccess('WHOLESALE_WAREHOUSE', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await warehouseService.packPickList(req.tenantId!, req.params.id, req.body?.notes),
        'Pick list packed',
      )
    } catch (e) {
      next(e)
    }
  },
)

warehouseRouter.get(
  '/dispatches',
  requireModuleAccess('WHOLESALE_WAREHOUSE', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, page } = getPagination(req)
      const { data, total } = await warehouseService.listDispatches(req.tenantId!, {
        skip,
        limit,
        branchId: (req.query.branchId as string) || effectiveBranchId(req) || undefined,
        status: req.query.status as string | undefined,
      })
      sendPaginated(res, data, total, page, limit)
    } catch (e) {
      next(e)
    }
  },
)

warehouseRouter.post(
  '/dispatches',
  requireModuleAccess('WHOLESALE_WAREHOUSE', 'edit'),
  validate(createDispatchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await warehouseService.createDispatch(req.tenantId!, req.body),
        'Dispatch created',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

warehouseRouter.get(
  '/dispatches/:id',
  requireModuleAccess('WHOLESALE_WAREHOUSE', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await warehouseService.getDispatch(req.tenantId!, req.params.id))
    } catch (e) {
      next(e)
    }
  },
)

warehouseRouter.post(
  '/dispatches/:id/bind-imei',
  requireModuleAccess('WHOLESALE_WAREHOUSE', 'edit'),
  validate(bindImeiSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservedBy = req.user?.userId || req.user?.email || 'warehouse'
      sendSuccess(
        res,
        await warehouseService.bindDispatchImei(
          req.tenantId!,
          req.params.id,
          req.body.dispatchLineId,
          req.body.imei,
          reservedBy,
        ),
        'IMEI bound',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

warehouseRouter.post(
  '/dispatches/:id/confirm',
  requireModuleAccess('WHOLESALE_WAREHOUSE', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await warehouseService.confirmDispatch(req.tenantId!, req.params.id),
        'Dispatch confirmed — reservations released; invoice on POD',
      )
    } catch (e) {
      next(e)
    }
  },
)
