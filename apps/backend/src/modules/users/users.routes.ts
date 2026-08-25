import { Router } from 'express'
import { usersController } from './users.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { enforceModuleAccess, requireModuleAccess } from '../../middleware/module-access.middleware'
import { validate } from '../../middleware/validate.middleware'
import { posPinController } from '../pos-pin/pos-pin.controller'
import { adminResetPosPinSchema } from '../pos-pin/pos-pin.schema'

const router = Router()
router.use(authenticate)
router.use(enforceModuleAccess('STAFF'))

router.get('/', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'PLATFORM_ADMIN'), usersController.list)
router.post('/', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('STAFF', 'edit'), usersController.create)
router.get('/:id', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'PLATFORM_ADMIN'), usersController.getById)
router.put('/:id', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('STAFF', 'edit'), usersController.update)
router.delete('/:id', authorize('OWNER', 'PLATFORM_ADMIN'), requireModuleAccess('STAFF', 'edit'), usersController.remove)

// POS Quick PIN admin
router.get('/:id/pos-pin', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('STAFF', 'view'), posPinController.userStatus)
router.post('/:id/pos-pin/reset', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('STAFF', 'edit'), validate(adminResetPosPinSchema), posPinController.adminReset)
router.post('/:id/pos-pin/disable', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('STAFF', 'edit'), posPinController.adminDisable)

export default router
