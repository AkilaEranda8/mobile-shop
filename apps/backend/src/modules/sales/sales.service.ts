import { prisma } from '../../config/database'
import { Prisma } from '@prisma/client'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateInvoiceNumber } from '../../utils/counters'
import { Request } from 'express'

export const salesService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const branchId = req.query.branchId as string | undefined
    const status = req.query.status as string | undefined
    const customerId = req.query.customerId as string | undefined
    const where: any = { tenantId, ...(branchId && { branchId }), ...(status && { status }), ...(customerId && { customerId }), ...(search && { OR: [{ invoiceNumber: { contains: search, mode: 'insensitive' } }, { customerName: { contains: search, mode: 'insensitive' } }, { customerPhone: { contains: search } }] }) }
    const [data, total] = await Promise.all([
      prisma.sale.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { items: true, payments: true, _count: { select: { returns: true } }, returns: { select: { refundAmount: true } } } }),
      prisma.sale.count({ where }),
    ])
    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string) {
    const s = await prisma.sale.findFirst({ where: { id, tenantId }, include: { items: true, payments: true, returns: { include: { items: true } } } })
    if (!s) throw new AppError('Sale not found', 404)
    return s
  },

  async create(tenantId: string, cashierId: string, cashierName: string, body: any) {
    const invoiceNumber = await generateInvoiceNumber(tenantId)
    const sale = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const s = await tx.sale.create({
        data: {
          tenantId,
          branchId: body.branchId,
          invoiceNumber,
          customerId: body.customerId,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          subtotal: body.subtotal,
          discount: body.discount ?? 0,
          tax: body.tax ?? 0,
          total: body.total,
          paidAmount: body.paidAmount,
          dueAmount: body.dueAmount ?? 0,
          status: body.status ?? 'PAID',
          cashierId,
          cashierName,
          notes: body.notes,
          items: { create: body.items },
          payments: { create: body.payments },
        },
        include: { items: true, payments: true },
      })
      for (const item of body.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true, name: true } })
        if (product && product.stock < item.quantity) {
          throw new AppError(`Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`, 400)
        }
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } })
        await tx.stockMovement.create({ data: { productId: item.productId, branchId: body.branchId, type: 'SALE', quantity: -item.quantity, reference: invoiceNumber, performedBy: cashierName } })
        if (item.imei) {
          const existingImei = await tx.imeiRecord.findUnique({ where: { imei: item.imei } })
          if (existingImei) {
            await tx.imeiRecord.update({ where: { imei: item.imei }, data: { status: 'SOLD', customerId: body.customerId ?? existingImei.customerId, saleId: s.id } })
          } else if (item.productId) {
            // Auto-create ImeiRecord if not pre-registered
            await tx.imeiRecord.create({ data: { imei: item.imei, productId: item.productId, branchId: body.branchId, status: 'SOLD', customerId: body.customerId, saleId: s.id } })
          }
        }
      }
      if (body.customerId) {
        await tx.customer.update({ where: { id: body.customerId }, data: { totalPurchases: { increment: 1 }, totalDue: { increment: body.dueAmount ?? 0 } } })
      }
      return s
    })
    return sale
  },
}
