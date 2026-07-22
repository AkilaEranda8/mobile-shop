import { Router } from 'express'
import { tenantsController } from './tenants.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { requireModuleAccess } from '../../middleware/module-access.middleware'

const router = Router()
router.use(authenticate)

// Branch list powers the switcher for all staff — do not gate GET on BRANCHES matrix.
router.get('/', tenantsController.getBranches)
router.post('/', authorize('OWNER', 'PLATFORM_ADMIN'), requireModuleAccess('BRANCHES', 'edit'), tenantsController.createBranch)
router.put('/:id', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), requireModuleAccess('BRANCHES', 'edit'), tenantsController.updateBranch)

export default router
