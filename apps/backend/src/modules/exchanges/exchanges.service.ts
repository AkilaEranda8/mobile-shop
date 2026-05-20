import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { Request } from 'express'

async function generateExchangeNumber(tenantId: string): Promise<string> {
  const count = await prisma.deviceExchange.count({ where: { tenantId } })
  return `EX-${String(count + 1).padStart(5, '0')}`
}

export const exchangesService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const customerId = req.query.customerId as string | undefined
    const where: any = {
      tenantId,
      ...(customerId && { customerId }),
      ...(search && {
        OR: [
          { exchangeNumber: { contains: search, mode: 'insensitive' } },
          { customerName:   { contains: search, mode: 'insensitive' } },
          { customerPhone:  { contains: search } },
          { oldBrand:       { contains: search, mode: 'insensitive' } },
          { oldModel:       { contains: search, mode: 'insensitive' } },
        ],
      }),
    }
    const [data, total] = await Promise.all([
      prisma.deviceExchange.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.deviceExchange.count({ where }),
    ])
    return { data, total, page, limit }
  },

  async getById(tenantId: string, id: string) {
    const e = await prisma.deviceExchange.findFirst({ where: { id, tenantId } })
    if (!e) throw new AppError('Exchange record not found', 404)
    return e
  },

  async create(tenantId: string, body: any, userId: string) {
    if (!body.branchId) {
      const branch = await prisma.branch.findFirst({ where: { tenantId } })
      if (!branch) throw new AppError('No branch found', 400)
      body.branchId = branch.id
    }

    if (!body.customerId && body.customerPhone) {
      let customer = await prisma.customer.findFirst({ where: { tenantId, phone: body.customerPhone } })
      if (!customer) {
        customer = await prisma.customer.create({
          data: { tenantId, name: body.customerName || 'Unknown', phone: body.customerPhone },
        })
      }
      body.customerId = customer.id
    }

    const exchangeNumber = await generateExchangeNumber(tenantId)
    const exchange = await prisma.deviceExchange.create({
      data: {
        tenantId,
        branchId:      body.branchId,
        exchangeNumber,
        customerId:    body.customerId ?? undefined,
        customerName:  body.customerName,
        customerPhone: body.customerPhone,
        oldBrand:      body.oldBrand,
        oldModel:      body.oldModel,
        oldImei:       body.oldImei ?? undefined,
        oldCondition:  body.oldCondition ?? 'GOOD',
        exchangeValue: Number(body.exchangeValue ?? 0),
        newBrand:      body.newBrand ?? undefined,
        newModel:      body.newModel ?? undefined,
        newImei:       body.newImei ?? undefined,
        newDevicePrice: body.newDevicePrice ? Number(body.newDevicePrice) : undefined,
        saleId:        body.saleId ?? undefined,
        notes:         body.notes ?? undefined,
        status:        body.status ?? 'COMPLETED',
        createdBy:     userId,
      },
    })
    return exchange
  },

  async update(tenantId: string, id: string, body: any) {
    const e = await prisma.deviceExchange.findFirst({ where: { id, tenantId } })
    if (!e) throw new AppError('Exchange record not found', 404)
    return prisma.deviceExchange.update({ where: { id }, data: body })
  },

  async remove(tenantId: string, id: string) {
    const e = await prisma.deviceExchange.findFirst({ where: { id, tenantId } })
    if (!e) throw new AppError('Exchange record not found', 404)
    await prisma.deviceExchange.delete({ where: { id } })
    return { success: true }
  },
}
