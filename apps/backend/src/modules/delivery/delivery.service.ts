import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import type {
  CreateDeliveryOrderInput,
  UpdateDeliveryOrderInput,
  AssignTrackingInput,
  CreateCourierInput,
  BulkAddTrackingInput,
} from './delivery.schema'

// ── Sequence helper ───────────────────────────────────────────────────────────

async function nextOrderNumber(tenantId: string): Promise<string> {
  const count = await prisma.deliveryOrder.count({ where: { tenantId } })
  const year  = new Date().getFullYear()
  return `DO-${year}-${String(count + 1).padStart(4, '0')}`
}

async function nextWaybillNumber(tenantId: string): Promise<string> {
  const count = await prisma.waybill.count({ where: { tenantId } })
  const year  = new Date().getFullYear()
  return `WB-${year}-${String(count + 1).padStart(4, '0')}`
}

// ── WhatsApp notification helper ──────────────────────────────────────────────

async function sendTrackingNotification(tenantId: string, orderId: string) {
  const order = await prisma.deliveryOrder.findUnique({
    where:   { id: orderId },
    include: { courier: true },
  })
  if (!order) return

  const cfg = await prisma.whatsAppConfig.findUnique({ where: { tenantId } })
  if (!cfg || cfg.status !== 'connected' || !cfg.enabled) return

  const message = `Hello ${order.customerName}! 👋\n\nYour order *${order.orderNumber}* has been dispatched.\n\n📦 Courier: ${order.courier?.name ?? 'N/A'}\n🔍 Tracking: *${order.trackingNumber ?? 'N/A'}*\n\nThank you for shopping with us! 🙏`

  const notif = await prisma.deliveryNotification.create({
    data: {
      tenantId,
      deliveryOrderId: orderId,
      channel:  'whatsapp',
      phone:    order.customerPhone,
      message,
      status:   'PENDING',
    },
  })

  try {
    const normalizedPhone = order.customerPhone.startsWith('+')
      ? order.customerPhone.slice(1)
      : order.customerPhone

    const res = await fetch(`https://graph.facebook.com/v19.0/${cfg.phoneNumberId}/messages`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${cfg.accessToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        messaging_product: 'whatsapp',
        to:   normalizedPhone,
        type: 'text',
        text: { body: message },
      }),
    })
    const json = await res.json() as any
    if (!res.ok) throw new Error(json?.error?.message ?? 'Meta API error')

    await prisma.deliveryNotification.update({
      where: { id: notif.id },
      data:  { status: 'SENT', sentAt: new Date() },
    })
  } catch (err: any) {
    await prisma.deliveryNotification.update({
      where: { id: notif.id },
      data:  { status: 'FAILED', errorMessage: err?.message },
    })
  }
}

// ── Delivery orders ───────────────────────────────────────────────────────────

export const deliveryService = {

  async listOrders(tenantId: string, filters: {
    status?: string; search?: string; page?: number; limit?: number
  }) {
    const { status, search, page = 1, limit = 20 } = filters
    const skip = (page - 1) * limit

    const where: any = { tenantId }
    if (status && status !== 'ALL') where.status = status
    if (search) {
      where.OR = [
        { orderNumber:   { contains: search, mode: 'insensitive' } },
        { customerName:  { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { trackingNumber:{ contains: search, mode: 'insensitive' } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.deliveryOrder.findMany({
        where,
        include: { courier: { select: { id: true, name: true, code: true } }, items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.deliveryOrder.count({ where }),
    ])

    return { orders, total, page, limit, pages: Math.ceil(total / limit) }
  },

  async getOrder(tenantId: string, id: string) {
    const order = await prisma.deliveryOrder.findFirst({
      where:   { id, tenantId },
      include: {
        courier:       true,
        items:         true,
        waybills:      { orderBy: { createdAt: 'desc' } },
        notifications: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!order) throw new AppError('Delivery order not found', 404)
    return order
  },

  async createOrder(tenantId: string, input: CreateDeliveryOrderInput) {
    const orderNumber = await nextOrderNumber(tenantId)
    const total = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

    const order = await prisma.deliveryOrder.create({
      data: {
        tenantId,
        orderNumber,
        customerName:   input.customerName,
        customerPhone:  input.customerPhone,
        customerEmail:  input.customerEmail || undefined,
        addressLine1:   input.addressLine1,
        addressLine2:   input.addressLine2,
        city:           input.city,
        district:       input.district,
        postalCode:     input.postalCode,
        subtotal:       input.subtotal || total,
        deliveryCharge: input.deliveryCharge,
        totalAmount:    (input.subtotal || total) + input.deliveryCharge,
        isCOD:          input.isCOD,
        codAmount:      input.codAmount,
        notes:          input.notes,
        branchId:       input.branchId,
        status:         'PENDING',
        items: {
          create: input.items.map(i => ({
            description: i.description,
            quantity:    i.quantity,
            unitPrice:   i.unitPrice,
            total:       i.quantity * i.unitPrice,
          })),
        },
      },
      include: { items: true },
    })
    return order
  },

  async updateOrder(tenantId: string, id: string, input: UpdateDeliveryOrderInput) {
    const existing = await prisma.deliveryOrder.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Delivery order not found', 404)

    const data: any = { ...input }
    if (input.status === 'DISPATCHED' && !existing.dispatchedAt) data.dispatchedAt = new Date()
    if (input.status === 'DELIVERED'  && !existing.deliveredAt)  data.deliveredAt  = new Date()

    return prisma.deliveryOrder.update({ where: { id }, data, include: { items: true, courier: true } })
  },

  async assignTracking(tenantId: string, id: string, input: AssignTrackingInput) {
    const order = await prisma.deliveryOrder.findFirst({ where: { id, tenantId } })
    if (!order) throw new AppError('Delivery order not found', 404)

    const courier = await prisma.courier.findFirst({ where: { id: input.courierId, tenantId } })
    if (!courier) throw new AppError('Courier not found', 404)

    // Check duplicate tracking
    const exists = await prisma.deliveryOrder.findFirst({
      where: { tenantId, trackingNumber: input.trackingNumber, id: { not: id } },
    })
    if (exists) throw new AppError(`Tracking number ${input.trackingNumber} is already used`, 409)

    // Mark tracking pool entry as ASSIGNED if exists
    await prisma.trackingNumber.updateMany({
      where: { tenantId, number: input.trackingNumber, courierId: input.courierId },
      data:  { status: 'ASSIGNED', assignedAt: new Date(), deliveryOrderId: id },
    })

    const updated = await prisma.deliveryOrder.update({
      where: { id },
      data:  {
        courierId:     input.courierId,
        trackingNumber: input.trackingNumber,
        status:        'DISPATCHED',
        dispatchedAt:  order.dispatchedAt ?? new Date(),
      },
      include: { courier: true, items: true },
    })

    // Generate waybill
    const waybillNumber = await nextWaybillNumber(tenantId)
    await prisma.waybill.create({
      data: { tenantId, deliveryOrderId: id, waybillNumber },
    })

    // WhatsApp notification
    if (input.sendWhatsApp) {
      sendTrackingNotification(tenantId, id).catch(() => {})
    }

    return updated
  },

  async generateWaybill(tenantId: string, id: string) {
    const order = await prisma.deliveryOrder.findFirst({
      where:   { id, tenantId },
      include: { courier: true, items: true },
    })
    if (!order) throw new AppError('Delivery order not found', 404)

    const existing = await prisma.waybill.findFirst({
      where:   { deliveryOrderId: id },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      await prisma.waybill.update({
        where: { id: existing.id },
        data:  { reprintCount: { increment: 1 }, printedAt: new Date() },
      })
      return { ...order, waybillNumber: existing.waybillNumber }
    }

    const waybillNumber = await nextWaybillNumber(tenantId)
    await prisma.waybill.create({
      data: { tenantId, deliveryOrderId: id, waybillNumber, printedAt: new Date() },
    })
    return { ...order, waybillNumber }
  },

  async getStats(tenantId: string) {
    const [total, pending, dispatched, delivered, awaiting] = await Promise.all([
      prisma.deliveryOrder.count({ where: { tenantId } }),
      prisma.deliveryOrder.count({ where: { tenantId, status: 'PENDING' } }),
      prisma.deliveryOrder.count({ where: { tenantId, status: 'DISPATCHED' } }),
      prisma.deliveryOrder.count({ where: { tenantId, status: 'DELIVERED' } }),
      prisma.deliveryOrder.count({ where: { tenantId, status: 'AWAITING_TRACKING' } }),
    ])
    return { total, pending, dispatched, delivered, awaitingTracking: awaiting }
  },

  // ── Couriers ────────────────────────────────────────────────────────────────

  async listCouriers(tenantId: string) {
    return prisma.courier.findMany({
      where:   { tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { trackingPool: true, deliveryOrders: true } } },
    })
  },

  async createCourier(tenantId: string, input: CreateCourierInput) {
    const exists = await prisma.courier.findFirst({ where: { tenantId, code: input.code } })
    if (exists) throw new AppError(`Courier with code ${input.code} already exists`, 409)

    if (input.isDefault) {
      await prisma.courier.updateMany({ where: { tenantId }, data: { isDefault: false } })
    }

    return prisma.courier.create({
      data: { tenantId, ...input, code: input.code.toUpperCase() },
    })
  },

  async updateCourier(tenantId: string, id: string, input: Partial<CreateCourierInput>) {
    const existing = await prisma.courier.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Courier not found', 404)

    if (input.isDefault) {
      await prisma.courier.updateMany({ where: { tenantId }, data: { isDefault: false } })
    }

    return prisma.courier.update({ where: { id }, data: input })
  },

  async deleteCourier(tenantId: string, id: string) {
    const existing = await prisma.courier.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Courier not found', 404)
    const inUse = await prisma.deliveryOrder.count({ where: { tenantId, courierId: id } })
    if (inUse > 0) throw new AppError('Cannot delete courier with assigned orders', 400)
    return prisma.courier.delete({ where: { id } })
  },

  async seedDefaultCouriers(tenantId: string) {
    const defaults = [
      { name: 'Koombiyo', code: 'KOOMB', website: 'https://koombiyo.lk' },
      { name: 'Domex',    code: 'DOMEX', website: 'https://domex.lk'    },
      { name: 'Pronto',   code: 'PRNTO', website: 'https://pronto.lk'   },
      { name: 'CityPak',  code: 'CITPK', website: 'https://citypak.lk'  },
    ]
    const existing = await prisma.courier.findMany({ where: { tenantId }, select: { code: true } })
    const existingCodes = new Set(existing.map(c => c.code))
    const toCreate = defaults.filter(d => !existingCodes.has(d.code))
    if (toCreate.length > 0) {
      await prisma.courier.createMany({ data: toCreate.map(d => ({ tenantId, ...d, isActive: true })) })
    }
    return prisma.courier.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  },

  // ── Tracking pool ───────────────────────────────────────────────────────────

  async listTrackingNumbers(tenantId: string, courierId?: string, status?: string) {
    const where: any = { tenantId }
    if (courierId) where.courierId = courierId
    if (status)    where.status    = status
    return prisma.trackingNumber.findMany({
      where,
      include: { courier: { select: { name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
  },

  async bulkAddTracking(tenantId: string, input: BulkAddTrackingInput) {
    const courier = await prisma.courier.findFirst({ where: { id: input.courierId, tenantId } })
    if (!courier) throw new AppError('Courier not found', 404)

    const existing = await prisma.trackingNumber.findMany({
      where: { tenantId, number: { in: input.numbers } },
      select: { number: true },
    })
    const existingSet = new Set(existing.map(e => e.number))
    const newNumbers = input.numbers.filter(n => !existingSet.has(n))
    const duplicates = input.numbers.filter(n =>  existingSet.has(n))

    if (newNumbers.length > 0) {
      await prisma.trackingNumber.createMany({
        data: newNumbers.map(number => ({ tenantId, courierId: input.courierId, number, status: 'AVAILABLE' })),
      })
    }

    return { added: newNumbers.length, duplicates: duplicates.length, duplicateNumbers: duplicates }
  },

  async deleteTracking(tenantId: string, id: string) {
    const existing = await prisma.trackingNumber.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Tracking number not found', 404)
    if (existing.status === 'ASSIGNED') throw new AppError('Cannot delete an assigned tracking number', 400)
    return prisma.trackingNumber.delete({ where: { id } })
  },

  // ── Notifications ────────────────────────────────────────────────────────────

  async listNotifications(tenantId: string, orderId?: string) {
    const where: any = { tenantId }
    if (orderId) where.deliveryOrderId = orderId
    return prisma.deliveryNotification.findMany({
      where,
      include: { deliveryOrder: { select: { orderNumber: true, customerName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  },

  async retryNotification(tenantId: string, notifId: string) {
    const notif = await prisma.deliveryNotification.findFirst({ where: { id: notifId, tenantId } })
    if (!notif) throw new AppError('Notification not found', 404)
    if (notif.status === 'SENT') throw new AppError('Already sent', 400)

    await prisma.deliveryNotification.update({
      where: { id: notifId },
      data:  { status: 'RETRYING', retryCount: { increment: 1 } },
    })

    await sendTrackingNotification(tenantId, notif.deliveryOrderId)
    return prisma.deliveryNotification.findUnique({ where: { id: notifId } })
  },

  async resendNotification(tenantId: string, orderId: string) {
    return sendTrackingNotification(tenantId, orderId)
  },
}
