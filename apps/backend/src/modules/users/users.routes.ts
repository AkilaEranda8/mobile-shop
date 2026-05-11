import { Router } from 'express'
import { usersController } from './users.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), usersController.list)
router.post('/', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), usersController.create)
router.get('/:id', usersController.getById)
router.put('/:id', authorize('OWNER', 'MANAGER', 'PLATFORM_ADMIN'), usersController.update)
router.delete('/:id', authorize('OWNER', 'PLATFORM_ADMIN'), usersController.remove)

export default router
