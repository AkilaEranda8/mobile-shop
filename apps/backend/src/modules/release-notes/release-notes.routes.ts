import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { createReleaseSchema, updateReleaseSchema } from './release-notes.schema'
import { releaseNotesService } from './release-notes.service'

const router = Router()
router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await releaseNotesService.tenantList(req.tenantId!, req)
    sendPaginated(res, r.data, r.total, r.page, r.limit)
  } catch (e) { next(e) }
})

router.get('/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await releaseNotesService.tenantLatest(req.tenantId!, req.user?.userId)
    sendSuccess(res, data)
  } catch (e) { next(e) }
})

router.get('/unread-popup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await releaseNotesService.tenantUnreadPopup(req.tenantId!, req.user?.userId)
    sendSuccess(res, data)
  } catch (e) { next(e) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = req.query.category as string | undefined
    const data = await releaseNotesService.tenantGetById(req.tenantId!, req.params.id, category)
    sendSuccess(res, data)
  } catch (e) { next(e) }
})

router.post('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await releaseNotesService.tenantMarkRead(req.tenantId!, req.params.id)
    sendSuccess(res, data, 'Marked as read')
  } catch (e) { next(e) }
})

export default router
