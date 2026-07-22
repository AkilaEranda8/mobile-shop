import { Router } from 'express'
import { usersController } from './users.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { enforceModuleAccess, requireModuleAccess } from '../../middleware/module-access.middleware'

const router = Router()
router.use(authenticate)
router.use(enforceModuleAccess('STAFF'))

router.get('/', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'PLATFORM_ADMIN'), usersController.list)
router.post('/', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('STAFF', 'edit'), usersController.create)
router.get('/:id', authorize('OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'PLATFORM_ADMIN'), usersController.getById)
router.put('/:id', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('STAFF', 'edit'), usersController.update)
router.delete('/:id', authorize('OWNER', 'PLATFORM_ADMIN'), requireModuleAccess('STAFF', 'edit'), usersController.remove)

export default router
