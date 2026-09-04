import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../../../middleware/validate.middleware'
import { requireModuleAccess } from '../../../middleware/module-access.middleware'
import { AppError } from '../../../middleware/error.middleware'
import { sendPaginated, sendSuccess } from '../../../utils/response'
import { getPagination } from '../../../utils/pagination'
import { effectiveBranchId } from '../../../utils/active-branch'
import { prisma } from '../../../config/database'
import { createTripSchema, addStopSchema, podSchema } from './delivery.schema'
import * as deliveryService from './delivery.service'

export const deliveryRouter = Router()

deliveryRouter.get(
  '/trips',
  requireModuleAccess('WHOLESALE_DELIVERY', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, page } = getPagination(req)
      const { data, total } = await deliveryService.listTrips(req.tenantId!, {
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

deliveryRouter.post(
  '/trips',
  requireModuleAccess('WHOLESALE_DELIVERY', 'edit'),
  validate(createTripSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = { ...req.body }
      if (!body.branchId) body.branchId = effectiveBranchId(req) || undefined
      sendSuccess(res, await deliveryService.createTrip(req.tenantId!, body), 'Trip created', 201)
    } catch (e) {
      next(e)
    }
  },
)

deliveryRouter.get(
  '/trips/:id',
  requireModuleAccess('WHOLESALE_DELIVERY', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await deliveryService.getTrip(req.tenantId!, req.params.id))
    } catch (e) {
      next(e)
    }
  },
)

deliveryRouter.post(
  '/trips/:id/stops',
  requireModuleAccess('WHOLESALE_DELIVERY', 'edit'),
  validate(addStopSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await deliveryService.addStop(req.tenantId!, req.params.id, req.body),
        'Stop added',
      )
    } catch (e) {
      next(e)
    }
  },
)

deliveryRouter.post(
  '/trips/:id/start',
  requireModuleAccess('WHOLESALE_DELIVERY', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await deliveryService.startTrip(req.tenantId!, req.params.id), 'Trip started')
    } catch (e) {
      next(e)
    }
  },
)

deliveryRouter.post(
  '/trips/:id/complete',
  requireModuleAccess('WHOLESALE_DELIVERY', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await deliveryService.completeTrip(req.tenantId!, req.params.id),
        'Trip completed',
      )
    } catch (e) {
      next(e)
    }
  },
)

deliveryRouter.post(
  '/trips/:id/stops/:stopId/arrive',
  requireModuleAccess('WHOLESALE_DELIVERY', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await deliveryService.arriveStop(req.tenantId!, req.params.id, req.params.stopId),
        'Arrived at stop',
      )
    } catch (e) {
      next(e)
    }
  },
)

deliveryRouter.post(
  '/trips/:id/stops/:stopId/pod',
  requireModuleAccess('WHOLESALE_DELIVERY', 'edit'),
  validate(podSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user
      if (!user) throw new AppError('Unauthorized', 401)
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { name: true },
      })
      const result = await deliveryService.recordPod(
        req.tenantId!,
        req.params.id,
        req.params.stopId,
        req.body,
        {
          userId: user.userId,
          email: user.email,
          performedBy: u?.name || user.email || user.userId,
        },
      )
      sendSuccess(res, result, 'POD recorded')
    } catch (e) {
      next(e)
    }
  },
)
