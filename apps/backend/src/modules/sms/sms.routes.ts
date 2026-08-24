import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { requireModuleAccess } from '../../middleware/module-access.middleware'
import { validate } from '../../middleware/validate.middleware'
import { smsController } from './sms.controller'
import { sendSmsMessageSchema, sendSmsTestSchema, sendSaleSmsSchema, updateSmsSettingsSchema } from './sms-settings.schema'

const router = Router()

router.use(authenticate)

router.get('/status', authorize('OWNER', 'MANAGER', 'CASHIER'), requireModuleAccess('SETTINGS', 'view'), smsController.getStatus)
router.get('/config', authorize('OWNER', 'MANAGER', 'CASHIER'), requireModuleAccess('SETTINGS', 'view'), smsController.getConfig)
router.put('/config', authorize('OWNER', 'MANAGER'), requireModuleAccess('SETTINGS', 'edit'), validate(updateSmsSettingsSchema), smsController.updateConfig)
router.get('/stats', authorize('OWNER', 'MANAGER', 'CASHIER'), requireModuleAccess('SETTINGS', 'view'), smsController.getStats)
router.get('/history', authorize('OWNER', 'MANAGER', 'CASHIER'), requireModuleAccess('SETTINGS', 'view'), smsController.getHistory)
router.get('/messages/recent', authorize('OWNER', 'MANAGER', 'CASHIER'), requireModuleAccess('SETTINGS', 'view'), smsController.getRecentMessages)
router.post('/test-message', authorize('OWNER', 'MANAGER'), requireModuleAccess('SETTINGS', 'edit'), validate(sendSmsTestSchema), smsController.sendTestMessage)
router.post('/send-message', authorize('OWNER', 'MANAGER', 'CASHIER'), requireModuleAccess('SETTINGS', 'edit'), validate(sendSmsMessageSchema), smsController.sendMessage)
router.post('/send-sale', authorize('OWNER', 'MANAGER', 'CASHIER'), validate(sendSaleSmsSchema), smsController.sendSaleSms)

export default router
