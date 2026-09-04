import { Router, type Request, type Response, type NextFunction } from 'express'
import type { DealerStatus } from '@prisma/client'
import { validate } from '../../../middleware/validate.middleware'
import { sendPaginated, sendSuccess } from '../../../utils/response'
import { getPagination } from '../../../utils/pagination'
import {
  createDealerSchema,
  updateDealerSchema,
  dealerStatusActionSchema,
} from './dealers.schema'
import * as dealersService from './dealers.service'

export const dealersRouter = Router()

dealersRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page, search } = getPagination(req)
    const status = req.query.status as DealerStatus | undefined
    const isActive =
      req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined
    // Dealers are tenant master data. Only filter by branch when the client
    // explicitly asks (?branchId=...). Auto-scoping to the active branch hid
    // dealers created with branchId=null (common for B2B counter flow).
    const branchId = (req.query.branchId as string | undefined)?.trim() || undefined
    const { data, total } = await dealersService.listDealers(req.tenantId!, {
      skip,
      limit,
      search,
      status,
      branchId,
      isActive,
    })
    sendPaginated(res, data, total, page, limit)
  } catch (e) {
    next(e)
  }
})

dealersRouter.post(
  '/',
  validate(createDealerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dealer = await dealersService.createDealer(req.tenantId!, req.body)
      sendSuccess(res, dealer, 'Dealer created', 201)
    } catch (e) {
      next(e)
    }
  },
)

dealersRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dealer = await dealersService.getDealer(req.tenantId!, req.params.id)
    sendSuccess(res, dealer)
  } catch (e) {
    next(e)
  }
})

dealersRouter.patch(
  '/:id',
  validate(updateDealerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dealer = await dealersService.updateDealer(req.tenantId!, req.params.id, req.body)
      sendSuccess(res, dealer, 'Dealer updated')
    } catch (e) {
      next(e)
    }
  },
)

dealersRouter.post(
  '/:id/approve',
  validate(dealerStatusActionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dealer = await dealersService.approveDealer(
        req.tenantId!,
        req.params.id,
        req.body.notes,
      )
      sendSuccess(res, dealer, 'Dealer approved')
    } catch (e) {
      next(e)
    }
  },
)

dealersRouter.post(
  '/:id/hold',
  validate(dealerStatusActionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dealer = await dealersService.holdDealer(req.tenantId!, req.params.id, req.body.notes)
      sendSuccess(res, dealer, 'Dealer put on hold')
    } catch (e) {
      next(e)
    }
  },
)

dealersRouter.post(
  '/:id/suspend',
  validate(dealerStatusActionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dealer = await dealersService.suspendDealer(
        req.tenantId!,
        req.params.id,
        req.body.notes,
      )
      sendSuccess(res, dealer, 'Dealer suspended')
    } catch (e) {
      next(e)
    }
  },
)
