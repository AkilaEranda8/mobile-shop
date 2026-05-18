import { Router, Request, Response, NextFunction } from 'express'
import { deviceCatalogService } from './device-catalog.service'
import { sendSuccess } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/brands',              async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await deviceCatalogService.listBrands(req.tenantId!)) } catch (e) { next(e) }
})
router.post('/brands',             async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await deviceCatalogService.createBrand(req.tenantId!, req.body.name), 'Brand created', 201) } catch (e) { next(e) }
})
router.delete('/brands/:id',       async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await deviceCatalogService.deleteBrand(req.tenantId!, req.params.id), 'Brand deleted') } catch (e) { next(e) }
})

router.get('/models',              async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await deviceCatalogService.listModels(req.tenantId!, req.query.brandId as string | undefined)) } catch (e) { next(e) }
})
router.post('/models',             async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await deviceCatalogService.createModel(req.tenantId!, req.body.brandId, req.body.name), 'Model created', 201) } catch (e) { next(e) }
})
router.delete('/models/:id',       async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await deviceCatalogService.deleteModel(req.tenantId!, req.params.id), 'Model deleted') } catch (e) { next(e) }
})

export default router
