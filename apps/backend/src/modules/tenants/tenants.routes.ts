import { Router } from 'express'
import { tenantsController } from './tenants.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/', authorize('PLATFORM_ADMIN'), tenantsController.list)
router.get('/:id', authorize('PLATFORM_ADMIN', 'OWNER'), tenantsController.getById)
router.put('/:id', authorize('PLATFORM_ADMIN', 'OWNER'), tenantsController.update)
router.get('/:id/invoice-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'), tenantsController.getInvoiceSettings)
router.patch('/:id/invoice-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER'), tenantsController.updateInvoiceSettings)

export default router
