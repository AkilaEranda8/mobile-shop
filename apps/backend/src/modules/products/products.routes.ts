import { Router } from 'express'
import { productsController } from './products.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { enforceModuleAccessReadAny } from '../../middleware/module-access.middleware'
import { validate } from '../../middleware/validate.middleware'
import { importFromMasterSchema } from '../master-catalog/master-catalog.schema'

const router = Router()
router.use(authenticate)
router.use(enforceModuleAccessReadAny(['INVENTORY', 'POS', 'REPAIRS', 'IMEI'], 'INVENTORY'))

router.get('/categories', productsController.getCategories)
router.post('/categories', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'), productsController.createCategory)
router.delete('/categories/:id', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'), productsController.deleteCategory)
router.get('/brands', productsController.getBrands)
router.post('/brands', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'), productsController.createBrand)
router.delete('/brands/:id', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'), productsController.deleteBrand)
router.get('/imei-health', productsController.getImeiHealth)
router.post('/bulk-infer-track-imei', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'), productsController.bulkInferTrackImei)
router.get('/next-codes', productsController.nextCodes)
router.get('/lookup', productsController.lookupByCode)

router.get('/', productsController.list)
router.post('/import-from-master', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'), validate(importFromMasterSchema), productsController.importFromMaster)
router.post('/', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'), productsController.create)
router.get('/:id', productsController.getById)
router.put('/:id', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'), productsController.update)
router.delete('/:id', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'), productsController.remove)

export default router
