import { Router } from 'express'
import { customersController } from './customers.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/search', customersController.search)
router.get('/', customersController.list)
router.post('/', customersController.create)
router.get('/:id', customersController.getById)
router.put('/:id', customersController.update)
router.post('/:id/credit-payment', customersController.creditPayment)

export default router
