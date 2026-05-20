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
}
