import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { Request } from 'express'

export const customersService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const where: any = { tenantId, ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }, { email: { contains: search, mode: 'insensitive' } }] }) }
    const [data, total] = await Promise.all([prisma.customer.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }), prisma.customer.count({ where })])
    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string) {
    const c = await prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        sales:   { orderBy: { createdAt: 'desc' }, include: { items: true } },
        repairs: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!c) throw new AppError('Customer not found', 404)
    return c
  },

  async create(tenantId: string, body: any) {
    const existing = await prisma.customer.findFirst({ where: { tenantId, phone: body.phone } })
    if (existing) throw new AppError('Phone number already registered', 409)
    return prisma.customer.create({ data: { ...body, tenantId } })
  },

  async update(tenantId: string, id: string, body: any) {
    const c = await prisma.customer.findFirst({ where: { id, tenantId } })
    if (!c) throw new AppError('Customer not found', 404)
    return prisma.customer.update({ where: { id }, data: body })
  },

  async search(tenantId: string, q: string) {
    return prisma.customer.findMany({ where: { tenantId, OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] }, take: 10 })
  },

  async creditPayment(tenantId: string, customerId: string, body: { amount: number; paymentMethod: string; branchId: string; performedBy: string }) {
    const c = await prisma.customer.findFirst({ where: { id: customerId, tenantId } })
    if (!c) throw new AppError('Customer not found', 404)

    const { amount, paymentMethod, branchId, performedBy } = body
    if (amount <= 0) throw new AppError('Amount must be greater than 0', 400)
    if (amount > c.totalDue) throw new AppError('Payment amount cannot exceed outstanding balance', 400)

    const newTotalDue = Math.max(0, c.totalDue - amount)

    await prisma.$transaction([
      prisma.customer.update({ where: { id: customerId }, data: { totalDue: newTotalDue } }),
      prisma.transaction.create({
        data: {
          tenantId,
          branchId,
          type: 'INCOME',
          category: 'Customer Credit Payment',
          amount,
          description: `Credit payment from ${c.name} (${c.phone})`,
          paymentMethod: paymentMethod as any,
          performedBy,
        },
      }),
    ])

    return { customerId, amountPaid: amount, newOutstanding: newTotalDue }
  },
}
