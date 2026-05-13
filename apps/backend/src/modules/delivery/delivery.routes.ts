import { Router } from 'express'
import { deliveryController } from './delivery.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import {
  createDeliveryOrderSchema,
  updateDeliveryOrderSchema,
  assignTrackingSchema,
  createCourierSchema,
  bulkAddTrackingSchema,
} from './delivery.schema'

const router = Router()

router.use(authenticate)

// ── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats', deliveryController.getStats)

// ── Orders ───────────────────────────────────────────────────────────────────
router.get('/',                                          deliveryController.listOrders)
router.get('/:id',                                       deliveryController.getOrder)
router.post('/',        validate(createDeliveryOrderSchema), deliveryController.createOrder)
router.put('/:id',      validate(updateDeliveryOrderSchema), deliveryController.updateOrder)
router.post('/:id/assign-tracking', authorize('OWNER','MANAGER'), validate(assignTrackingSchema), deliveryController.assignTracking)
router.post('/:id/waybill',         deliveryController.generateWaybill)
router.post('/:id/resend-whatsapp', deliveryController.resendNotification)

// ── Couriers ─────────────────────────────────────────────────────────────────
router.get('/couriers/list',                             deliveryController.listCouriers)
router.post('/couriers/seed',  authorize('OWNER','MANAGER'),                                    deliveryController.seedCouriers)
router.post('/couriers',       authorize('OWNER','MANAGER'), validate(createCourierSchema),     deliveryController.createCourier)
router.put('/couriers/:id',    authorize('OWNER','MANAGER'),                                    deliveryController.updateCourier)
router.delete('/couriers/:id', authorize('OWNER','MANAGER'),                                    deliveryController.deleteCourier)

// ── Tracking pool ─────────────────────────────────────────────────────────────
router.get('/tracking/pool',                             deliveryController.listTracking)
router.post('/tracking/bulk',  authorize('OWNER','MANAGER'), validate(bulkAddTrackingSchema),   deliveryController.bulkAddTracking)
router.delete('/tracking/:id', authorize('OWNER','MANAGER'),                                    deliveryController.deleteTracking)

// ── Notifications ─────────────────────────────────────────────────────────────
router.get('/notifications/list',                        deliveryController.listNotifications)
router.post('/notifications/:id/retry',                  deliveryController.retryNotification)

export default router
