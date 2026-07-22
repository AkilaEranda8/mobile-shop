import { Request, Response, NextFunction } from 'express'
import { deliveryService } from './delivery.service'
import { sendSuccess } from '../../utils/response'
import { effectiveBranchId } from '../../utils/active-branch'

export const deliveryController = {

  // ── Orders ─────────────────────────────────────────────────────────────────
  async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search, page, limit } = req.query as any
      const data = await deliveryService.listOrders(req.user!.tenantId, {
        status, search, page: page ? +page : 1, limit: limit ? +limit : 20,
        branchId: effectiveBranchId(req),
      })
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.getOrder(req.user!.tenantId, req.params.id, req)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.createOrder(req.user!.tenantId, req.body, req)
      sendSuccess(res, data, 'Delivery order created', 201)
    } catch (e) { next(e) }
  },

  async updateOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.updateOrder(req.user!.tenantId, req.params.id, req.body, req)
      sendSuccess(res, data, 'Order updated')
    } catch (e) { next(e) }
  },

  async assignTracking(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.assignTracking(req.user!.tenantId, req.params.id, req.body)
      sendSuccess(res, data, 'Tracking number assigned and waybill generated')
    } catch (e) { next(e) }
  },

  async generateWaybill(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.generateWaybill(req.user!.tenantId, req.params.id)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.getStats(req.user!.tenantId)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  // ── Couriers ────────────────────────────────────────────────────────────────
  async listCouriers(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.listCouriers(req.user!.tenantId)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async createCourier(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.createCourier(req.user!.tenantId, req.body)
      sendSuccess(res, data, 'Courier created', 201)
    } catch (e) { next(e) }
  },

  async updateCourier(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.updateCourier(req.user!.tenantId, req.params.id, req.body)
      sendSuccess(res, data, 'Courier updated')
    } catch (e) { next(e) }
  },

  async deleteCourier(req: Request, res: Response, next: NextFunction) {
    try {
      await deliveryService.deleteCourier(req.user!.tenantId, req.params.id)
      sendSuccess(res, null, 'Courier deleted')
    } catch (e) { next(e) }
  },

  async seedCouriers(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.seedDefaultCouriers(req.user!.tenantId)
      sendSuccess(res, data, 'Default couriers added')
    } catch (e) { next(e) }
  },

  // ── Tracking pool ────────────────────────────────────────────────────────────
  async listTracking(req: Request, res: Response, next: NextFunction) {
    try {
      const { courierId, status } = req.query as any
      const data = await deliveryService.listTrackingNumbers(req.user!.tenantId, courierId, status)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async bulkAddTracking(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.bulkAddTracking(req.user!.tenantId, req.body)
      sendSuccess(res, data, `${data.added} tracking numbers added`)
    } catch (e) { next(e) }
  },

  async deleteTracking(req: Request, res: Response, next: NextFunction) {
    try {
      await deliveryService.deleteTracking(req.user!.tenantId, req.params.id)
      sendSuccess(res, null, 'Tracking number deleted')
    } catch (e) { next(e) }
  },

  // ── Notifications ────────────────────────────────────────────────────────────
  async listNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.listNotifications(req.user!.tenantId, req.query.orderId as string)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async retryNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await deliveryService.retryNotification(req.user!.tenantId, req.params.id)
      sendSuccess(res, data, 'Notification retried')
    } catch (e) { next(e) }
  },

  async resendNotification(req: Request, res: Response, next: NextFunction) {
    try {
      await deliveryService.resendNotification(req.user!.tenantId, req.params.orderId)
      sendSuccess(res, null, 'WhatsApp notification sent')
    } catch (e) { next(e) }
  },
}
