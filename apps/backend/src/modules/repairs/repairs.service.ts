import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateTicketNumber } from '../../utils/counters'
import { Request } from 'express'

export const repairsService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const status = req.query.status as string | undefined
    const branchId = req.query.branchId as string | undefined
    const where: any = { tenantId, ...(status && { status }), ...(branchId && { branchId }), ...(search && { OR: [{ ticketNumber: { contains: search, mode: 'insensitive' } }, { customerName: { contains: search, mode: 'insensitive' } }, { deviceBrand: { contains: search, mode: 'insensitive' } }, { deviceModel: { contains: search, mode: 'insensitive' } }] }) }
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
    const ticketNumber = await generateTicketNumber(tenantId)
    const repair = await prisma.repairTicket.create({
      data: { ...repairData, tenantId, ticketNumber, history: { create: [{ status: 'RECEIVED', changedBy: createdBy ?? 'system', note: 'Ticket created' }] } },
      include: { notes: true, spareParts: true, history: true },
    })
    await prisma.customer.update({ where: { id: body.customerId }, data: { totalRepairs: { increment: 1 } } }).catch(() => {})
    return repair
  },

  async update(tenantId: string, id: string, body: any) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    const { customerName, customerPhone, deviceBrand, deviceModel, deviceColor,
            imei, reportedIssue, technicianId, technicianName, priority,
            estimatedCost, actualCost, estimatedCompletion } = body
    const data: any = {}
    if (customerName        !== undefined) data.customerName        = customerName
    if (customerPhone       !== undefined) data.customerPhone       = customerPhone
    if (deviceBrand         !== undefined) data.deviceBrand         = deviceBrand
    if (deviceModel         !== undefined) data.deviceModel         = deviceModel
    if (deviceColor         !== undefined) data.deviceColor         = deviceColor
    if (imei                !== undefined) data.imei                = imei
    if (reportedIssue       !== undefined) data.reportedIssue       = reportedIssue
    if (technicianId        !== undefined) data.technicianId        = technicianId
    if (technicianName      !== undefined) data.technicianName      = technicianName
    if (priority            !== undefined) data.priority            = priority
    if (estimatedCost       !== undefined) data.estimatedCost       = Number(estimatedCost)
    if (actualCost          !== undefined) data.actualCost          = Number(actualCost)
    if (estimatedCompletion !== undefined) data.estimatedCompletion = estimatedCompletion ? new Date(estimatedCompletion) : null
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
    return prisma.repairTicket.findUnique({ where: { id }, include: { notes: true, spareParts: true, history: true } })
  },

  async addNote(tenantId: string, id: string, text: string, authorName: string, isPublic: boolean) {
    const r = await prisma.repairTicket.findFirst({ where: { id, tenantId } })
    if (!r) throw new AppError('Repair ticket not found', 404)
    return prisma.repairNote.create({ data: { repairId: id, text, authorName, isPublic } })
  },
}
