import { Router } from 'express'
import { sendSuccess } from '../../utils/response'
import { validate } from '../../middleware/validate.middleware'
import { masterCatalogService } from './master-catalog.service'
import { seedMasterCatalog } from './master-catalog.seed'
import { seedFullMasterCatalog } from './master-catalog.full-seed'
import {
  masterCategorySchema,
  masterBrandSchema,
  masterPhoneModelSchema,
  masterPhoneVariantSchema,
  masterAccessorySchema,
} from './master-catalog.schema'

const router = Router()

router.get('/categories', async (_req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.listCategories()) } catch (e) { next(e) }
})
router.post('/categories', validate(masterCategorySchema), async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.createCategory(req.body), 'Category created', 201) } catch (e) { next(e) }
})
router.patch('/categories/:id', async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.updateCategory(req.params.id, req.body)) } catch (e) { next(e) }
})
router.delete('/categories/:id', async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.deleteCategory(req.params.id), 'Category deleted') } catch (e) { next(e) }
})

router.get('/brands', async (req, res, next) => {
  try {
    const type = req.query.type as 'PHONE' | 'ACCESSORY' | 'BOTH' | undefined
    sendSuccess(res, await masterCatalogService.listBrands({ type }))
  } catch (e) { next(e) }
})
router.post('/brands', validate(masterBrandSchema), async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.createBrand(req.body), 'Brand created', 201) } catch (e) { next(e) }
})
router.patch('/brands/:id', async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.updateBrand(req.params.id, req.body)) } catch (e) { next(e) }
})
router.delete('/brands/:id', async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.deleteBrand(req.params.id), 'Brand deleted') } catch (e) { next(e) }
})

router.get('/phone-models', async (req, res, next) => {
  try {
    sendSuccess(res, await masterCatalogService.listPhoneModels({
      brandId: req.query.brandId as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
      search: req.query.search as string | undefined,
    }))
  } catch (e) { next(e) }
})
router.get('/phone-models/:id', async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.getPhoneModel(req.params.id)) } catch (e) { next(e) }
})
router.post('/phone-models', validate(masterPhoneModelSchema), async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.createPhoneModel(req.body), 'Model created', 201) } catch (e) { next(e) }
})
router.patch('/phone-models/:id', async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.updatePhoneModel(req.params.id, req.body)) } catch (e) { next(e) }
})
router.delete('/phone-models/:id', async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.deletePhoneModel(req.params.id), 'Model deleted') } catch (e) { next(e) }
})

router.post('/phone-models/:id/variants', validate(masterPhoneVariantSchema), async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.createVariant(req.params.id, req.body), 'Variant created', 201) } catch (e) { next(e) }
})
router.patch('/variants/:id', async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.updateVariant(req.params.id, req.body)) } catch (e) { next(e) }
})
router.delete('/variants/:id', async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.deleteVariant(req.params.id), 'Variant deleted') } catch (e) { next(e) }
})

router.get('/accessories', async (req, res, next) => {
  try {
    sendSuccess(res, await masterCatalogService.listAccessories({
      categoryId: req.query.categoryId as string | undefined,
      brandId: req.query.brandId as string | undefined,
      search: req.query.search as string | undefined,
    }))
  } catch (e) { next(e) }
})
router.post('/accessories', validate(masterAccessorySchema), async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.createAccessory(req.body), 'Accessory created', 201) } catch (e) { next(e) }
})
router.patch('/accessories/:id', async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.updateAccessory(req.params.id, req.body)) } catch (e) { next(e) }
})
router.delete('/accessories/:id', async (req, res, next) => {
  try { sendSuccess(res, await masterCatalogService.deleteAccessory(req.params.id), 'Accessory deleted') } catch (e) { next(e) }
})

router.post('/seed', async (_req, res, next) => {
  try { sendSuccess(res, await seedMasterCatalog(), 'Seed complete') } catch (e) { next(e) }
})

router.post('/seed-full', async (_req, res, next) => {
  try { sendSuccess(res, await seedFullMasterCatalog(), 'Full catalog loaded') } catch (e) { next(e) }
})

export default router
