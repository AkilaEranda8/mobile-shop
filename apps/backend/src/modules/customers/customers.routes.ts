import { Router } from 'express'
import { customersController } from './customers.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { enforceModuleAccess, requireModuleAccess } from '../../middleware/module-access.middleware'
import { validate } from '../../middleware/validate.middleware'
import {
  creditReminderSendSchema,
  updateCreditControlSchema,
} from './customer-credit-control.schema'

const router = Router()
router.use(authenticate)
router.use(enforceModuleAccess('CUSTOMERS'))

router.get('/credit-control', customersController.getCreditControl)
router.put(
  '/credit-control',
  requireModuleAccess('CUSTOMERS', 'edit'),
  validate(updateCreditControlSchema),
  customersController.updateCreditControl,
)
router.post(
  '/credit-reminders/bulk',
  requireModuleAccess('CUSTOMERS', 'edit'),
  validate(creditReminderSendSchema),
  customersController.sendCreditRemindersBulk,
)

router.get('/search', customersController.search)
router.get('/', customersController.list)
router.post('/', customersController.create)
router.get('/:id', customersController.getById)
router.get('/:id/unpaid-invoices', customersController.unpaidInvoices)
router.put('/:id', customersController.update)
router.patch('/:id/active', customersController.setActive)
router.delete('/:id', customersController.remove)
router.post('/:id/credit-payment', customersController.creditPayment)
router.post(
  '/:id/credit-reminder',
  requireModuleAccess('CUSTOMERS', 'edit'),
  validate(creditReminderSendSchema),
  customersController.sendCreditReminder,
)

export default router
