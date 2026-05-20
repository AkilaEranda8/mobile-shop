import { Router, Request, Response, NextFunction } from 'express'
import { exchangesService } from './exchanges.service'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await exchangesService.list(req.tenantId!, req)
    sendPaginated(res, r.data, r.total, r.page, r.limit)
  } catch (e) { next(e) }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await exchangesService.create(req.tenantId!, req.body, req.user?.userId ?? 'system'), 'Exchange recorded', 201)
  } catch (e) { next(e) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await exchangesService.getById(req.tenantId!, req.params.id))
  } catch (e) { next(e) }
})

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await exchangesService.update(req.tenantId!, req.params.id, req.body))
  } catch (e) { next(e) }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await exchangesService.remove(req.tenantId!, req.params.id))
  } catch (e) { next(e) }
})

export default router
