import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { supportTicketsService } from './support-tickets.service'
import {
  adminPatchTicketSchema,
  createTicketSchema,
  ticketMessageSchema,
} from './support.validators'

const router = Router()
router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await supportTicketsService.listTenant(req.tenantId!, {
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 30,
    })
    sendPaginated(res, result.data, result.total, result.page, result.limit)
  } catch (e) {
    next(e)
  }
})

router.post('/', validate(createTicketSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await supportTicketsService.create(
      req.tenantId!,
      req.user!.userId,
      req.user!.email,
      req.body,
    )
    sendSuccess(res, data, 'Ticket created', 201)
  } catch (e) {
    next(e)
  }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await supportTicketsService.getTenant(req.tenantId!, req.params.id))
  } catch (e) {
    next(e)
  }
})

router.post(
  '/:id/messages',
  validate(ticketMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await supportTicketsService.addTenantMessage(
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

router.patch('/:id/close', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await supportTicketsService.closeTenant(req.tenantId!, req.user!.email, req.params.id))
  } catch (e) {
    next(e)
  }
})

export default router
