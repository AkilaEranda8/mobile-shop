import { Router } from 'express'
import { tenantsController } from './tenants.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/', tenantsController.getBranches)
router.post('/', authorize('OWNER', 'PLATFORM_ADMIN'), tenantsController.createBranch)
router.put('/:id', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), tenantsController.updateBranch)

export default router
