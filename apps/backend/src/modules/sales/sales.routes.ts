import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { salesService } from './sales.service'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try { const r = await salesService.list(req.tenantId!, req); sendPaginated(res, r.data, r.total, r.page, r.limit) } catch (e) { next(e) }
})
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await salesService.getById(req.tenantId!, req.params.id)) } catch (e) { next(e) }
})
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await salesService.create(req.tenantId!, req.user!.userId, req.user!.email, req.body), 'Sale created', 201) } catch (e) { next(e) }
})

export default router
