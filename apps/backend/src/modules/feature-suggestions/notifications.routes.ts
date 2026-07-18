import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { featureSuggestionsController as ctrl } from './feature-suggestions.controller'

const router = Router()
router.use(authenticate)

router.get('/', ctrl.listNotifications)
router.get('/unread', ctrl.listUnreadNotifications)
router.patch('/read-all', ctrl.markAllNotificationsRead)
router.patch('/:id/read', ctrl.markNotificationRead)

export default router
