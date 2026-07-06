import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateTicketNumber, generateInvoiceNumber } from '../../utils/counters'
import { linkRepairToClaim } from '../warranty/warranty.service'
import { Request } from 'express'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import { effectiveBranchId, assertBranchRecordAccess } from '../../utils/active-branch'

export const repairsService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const status = req.query.status as string | undefined
    const branchId = effectiveBranchId(req)
    const customerId = req.query.customerId as string | undefined
    const where: any = { tenantId, ...(status && { status }), ...(branchId && { branchId }), ...(customerId && { customerId }), ...(search && { OR: [{ ticketNumber: { contains: search, mode: 'insensitive' } }, { customerName: { contains: search, mode: 'insensitive' } }, { deviceBrand: { contains: search, mode: 'insensitive' } }, { deviceModel: { contains: search, mode: 'insensitive' } }] }) }
    const [data, total] = await Promise.all([
      prisma.repairTicket.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { notes: true, spareParts: true, history: true } }),
      prisma.repairTicket.count({ where }),
    ])
    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string, req: Request) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId }, include: { notes: true, spareParts: true, history: true } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    assertBranchRecordAccess(req, r.branchId)
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

    const ticketNumber = await generateTicketNumber(tenantId)
    const repair = await prisma.repairTicket.create({
      data: {
        tenantId,
        ticketNumber,
        branchId:            body.branchId,
        customerId:          body.customerId,
        customerName:        body.customerName   || 'Unknown',
        customerPhone:       body.customerPhone  || '',
        deviceBrand:         body.deviceBrand    || '',
        deviceModel:         body.deviceModel    || '',
        deviceColor:         body.deviceColor    || undefined,
        imei:                body.imei           || undefined,
        accessories:         body.accessories    || undefined,
        reportedIssue:       body.reportedIssue  || '',
        estimatedCost:       Number(body.estimatedCost) || 0,
        priority:            body.priority       || 'NORMAL',
        technicianId:        body.technicianId   || undefined,
        technicianName:      body.technicianName || undefined,
        source:              body.source         || 'WALK_IN',
        estimatedCompletion: body.estimatedCompletion ? new Date(body.estimatedCompletion) : undefined,
        ...(body.warrantyMonths != null && body.warrantyMonths !== ''
          ? { warrantyMonths: Math.max(0, Math.min(120, Number(body.warrantyMonths))) }
          : {}),
        history: { create: [{ status: 'RECEIVED', changedBy: body.createdBy ?? 'system', note: 'Ticket created' }] },
      },
      include: { notes: true, spareParts: true, history: true },
    })
    await prisma.customer.update({ where: { id: body.customerId }, data: { totalRepairs: { increment: 1 } } }).catch(() => {})
    if (body.imei) {
      await prisma.imeiRecord.updateMany({ where: { imei: body.imei }, data: { status: 'IN_REPAIR' } }).catch(() => {})
    }
    if (body.warrantyClaimId) {
      await linkRepairToClaim(tenantId, body.warrantyClaimId, repair.id)
    }
    return repair
  },

  async update(tenantId: string, id: string, body: any) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId }, include: { spareParts: true } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    const { customerName, customerPhone, deviceBrand, deviceModel, deviceColor,
            imei, reportedIssue, technicianId, technicianName, priority,
            estimatedCost, actualCost, estimatedCompletion, source, warrantyMonths } = body
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
    if (estimatedCost       !== undefined) data.estimatedCost = Number(estimatedCost)
    if (actualCost          !== undefined) data.actualCost          = Number(actualCost)
    if (estimatedCompletion !== undefined) data.estimatedCompletion = estimatedCompletion ? new Date(estimatedCompletion) : null
    if (source              !== undefined) data.source              = source
    if (warrantyMonths === null || warrantyMonths === '') {
      data.warrantyMonths = null
    } else if (warrantyMonths !== undefined) {
      data.warrantyMonths = Math.max(0, Math.min(120, Number(warrantyMonths)))
    }
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
    const unitCost = body.unitCost != null && String(body.unitCost).trim() !== ''
      ? Number(body.unitCost)
      : (Number(product.sellingPrice) || Number(product.buyingPrice) || 0)
    const unitBuyCost = Number(product.buyingPrice) || 0
    const partTotal = qty * unitCost
    await prisma.repairSparePart.create({
      data: { repairId, productId: body.productId, productName: product.name, quantity: qty, unitCost, unitBuyCost, total: partTotal },
    })
    return prisma.repairTicket.findUnique({ where: { id: repairId }, include: { notes: true, spareParts: true, history: true } })
  },

  async removeSparePart(tenantId: string, repairId: string, partId: string) {
    const r = await prisma.repairTicket.findFirst({ where: { id: repairId, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    await prisma.repairSparePart.deleteMany({ where: { id: partId, repairId } })
    return prisma.repairTicket.findUnique({ where: { id: repairId }, include: { notes: true, spareParts: true, history: true } })
  },

  async updatePhotos(tenantId: string, id: string, photos: string[]) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    return prisma.repairTicket.update({ where: { id }, data: { photos }, include: { notes: true, spareParts: true, history: true } })
  },

  async collectPayment(tenantId: string, id: string, body: { discount?: number; paymentMethod: string; cashierName?: string; paidAmount?: number }) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId }, include: { spareParts: true } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    if (r.status === 'DELIVERED') throw new AppError('Payment has already been collected for this ticket', 400)
    await assertBusinessDayOpenIfEnabled(tenantId, r.branchId)

    const serviceFee  = Number(r.estimatedCost) || 0
    const subtotal    = serviceFee
    const discount    = Number(body.discount) || 0
    const total       = Math.max(0, subtotal - discount)
    const paidAmount  = body.paidAmount != null
      ? Math.min(Math.max(0, Number(body.paidAmount)), total)
      : total
    const dueAmount   = Math.max(0, total - paidAmount)
    if (dueAmount > 0 && !r.customerId) {
      throw new AppError('Customer is required when recording credit / partial payment', 400)
    }
    const saleStatus  = dueAmount > 0 ? (paidAmount > 0 ? 'PARTIAL' : 'DUE') : 'PAID'
    const cashierName = body.cashierName || 'System'
    const invoiceNumber = await generateInvoiceNumber(tenantId)

    const repairWarrantyMonths = r.warrantyMonths != null && r.warrantyMonths >= 0
      ? Math.max(0, Math.min(120, Number(r.warrantyMonths)))
      : 0

    await prisma.$transaction(async (tx: any) => {
      await tx.repairTicket.update({
        where: { id },
        data: { actualCost: total, status: 'DELIVERED', completedAt: new Date() },
      })
      await tx.repairStatusHistory.create({
        data: {
          repairId: id,
          status: 'DELIVERED',
          changedBy: cashierName,
          note: dueAmount > 0 ? `Payment collected — LKR ${dueAmount} on customer credit` : 'Payment collected',
        },
      })
      const saleItems: any[] = []
      if (serviceFee > 0) {
        saleItems.push({
          productName: `Repair Service – ${r.deviceBrand} ${r.deviceModel}`,
          sku: r.ticketNumber,
          quantity: 1,
          unitPrice: serviceFee,
          discount: 0,
          total: serviceFee,
          warrantyMonths: repairWarrantyMonths,
        })
      }
      for (const p of r.spareParts) {
        const qty = Number(p.quantity) || 1
        const unitPrice = Number(p.unitCost) || 0
        saleItems.push({
          productName: p.productName,
          sku: '',
          quantity: qty,
          unitPrice,
          discount: 0,
          total: Number(p.total) || unitPrice * qty,
          warrantyMonths: 0,
        })
      }
      await tx.sale.create({
        data: {
          tenantId, branchId: r.branchId, invoiceNumber,
          customerId: r.customerId, customerName: r.customerName, customerPhone: r.customerPhone,
          subtotal, discount, tax: 0, total,
          paidAmount, dueAmount,
          status: saleStatus, cashierName, source: 'REPAIR',
          notes: `Repair ticket: ${r.ticketNumber}${r.reportedIssue?.trim() ? ` | Fault: ${r.reportedIssue.trim()}` : ''}`,
          items:    { create: saleItems },
          payments: paidAmount > 0
            ? { create: [{ method: body.paymentMethod as any, amount: paidAmount }] }
            : undefined,
        },
      })
      if (r.customerId && dueAmount > 0) {
        await tx.customer.update({
          where: { id: r.customerId },
          data: { totalDue: { increment: dueAmount }, totalPurchases: { increment: 1 } },
        })
      } else if (r.customerId) {
        await tx.customer.update({
          where: { id: r.customerId },
          data: { totalPurchases: { increment: 1 } },
        }).catch(() => {})
      }
      for (const p of r.spareParts) {
        if (p.productId) {
          const prod = await tx.product.findUnique({ where: { id: p.productId }, select: { stock: true, name: true } })
          if (prod) {
            // Atomic conditional decrement prevents overselling under concurrent writes.
            const dec = await tx.product.updateMany({
              where: { id: p.productId, stock: { gte: p.quantity } },
              data:  { stock: { decrement: p.quantity } },
            })
            if (dec.count === 0) {
              throw new AppError(`Insufficient stock for "${prod.name}". Available: ${prod.stock}, Required: ${p.quantity}`, 400)
            }
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
      }
    })
    // ── Auto-create Finance INCOME transaction for repair payment ──
    try {
      if (paidAmount > 0) {
        await prisma.transaction.create({
          data: {
            tenantId,
            branchId:    r.branchId,
            type:        'INCOME',
            category:    'Repairs',
            amount:      paidAmount,
            description: `Repair - ${r.ticketNumber} (${r.deviceBrand} ${r.deviceModel})${r.customerName ? ' — ' + r.customerName : ''}${dueAmount > 0 ? ` (Credit: LKR ${dueAmount})` : ''}`,
            paymentMethod: body.paymentMethod as any,
            reference:   r.ticketNumber,
            performedBy: cashierName,
          },
        })
      }
    } catch (e) { console.error('Finance repair transaction error:', e) }
    return prisma.repairTicket.findUnique({ where: { id }, include: { notes: true, spareParts: true, history: true } })
  },
}
