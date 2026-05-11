import { Router } from 'express'
import { productsController } from './products.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/categories', productsController.getCategories)
router.post('/categories', authorize('OWNER', 'MANAGER'), productsController.createCategory)
router.get('/brands', productsController.getBrands)
router.post('/brands', authorize('OWNER', 'MANAGER'), productsController.createBrand)

router.get('/', productsController.list)
router.post('/', authorize('OWNER', 'MANAGER'), productsController.create)
router.get('/:id', productsController.getById)
router.put('/:id', authorize('OWNER', 'MANAGER'), productsController.update)
router.delete('/:id', authorize('OWNER', 'MANAGER'), productsController.remove)

export default router
