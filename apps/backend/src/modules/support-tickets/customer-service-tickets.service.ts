import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { customerSrNumberFor, sanitizeText } from './support.util'
import type { CustomerServiceTicketStatus, Prisma, SupportTicketPriority } from '@prisma/client'
import { notifyTenantUser } from './support-notify'

async function nextNumber(tx: Prisma.TransactionClient, tenantId: string) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const count = await tx.customerServiceTicket.count({
    where: { tenantId, createdAt: { gte: start } },
  })
  return customerSrNumberFor(new Date(), count + 1)
}

function mapTicket(t: any) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    tenantId: t.tenantId,
    branchId: t.branchId,
    customerId: t.customerId,
    createdById: t.createdById,
    createdBy: t.createdBy
      ? { id: t.createdBy.id, name: t.createdBy.name, email: t.createdBy.email }
      : undefined,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    resolvedAt: t.resolvedAt,
    closedAt: t.closedAt,
    messages: (t.messages ?? []).map((m: any) => ({
      id: m.id,
      body: m.body,
      authorType: m.authorType,
      authorEmail: m.authorEmail,
      authorUserId: m.authorUserId,
      createdAt: m.createdAt,
    })),
  }
}

export const customerServiceTicketsService = {
  async create(
    tenantId: string,
    userId: string,
    userEmail: string,
    input: {
      subject: string
      body: string
      customerId?: string | null
      branchId?: string | null
      priority: SupportTicketPriority
    },
  ) {
    const subject = sanitizeText(input.subject, 200)
    const body = sanitizeText(input.body)
    const ticket = await prisma.$transaction(async (tx) => {
      const ticketNumber = await nextNumber(tx, tenantId)
      return tx.customerServiceTicket.create({
        data: {
          tenantId,
          createdById: userId,
          ticketNumber,
          subject,
          customerId: input.customerId || null,
          branchId: input.branchId || null,
          priority: input.priority,
          messages: {
            create: {
              body,
              authorType: 'TENANT_USER',
              authorUserId: userId,
              authorEmail: userEmail,
            },
          },
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      })
    })
    return mapTicket(ticket)
  },

  async list(tenantId: string, filters: { status?: string; page?: number; limit?: number }) {
    const take = Math.min(100, Math.max(1, filters.limit ?? 30))
    const page = Math.max(1, filters.page ?? 1)
    const where: Prisma.CustomerServiceTicketWhereInput = {
      tenantId,
      ...(filters.status ? { status: filters.status as CustomerServiceTicketStatus } : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.customerServiceTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      }),
      prisma.customerServiceTicket.count({ where }),
    ])
    return { data: rows.map(mapTicket), total, page, limit: take }
  },

  async get(tenantId: string, id: string) {
    const row = await prisma.customerServiceTicket.findFirst({
      where: { id, tenantId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })
    if (!row) throw new AppError('Ticket not found', 404)
    return mapTicket(row)
  },

  async addMessage(tenantId: string, userId: string, userEmail: string, id: string, bodyRaw: string) {
    const body = sanitizeText(bodyRaw)
    const existing = await prisma.customerServiceTicket.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Ticket not found', 404)
    if (existing.status === 'CLOSED') throw new AppError('Ticket is closed', 400)

    await prisma.customerServiceTicketMessage.create({
      data: {
        ticketId: id,
        body,
        authorType: 'TENANT_USER',
        authorUserId: userId,
        authorEmail: userEmail,
      },
    })
    if (existing.status === 'WAITING_CUSTOMER' || existing.status === 'RESOLVED') {
      await prisma.customerServiceTicket.update({
        where: { id },
        data: { status: 'OPEN', closedAt: null },
      })
    }
    return this.get(tenantId, id)
  },

  async patch(
    tenantId: string,
    userId: string,
    id: string,
    input: { status?: CustomerServiceTicketStatus },
  ) {
    const existing = await prisma.customerServiceTicket.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Ticket not found', 404)
    const data: Prisma.CustomerServiceTicketUpdateInput = {}
    if (input.status) {
      data.status = input.status
      if (input.status === 'RESOLVED') data.resolvedAt = new Date()
      if (input.status === 'CLOSED') data.closedAt = new Date()
    }
    await prisma.customerServiceTicket.update({ where: { id }, data })
    if (input.status && existing.createdById !== userId) {
      void notifyTenantUser({
        tenantId,
        userId: existing.createdById,
        type: 'CUSTOMER_SERVICE_TICKET',
        title: `Customer SR ${existing.ticketNumber} → ${input.status}`,
        message: existing.subject,
        link: '/dashboard/customer-service-tickets',
        relatedId: id,
      })
    }
    return this.get(tenantId, id)
  },
}
