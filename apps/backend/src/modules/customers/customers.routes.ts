import { Router } from 'express'
import { customersController } from './customers.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { enforceModuleAccess, requireAnyModuleEdit, requireModuleAccess } from '../../middleware/module-access.middleware'
import { validate } from '../../middleware/validate.middleware'
import { canEditModule } from '../tenants/role-permissions.util'
import {
  creditReminderSendSchema,
  updateCreditControlSchema,
} from './customer-credit-control.schema'

const router = Router()
router.use(authenticate)
// Registering a walk-in customer is part of POS and repair intake — not only the Customers module.
router.post(
  '/',
  requireAnyModuleEdit(['CUSTOMERS', 'POS', 'REPAIRS']),
  (req, _res, next) => {
    const role = req.user?.role
    const fullAccess = role === 'OWNER' || role === 'PLATFORM_ADMIN'
      || (!!req.rolePermissionMatrix && canEditModule(req.rolePermissionMatrix, role, 'CUSTOMERS'))
    if (!fullAccess && req.body && typeof req.body === 'object') {
      delete req.body.openingDue
      delete req.body.totalDue
    }
    next()
  },
  customersController.create,
)
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
