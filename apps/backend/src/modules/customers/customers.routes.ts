import { Router } from 'express'
import { customersController } from './customers.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { enforceModuleAccess } from '../../middleware/module-access.middleware'

const router = Router()
router.use(authenticate)
router.use(enforceModuleAccess('CUSTOMERS'))

router.get('/search', customersController.search)
router.get('/', customersController.list)
router.post('/', customersController.create)
router.get('/:id', customersController.getById)
router.put('/:id', customersController.update)
router.patch('/:id/active', customersController.setActive)
router.delete('/:id', customersController.remove)
router.post('/:id/credit-payment', customersController.creditPayment)

export default router
