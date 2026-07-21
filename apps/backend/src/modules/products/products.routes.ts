import { Router } from 'express'
import { productsController } from './products.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { importFromMasterSchema } from '../master-catalog/master-catalog.schema'

const router = Router()
router.use(authenticate)

router.get('/categories', productsController.getCategories)
router.post('/categories', authorize('OWNER', 'MANAGER'), productsController.createCategory)
router.delete('/categories/:id', authorize('OWNER', 'MANAGER'), productsController.deleteCategory)
router.get('/brands', productsController.getBrands)
router.post('/brands', authorize('OWNER', 'MANAGER'), productsController.createBrand)
router.delete('/brands/:id', authorize('OWNER', 'MANAGER'), productsController.deleteBrand)
router.get('/imei-health', productsController.getImeiHealth)
router.post('/bulk-infer-track-imei', authorize('OWNER', 'MANAGER'), productsController.bulkInferTrackImei)
router.get('/next-codes', productsController.nextCodes)
router.get('/lookup', productsController.lookupByCode)

router.get('/', productsController.list)
router.post('/import-from-master', authorize('OWNER', 'MANAGER'), validate(importFromMasterSchema), productsController.importFromMaster)
router.post('/', authorize('OWNER', 'MANAGER'), productsController.create)
router.get('/:id', productsController.getById)
router.put('/:id', authorize('OWNER', 'MANAGER'), productsController.update)
router.delete('/:id', authorize('OWNER', 'MANAGER'), productsController.remove)

export default router
