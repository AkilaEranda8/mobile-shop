import { Router } from 'express'
import { whatsappController } from './whatsapp.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import {
  connectSchema,
  updateConfigSchema,
  sendTestMessageSchema,
  sendInvoiceSchema,
  sendMessageSchema,
} from './whatsapp.schema'

const router = Router()

// ── Public webhook routes (Meta verification) ────────────────────────────────
router.get('/webhook',  whatsappController.webhookVerify)
router.post('/webhook', whatsappController.webhookEvent)

// ── Authenticated routes ─────────────────────────────────────────────────────
router.use(authenticate)

router.get('/status',              whatsappController.getStatus)
router.get('/config',              whatsappController.getConfig)
router.get('/stats',               whatsappController.getStats)
router.get('/invoice-history',     whatsappController.getInvoiceHistory)
router.get('/messages/recent',     whatsappController.getRecentMessages)

router.get('/qr',                 authorize('OWNER', 'MANAGER'),                                   whatsappController.getQrSession)
router.post('/qr/start',          authorize('OWNER', 'MANAGER'),                                   whatsappController.startQrConnect)
router.post('/qr/refresh',        authorize('OWNER', 'MANAGER'),                                   whatsappController.refreshQrConnect)

router.post('/connect',            authorize('OWNER', 'MANAGER'), validate(connectSchema),          whatsappController.connect)
router.post('/disconnect',         authorize('OWNER', 'MANAGER'),                                   whatsappController.disconnect)
router.put('/config',              authorize('OWNER', 'MANAGER'), validate(updateConfigSchema),     whatsappController.updateConfig)
router.post('/test',               authorize('OWNER', 'MANAGER'),                                   whatsappController.testConnection)
router.post('/test-message',       authorize('OWNER', 'MANAGER'), validate(sendTestMessageSchema),  whatsappController.sendTestMessage)
router.post('/send-invoice',       validate(sendInvoiceSchema),                                     whatsappController.sendInvoice)
router.post('/send-message',       validate(sendMessageSchema),                                     whatsappController.sendMessage)

export default router
