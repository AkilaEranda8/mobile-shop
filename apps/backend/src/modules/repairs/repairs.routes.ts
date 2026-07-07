import { Router, Request, Response, NextFunction } from 'express'
import { repairsService } from './repairs.service'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try { const r = await repairsService.list(req.tenantId!, req); sendPaginated(res, r.data, r.total, r.page, r.limit) } catch (e) { next(e) }
})
router.get('/fault-options', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await repairsService.listFaultOptions(req.tenantId!), 'Fault options') } catch (e) { next(e) }
})
router.post('/fault-options', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await repairsService.createFaultOption(req.tenantId!, req.body), 'Fault option created', 201) } catch (e) { next(e) }
})
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await repairsService.create(req.tenantId!, req.body), 'Repair ticket created', 201) } catch (e) { next(e) }
})
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await repairsService.getById(req.tenantId!, req.params.id, req)) } catch (e) { next(e) }
})
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await repairsService.update(req.tenantId!, req.params.id, req.body)) } catch (e) { next(e) }
})
router.post('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await repairsService.updateStatus(req.tenantId!, req.params.id, req.body.status, req.user!.email, req.body.note)) } catch (e) { next(e) }
})
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await repairsService.updateStatus(req.tenantId!, req.params.id, req.body.status, req.user!.email, req.body.note)) } catch (e) { next(e) }
})
router.post('/:id/notes', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await repairsService.addNote(req.tenantId!, req.params.id, req.body.text, req.user!.email, req.body.isPublic ?? false), 'Note added', 201) } catch (e) { next(e) }
})
router.post('/:id/parts', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await repairsService.addSparePart(req.tenantId!, req.params.id, req.body), 'Part added', 201) } catch (e) { next(e) }
})
router.delete('/:id/parts/:partId', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await repairsService.removeSparePart(req.tenantId!, req.params.id, req.params.partId), 'Part removed') } catch (e) { next(e) }
})
router.put('/:id/photos', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await repairsService.updatePhotos(req.tenantId!, req.params.id, req.body.photos ?? [])) } catch (e) { next(e) }
})
router.post('/:id/collect-payment', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await repairsService.collectPayment(req.tenantId!, req.params.id, { ...req.body, cashierName: req.user?.email ?? 'System' }), 'Payment collected') } catch (e) { next(e) }
})

export default router
