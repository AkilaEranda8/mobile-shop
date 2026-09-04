import { Router, Request, Response, NextFunction } from 'express'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { supportTicketsService } from './support-tickets.service'
import { adminPatchTicketSchema, ticketMessageSchema } from './support.validators'

const router = Router()

router.get('/reports/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await supportTicketsService.reportsSummary())
  } catch (e) {
    next(e)
  }
})

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await supportTicketsService.adminList({
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      assignee: req.query.assignee as string | undefined,
      breached: req.query.breached === '1' || req.query.breached === 'true',
      q: req.query.q as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 40,
    })
    sendPaginated(res, result.data, result.total, result.page, result.limit)
  } catch (e) {
    next(e)
  }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await supportTicketsService.adminGet(req.params.id))
  } catch (e) {
    next(e)
  }
})

router.patch(
  '/:id',
  validate(adminPatchTicketSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await supportTicketsService.adminPatch(req.params.id, req.user!.email, req.body),
      )
    } catch (e) {
      next(e)
    }
  },
)

router.post(
  '/:id/messages',
  validate(ticketMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await supportTicketsService.adminMessage(
          req.params.id,
          req.user!.email,
          req.body.body,
          Boolean(req.body.isInternal),
        ),
      )
    } catch (e) {
      next(e)
    }
  },
)

export default router
