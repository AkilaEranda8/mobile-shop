import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { customerServiceTicketsService } from './customer-service-tickets.service'
import {
  createCustomerSrSchema,
  customerSrMessageSchema,
  customerSrPatchSchema,
} from './support.validators'

const router = Router()
router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await customerServiceTicketsService.list(req.tenantId!, {
      status: req.query.status as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 30,
    })
    sendPaginated(res, result.data, result.total, result.page, result.limit)
  } catch (e) {
    next(e)
  }
})

router.post('/', validate(createCustomerSrSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(
      res,
      await customerServiceTicketsService.create(
        req.tenantId!,
        req.user!.userId,
        req.user!.email,
        req.body,
      ),
      'Created',
      201,
    )
  } catch (e) {
    next(e)
  }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await customerServiceTicketsService.get(req.tenantId!, req.params.id))
  } catch (e) {
    next(e)
  }
})

router.post(
  '/:id/messages',
  validate(customerSrMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await customerServiceTicketsService.addMessage(
          req.tenantId!,
          req.user!.userId,
          req.user!.email,
          req.params.id,
          req.body.body,
        ),
      )
    } catch (e) {
      next(e)
    }
  },
)

router.patch(
  '/:id',
  validate(customerSrPatchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await customerServiceTicketsService.patch(
          req.tenantId!,
          req.user!.userId,
          req.params.id,
          req.body,
        ),
      )
    } catch (e) {
      next(e)
    }
  },
)

export default router
