import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../../../middleware/validate.middleware'
import { requireModuleAccess } from '../../../middleware/module-access.middleware'
import { sendPaginated, sendSuccess } from '../../../utils/response'
import { getPagination } from '../../../utils/pagination'
import { effectiveBranchId } from '../../../utils/active-branch'
import {
  createOrderSchema,
  updateOrderSchema,
  holdOrderSchema,
  releaseHoldSchema,
} from './orders.schema'
import * as ordersService from './orders.service'

export const ordersRouter = Router()

ordersRouter.get(
  '/',
  requireModuleAccess('WHOLESALE_ORDERS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, page, search } = getPagination(req)
      const { data, total } = await ordersService.listOrders(req.tenantId!, {
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

ordersRouter.post(
  '/',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  validate(createOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = { ...req.body }
      if (!body.branchId) body.branchId = effectiveBranchId(req) || null
      const row = await ordersService.createOrder(req.tenantId!, body, req.user?.userId)
      sendSuccess(res, row, 'Sales order created', 201)
    } catch (e) {
      next(e)
    }
  },
)

ordersRouter.get(
  '/:id',
  requireModuleAccess('WHOLESALE_ORDERS', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await ordersService.getOrder(req.tenantId!, req.params.id))
    } catch (e) {
      next(e)
    }
  },
)

ordersRouter.patch(
  '/:id',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  validate(updateOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await ordersService.updateOrder(req.tenantId!, req.params.id, req.body),
        'Sales order updated',
      )
    } catch (e) {
      next(e)
    }
  },
)

ordersRouter.post(
  '/:id/submit',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await ordersService.submitOrder(req.tenantId!, req.params.id), 'Order submitted')
    } catch (e) {
      next(e)
    }
  },
)

ordersRouter.post(
  '/:id/confirm',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await ordersService.confirmOrder(req.tenantId!, req.params.id),
        'Order confirmed — stock reserved',
      )
    } catch (e) {
      next(e)
    }
  },
)

ordersRouter.post(
  '/:id/hold',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  validate(holdOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await ordersService.placeHold(req.tenantId!, req.params.id, req.body.type, req.body.reason),
        'Hold placed',
      )
    } catch (e) {
      next(e)
    }
  },
)

ordersRouter.post(
  '/:id/release-hold',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  validate(releaseHoldSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await ordersService.releaseHold(
          req.tenantId!,
          req.params.id,
          req.body.holdId,
          req.user?.userId,
        ),
        'Hold released',
      )
    } catch (e) {
      next(e)
    }
  },
)

ordersRouter.post(
  '/:id/cancel',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await ordersService.cancelOrder(req.tenantId!, req.params.id),
        'Order cancelled — reservations released',
      )
    } catch (e) {
      next(e)
    }
  },
)

ordersRouter.post(
  '/:id/lines/:lineId/reserve',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const qty = req.body?.quantity != null ? Number(req.body.quantity) : undefined
      sendSuccess(
        res,
        await ordersService.reserveOrderLine(req.tenantId!, req.params.id, req.params.lineId, qty),
        'Stock reserved',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

ordersRouter.post(
  '/:id/release-reservations',
  requireModuleAccess('WHOLESALE_ORDERS', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await ordersService.releaseOrderReservations(req.tenantId!, req.params.id),
        'Reservations released',
      )
    } catch (e) {
      next(e)
    }
  },
)
