import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateTicketNumber, generateInvoiceNumber } from '../../utils/counters'
import { Request } from 'express'

export const repairsService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const status = req.query.status as string | undefined
    const branchId = req.query.branchId as string | undefined
    const customerId = req.query.customerId as string | undefined
    const where: any = { tenantId, ...(status && { status }), ...(branchId && { branchId }), ...(customerId && { customerId }), ...(search && { OR: [{ ticketNumber: { contains: search, mode: 'insensitive' } }, { customerName: { contains: search, mode: 'insensitive' } }, { deviceBrand: { contains: search, mode: 'insensitive' } }, { deviceModel: { contains: search, mode: 'insensitive' } }] }) }
    const [data, total] = await Promise.all([
      prisma.repairTicket.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { notes: true, spareParts: true, history: true } }),
      prisma.repairTicket.count({ where }),
    ])
    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId }, include: { notes: true, spareParts: true, history: true } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    return r
  },

  async create(tenantId: string, body: any) {
    if (!body.branchId) {
      const branch = await prisma.branch.findFirst({ where: { tenantId } })
      if (!branch) throw new AppError('No branch found for tenant', 400)
      body.branchId = branch.id
    }

    if (!body.customerId && body.customerPhone) {
      let customer = await prisma.customer.findFirst({ where: { tenantId, phone: body.customerPhone } })
      if (!customer) customer = await prisma.customer.create({ data: { tenantId, name: body.customerName || 'Unknown', phone: body.customerPhone } })
      body.customerId = customer.id
    }
    if (!body.customerId) throw new AppError('Customer phone is required', 400)

    if (body.estimatedCost === undefined || body.estimatedCost === null || body.estimatedCost === '') body.estimatedCost = 0

    const { createdBy, deviceColor, ...repairData } = body
    if (!repairData.source) repairData.source = 'WALK_IN'
    const ticketNumber = await generateTicketNumber(tenantId)
    const repair = await prisma.repairTicket.create({
      data: { ...repairData, tenantId, ticketNumber, history: { create: [{ status: 'RECEIVED', changedBy: createdBy ?? 'system', note: 'Ticket created' }] } },
      include: { notes: true, spareParts: true, history: true },
    })
    await prisma.customer.update({ where: { id: body.customerId }, data: { totalRepairs: { increment: 1 } } }).catch(() => {})
    if (repairData.imei) {
      await prisma.imeiRecord.updateMany({ where: { imei: repairData.imei }, data: { status: 'IN_REPAIR' } }).catch(() => {})
    }
    return repair
  },

  async update(tenantId: string, id: string, body: any) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    const { customerName, customerPhone, deviceBrand, deviceModel, deviceColor,
            imei, reportedIssue, technicianId, technicianName, priority,
            estimatedCost, actualCost, estimatedCompletion, source } = body
    const data: any = {}
    if (customerName        !== undefined) data.customerName        = customerName
    if (customerPhone       !== undefined) data.customerPhone       = customerPhone
    if (deviceBrand         !== undefined) data.deviceBrand         = deviceBrand
    if (deviceModel         !== undefined) data.deviceModel         = deviceModel
    if (deviceColor         !== undefined) data.deviceColor         = deviceColor
    if (imei                !== undefined) {
      data.imei = imei
      if (imei && imei !== r.imei) {
        await prisma.imeiRecord.updateMany({ where: { imei }, data: { status: 'IN_REPAIR' } }).catch(() => {})
        if (r.imei) {
          await prisma.imeiRecord.updateMany({ where: { imei: r.imei }, data: { status: 'IN_STOCK' } }).catch(() => {})
        }
      }
    }
    if (reportedIssue       !== undefined) data.reportedIssue       = reportedIssue
    if (technicianId        !== undefined) data.technicianId        = technicianId
    if (technicianName      !== undefined) data.technicianName      = technicianName
    if (priority            !== undefined) data.priority            = priority
    if (estimatedCost       !== undefined) data.estimatedCost       = Number(estimatedCost)
    if (actualCost          !== undefined) data.actualCost          = Number(actualCost)
    if (estimatedCompletion !== undefined) data.estimatedCompletion = estimatedCompletion ? new Date(estimatedCompletion) : null
    if (source              !== undefined) data.source              = source
    return prisma.repairTicket.update({ where: { id }, data, include: { notes: true, spareParts: true, history: true } })
  },

  async updateStatus(tenantId: string, id: string, status: string, changedBy: string, note?: string) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    const completedAt = status === 'DELIVERED' ? new Date() : undefined
    await prisma.$transaction([
      prisma.repairTicket.update({ where: { id }, data: { status: status as any, ...(completedAt && { completedAt }) } }),
      prisma.repairStatusHistory.create({ data: { repairId: id, status: status as any, changedBy, note } }),
    ])
    if ((status === 'DELIVERED' || status === 'CANCELLED') && r.imei) {
      await prisma.imeiRecord.updateMany({ where: { imei: r.imei }, data: { status: 'IN_STOCK' } }).catch(() => {})
    }
    return prisma.repairTicket.findUnique({ where: { id }, include: { notes: true, spareParts: true, history: true } })
  },

  async addNote(tenantId: string, id: string, text: string, authorName: string, isPublic: boolean) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    return prisma.repairNote.create({ data: { repairId: id, text, authorName, isPublic } })
  },

  async addSparePart(tenantId: string, repairId: string, body: any) {
    const r = await prisma.repairTicket.findFirst({ where: { id: repairId, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId } })
    if (!product) throw new AppError('Product not found', 404)
    const qty      = Number(body.quantity) || 1
    const unitCost = Number(body.unitCost) || Number(product.buyingPrice) || 0
    const part = await prisma.repairSparePart.create({
      data: { repairId, productId: body.productId, productName: product.name, quantity: qty, unitCost, total: qty * unitCost },
    })
    return prisma.repairTicket.findUnique({ where: { id: repairId }, include: { notes: true, spareParts: true, history: true } })
  },

  async removeSparePart(tenantId: string, repairId: string, partId: string) {
    const r = await prisma.repairTicket.findFirst({ where: { id: repairId, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    await prisma.repairSparePart.deleteMany({ where: { id: partId, repairId } })
    return prisma.repairTicket.findUnique({ where: { id: repairId }, include: { notes: true, spareParts: true, history: true } })
  },

  async collectPayment(tenantId: string, id: string, body: { discount?: number; paymentMethod: string; cashierName?: string }) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId }, include: { spareParts: true } })
    if (!r) throw new AppError('Repair ticket not found', 404)

    const partsTotal  = r.spareParts.reduce((s: number, p: any) => s + p.total, 0)
    const subtotal    = (r.estimatedCost || 0) + partsTotal
    const discount    = Number(body.discount)    || 0
    const finalAmount = Math.max(0, subtotal - discount)
    const cashierName = body.cashierName || 'System'
    const invoiceNumber = await generateInvoiceNumber(tenantId)

    await prisma.$transaction(async (tx: any) => {
      await tx.repairTicket.update({
        where: { id },
        data: { actualCost: finalAmount, status: 'DELIVERED', completedAt: new Date() },
      })
      await tx.repairStatusHistory.create({
        data: { repairId: id, status: 'DELIVERED', changedBy: cashierName, note: 'Payment collected' },
      })
      const saleItems: any[] = []
      if (r.estimatedCost > 0) {
        saleItems.push({ productName: `Repair Service – ${r.deviceBrand} ${r.deviceModel}`, sku: r.ticketNumber, quantity: 1, unitPrice: r.estimatedCost, discount: 0, total: r.estimatedCost })
      }
      for (const p of r.spareParts) {
        saleItems.push({ productId: p.productId, productName: p.productName, sku: '', quantity: p.quantity, unitPrice: p.unitCost, discount: 0, total: p.total })
      }
      await tx.sale.create({
        data: {
          tenantId, branchId: r.branchId, invoiceNumber,
          customerId: r.customerId, customerName: r.customerName, customerPhone: r.customerPhone,
          subtotal, discount, tax: 0, total: finalAmount,
          paidAmount: finalAmount, dueAmount: 0,
          status: 'PAID', cashierName, source: 'REPAIR',
          notes: `Repair ticket: ${r.ticketNumber}`,
          items:    { create: saleItems },
          payments: { create: [{ method: body.paymentMethod as any, amount: finalAmount }] },
        },
      })
      for (const p of r.spareParts) {
        if (p.productId) {
          const prod = await tx.product.findUnique({ where: { id: p.productId }, select: { stock: true, name: true } })
          if (prod && prod.stock < p.quantity) {
            throw new AppError(`Insufficient stock for "${prod.name}". Available: ${prod.stock}, Required: ${p.quantity}`, 400)
          }
          await tx.product.update({ where: { id: p.productId }, data: { stock: { decrement: p.quantity } } })
          await tx.stockMovement.create({
            data: {
              productId:   p.productId,
              branchId:    r.branchId,
              type:        'REPAIR_USE',
              quantity:    -p.quantity,
              reference:   r.ticketNumber,
              note:        `Spare part used in repair ${r.ticketNumber}`,
              performedBy: cashierName,
            },
          })
        }
      }
    })
    // ── Auto-create Finance INCOME transaction for repair payment ──
    try {
      await prisma.transaction.create({
        data: {
          tenantId,
          branchId:    r.branchId,
          type:        'INCOME',
          category:    'Repairs',
          amount:      finalAmount,
          description: `Repair - ${r.ticketNumber} (${r.deviceBrand} ${r.deviceModel})${r.customerName ? ' — ' + r.customerName : ''}`,
          paymentMethod: body.paymentMethod as any,
          reference:   r.ticketNumber,
          performedBy: cashierName,
        },
      })
    } catch (e) { console.error('Finance repair transaction error:', e) }
    return prisma.repairTicket.findUnique({ where: { id }, include: { notes: true, spareParts: true, history: true } })
  },
}
