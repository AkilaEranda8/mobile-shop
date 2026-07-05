import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { sendSuccess } from '../../utils/response'
import { masterCatalogService } from './master-catalog.service'

const router = Router()
router.use(authenticate)

router.get('/categories', async (_req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.listCategories(true)) } catch (e) { next(e) }
})

router.get('/brands', async (req, res, next) => {
  try {
    const type = req.query.type as 'PHONE' | 'ACCESSORY' | 'BOTH' | undefined
    sendSuccess(res, await masterCatalogService.listBrands({ activeOnly: true, type }))
  } catch (e) { next(e) }
})

router.get('/phone-models', async (req, res, next) => {
  try {
    sendSuccess(res, await masterCatalogService.listPhoneModels({
      activeOnly: true,
      brandId: req.query.brandId as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
      search: req.query.search as string | undefined,
    }))
  } catch (e) { next(e) }
})

router.get('/phone-models/:id', async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.getPhoneModel(req.params.id, true)) } catch (e) { next(e) }
})

router.get('/accessories', async (req, res, next) => {
  try {
    sendSuccess(res, await masterCatalogService.listAccessories({
      activeOnly: true,
      categoryId: req.query.categoryId as string | undefined,
      brandId: req.query.brandId as string | undefined,
      search: req.query.search as string | undefined,
    }))
  } catch (e) { next(e) }
})

export default router
