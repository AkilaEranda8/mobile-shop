import type {
  SupportTicket,
  SupportTicketAttachment,
  SupportTicketCategory,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { computeSlaDueAt, isSlaBreached, sanitizeText, ticketNumberFor } from './support.util'
import { notifySupportInbox, notifyTenantUser } from './support-notify'

type TicketWithRelations = SupportTicket & {
  messages?: SupportTicketMessage[]
  attachments?: SupportTicketAttachment[]
  createdBy?: { id: string; name: string; email: string }
  tenant?: { id: string; name: string; slug: string; ownerEmail: string }
}

function mapTicket(t: TicketWithRelations, opts?: { includeInternal?: boolean }) {
  const messages = (t.messages ?? [])
    .filter((m) => (opts?.includeInternal ? true : !m.isInternal))
    .map((m) => ({
      id: m.id,
      body: m.body,
      isInternal: m.isInternal,
      authorType: m.authorType,
      authorEmail: m.authorEmail,
      authorUserId: m.authorUserId,
      createdAt: m.createdAt,
    }))
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    tenantId: t.tenantId,
    tenant: t.tenant
      ? { id: t.tenant.id, name: t.tenant.name, slug: t.tenant.slug, ownerEmail: t.tenant.ownerEmail }
      : undefined,
    createdBy: t.createdBy
      ? { id: t.createdBy.id, name: t.createdBy.name, email: t.createdBy.email }
      : undefined,
    createdById: t.createdById,
    assigneeAdminEmail: t.assigneeAdminEmail,
    category: t.category,
    priority: t.priority,
    status: t.status,
    subject: t.subject,
    slaDueAt: t.slaDueAt,
    slaBreached: isSlaBreached(t.slaDueAt, t.status),
    firstResponseAt: t.firstResponseAt,
    resolvedAt: t.resolvedAt,
    closedAt: t.closedAt,
    sourceChatSessionId: t.sourceChatSessionId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    messages,
    attachments: (t.attachments ?? []).map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      url: a.url,
      messageId: a.messageId,
      createdAt: a.createdAt,
    })),
  }
}

async function nextTicketNumber(tx: Prisma.TransactionClient): Promise<string> {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const count = await tx.supportTicket.count({ where: { createdAt: { gte: start } } })
  return ticketNumberFor(new Date(), count + 1)
}

export const supportTicketsService = {
  async create(
    tenantId: string,
    userId: string,
    userEmail: string,
    input: {
      subject: string
      body: string
      category: SupportTicketCategory
      priority: SupportTicketPriority
    },
  ) {
    const subject = sanitizeText(input.subject, 200)
    const body = sanitizeText(input.body)
    const ticket = await prisma.$transaction(async (tx) => {
      const ticketNumber = await nextTicketNumber(tx)
      const created = await tx.supportTicket.create({
        data: {
          tenantId,
          createdById: userId,
          ticketNumber,
          subject,
          category: input.category,
          priority: input.priority,
          slaDueAt: computeSlaDueAt(input.priority),
          messages: {
            create: {
              body,
              authorType: 'TENANT_USER',
              authorUserId: userId,
              authorEmail: userEmail,
              isInternal: false,
            },
          },
          events: {
            create: {
              action: 'CREATED',
              newStatus: 'OPEN',
              newPriority: input.priority,
              performedByEmail: userEmail,
            },
          },
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          attachments: true,
          createdBy: { select: { id: true, name: true, email: true } },
          tenant: { select: { id: true, name: true, slug: true, ownerEmail: true } },
        },
      })
      return created
    })

    void notifySupportInbox(
      `[SR] ${ticket.ticketNumber}: ${ticket.subject}`,
      `<p>New support ticket from <b>${ticket.tenant?.name}</b>.</p><p>${ticket.subject}</p><p>${body}</p>`,
    )

    return mapTicket(ticket)
  },

  async listTenant(
    tenantId: string,
    filters: { status?: string; priority?: string; page?: number; limit?: number },
  ) {
    const take = Math.min(100, Math.max(1, filters.limit ?? 30))
    const page = Math.max(1, filters.page ?? 1)
    const where: Prisma.SupportTicketWhereInput = {
      tenantId,
      ...(filters.status ? { status: filters.status as SupportTicketStatus } : {}),
      ...(filters.priority ? { priority: filters.priority as SupportTicketPriority } : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          attachments: true,
        },
      }),
      prisma.supportTicket.count({ where }),
    ])
    return { data: rows.map((r) => mapTicket(r)), total, page, limit: take }
  },

  async getTenant(tenantId: string, id: string) {
    const row = await prisma.supportTicket.findFirst({
      where: { id, tenantId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        attachments: true,
        createdBy: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true, ownerEmail: true } },
      },
    })
    if (!row) throw new AppError('Ticket not found', 404)
    return mapTicket(row, { includeInternal: false })
  },

  async addTenantMessage(tenantId: string, userId: string, userEmail: string, id: string, bodyRaw: string) {
    const body = sanitizeText(bodyRaw)
    const existing = await prisma.supportTicket.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Ticket not found', 404)
    if (existing.status === 'CLOSED') throw new AppError('Ticket is closed', 400)

    const updated = await prisma.$transaction(async (tx) => {
      await tx.supportTicketMessage.create({
        data: {
          ticketId: id,
          body,
          isInternal: false,
          authorType: 'TENANT_USER',
          authorUserId: userId,
          authorEmail: userEmail,
        },
      })
      const nextStatus =
        existing.status === 'WAITING_CUSTOMER' || existing.status === 'RESOLVED'
          ? ('OPEN' as const)
          : existing.status
      const reopened = nextStatus !== existing.status && existing.status === 'RESOLVED'
      return tx.supportTicket.update({
        where: { id },
        data: {
          status: nextStatus,
          closedAt: null,
          resolvedAt: reopened ? null : existing.resolvedAt,
          ...(nextStatus !== existing.status
            ? {
                events: {
                  create: {
                    action: reopened ? 'REOPENED' : 'MESSAGE',
                    oldStatus: existing.status,
                    newStatus: nextStatus,
                    performedByEmail: userEmail,
                  },
                },
              }
            : {
                events: {
                  create: { action: 'MESSAGE', performedByEmail: userEmail },
                },
              }),
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          attachments: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      })
    })

    void notifySupportInbox(
      `[SR] Reply on ${existing.ticketNumber}`,
      `<p>Tenant reply on ${existing.ticketNumber}</p><p>${body}</p>`,
    )

    return mapTicket(updated)
  },

  async closeTenant(tenantId: string, userEmail: string, id: string) {
    const existing = await prisma.supportTicket.findFirst({ where: { id, tenantId } })
    if (!existing) throw new AppError('Ticket not found', 404)
    if (existing.status !== 'RESOLVED') throw new AppError('Only resolved tickets can be closed', 400)
    const updated = await prisma.supportTicket.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        events: {
          create: {
            action: 'CLOSED',
            oldStatus: 'RESOLVED',
            newStatus: 'CLOSED',
            performedByEmail: userEmail,
          },
        },
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        attachments: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })
    return mapTicket(updated)
  },

  async addAttachment(
    ticketId: string,
    tenantId: string | null,
    file: { fileName: string; mimeType: string; sizeBytes: number; url: string },
    messageId?: string,
  ) {
    const where = tenantId ? { id: ticketId, tenantId } : { id: ticketId }
    const ticket = await prisma.supportTicket.findFirst({ where })
    if (!ticket) throw new AppError('Ticket not found', 404)
    const att = await prisma.supportTicketAttachment.create({
      data: {
        ticketId,
        messageId: messageId || null,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        url: file.url,
      },
    })
    await prisma.supportTicketEvent.create({
      data: {
        ticketId,
        action: 'ATTACHMENT',
        note: file.fileName,
        performedByEmail: 'system',
      },
    })
    return att
  },

  async adminList(filters: {
    status?: string
    priority?: string
    assignee?: string
    breached?: boolean
    q?: string
    page?: number
    limit?: number
  }) {
    const take = Math.min(100, Math.max(1, filters.limit ?? 40))
    const page = Math.max(1, filters.page ?? 1)
    const where: Prisma.SupportTicketWhereInput = {
      ...(filters.status ? { status: filters.status as SupportTicketStatus } : {}),
      ...(filters.priority ? { priority: filters.priority as SupportTicketPriority } : {}),
      ...(filters.assignee ? { assigneeAdminEmail: filters.assignee } : {}),
      ...(filters.q
        ? {
            OR: [
              { subject: { contains: filters.q, mode: 'insensitive' } },
              { ticketNumber: { contains: filters.q, mode: 'insensitive' } },
              { tenant: { name: { contains: filters.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(filters.breached
        ? {
            status: { notIn: ['RESOLVED', 'CLOSED'] },
            slaDueAt: { lt: new Date() },
          }
        : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: [{ status: 'asc' }, { slaDueAt: 'asc' }],
        skip: (page - 1) * take,
        take,
        include: {
          tenant: { select: { id: true, name: true, slug: true, ownerEmail: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.supportTicket.count({ where }),
    ])
    return { data: rows.map((r) => mapTicket(r)), total, page, limit: take }
  },

  async adminGet(id: string) {
    const row = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        attachments: true,
        events: { orderBy: { createdAt: 'desc' }, take: 50 },
        createdBy: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true, ownerEmail: true } },
      },
    })
    if (!row) throw new AppError('Ticket not found', 404)
    return { ...mapTicket(row, { includeInternal: true }), events: row.events }
  },

  async adminPatch(
    id: string,
    adminEmail: string,
    input: {
      status?: SupportTicketStatus
      priority?: SupportTicketPriority
      assigneeAdminEmail?: string | null
    },
  ) {
    const existing = await prisma.supportTicket.findUnique({ where: { id } })
    if (!existing) throw new AppError('Ticket not found', 404)

    const data: Prisma.SupportTicketUpdateInput = {}
    const events: Prisma.SupportTicketEventCreateWithoutTicketInput[] = []

    if (input.status && input.status !== existing.status) {
      data.status = input.status
      if (input.status === 'RESOLVED') data.resolvedAt = new Date()
      if (input.status === 'CLOSED') data.closedAt = new Date()
      if (input.status === 'OPEN' || input.status === 'IN_PROGRESS') {
        data.closedAt = null
      }
      events.push({
        action: input.status === 'CLOSED' ? 'CLOSED' : 'STATUS_CHANGED',
        oldStatus: existing.status,
        newStatus: input.status,
        performedByEmail: adminEmail,
      })
    }
    if (input.priority && input.priority !== existing.priority) {
      data.priority = input.priority
      if (!existing.firstResponseAt) {
        data.slaDueAt = computeSlaDueAt(input.priority)
      }
      events.push({
        action: 'PRIORITY_CHANGED',
        oldPriority: existing.priority,
        newPriority: input.priority,
        performedByEmail: adminEmail,
      })
    }
    if (input.assigneeAdminEmail !== undefined && input.assigneeAdminEmail !== existing.assigneeAdminEmail) {
      data.assigneeAdminEmail = input.assigneeAdminEmail
      events.push({
        action: 'ASSIGNEE_CHANGED',
        oldAssigneeAdminEmail: existing.assigneeAdminEmail,
        newAssigneeAdminEmail: input.assigneeAdminEmail,
        performedByEmail: adminEmail,
      })
    }

    if (!Object.keys(data).length) return this.adminGet(id)

    await prisma.supportTicket.update({
      where: { id },
      data: {
        ...data,
        events: { create: events },
      },
    })

    if (input.status && input.status !== existing.status) {
      void notifyTenantUser({
        tenantId: existing.tenantId,
        userId: existing.createdById,
        type: 'SUPPORT_TICKET',
        title: `Ticket ${existing.ticketNumber} → ${input.status}`,
        message: `Your support ticket "${existing.subject}" is now ${input.status}.`,
        link: '/dashboard/support-tickets',
        relatedId: existing.id,
      })
    }

    return this.adminGet(id)
  },

  async adminMessage(
    id: string,
    adminEmail: string,
    bodyRaw: string,
    isInternal = false,
  ) {
    const body = sanitizeText(bodyRaw)
    const existing = await prisma.supportTicket.findUnique({ where: { id } })
    if (!existing) throw new AppError('Ticket not found', 404)

    await prisma.$transaction(async (tx) => {
      await tx.supportTicketMessage.create({
        data: {
          ticketId: id,
          body,
          isInternal,
          authorType: 'PLATFORM_ADMIN',
          authorEmail: adminEmail,
        },
      })
      await tx.supportTicket.update({
        where: { id },
        data: {
          firstResponseAt: existing.firstResponseAt ?? new Date(),
          status: isInternal
            ? existing.status
            : existing.status === 'OPEN'
              ? 'IN_PROGRESS'
              : existing.status === 'WAITING_CUSTOMER'
                ? 'IN_PROGRESS'
                : existing.status,
          events: {
            create: { action: 'MESSAGE', note: isInternal ? 'internal' : 'public', performedByEmail: adminEmail },
          },
        },
      })
    })

    if (!isInternal) {
      const user = await prisma.user.findUnique({
        where: { id: existing.createdById },
        select: { email: true },
      })
      void notifyTenantUser({
        tenantId: existing.tenantId,
        userId: existing.createdById,
        type: 'SUPPORT_TICKET',
        title: `Reply on ${existing.ticketNumber}`,
        message: body.slice(0, 240),
        link: '/dashboard/support-tickets',
        relatedId: existing.id,
        emailTo: user?.email,
      })
    }

    return this.adminGet(id)
  },

  async reportsSummary() {
    const now = new Date()
    const [byStatus, byPriority, byCategory, openRows, resolved] = await Promise.all([
      prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.supportTicket.groupBy({ by: ['priority'], _count: { _all: true } }),
      prisma.supportTicket.groupBy({ by: ['category'], _count: { _all: true } }),
      prisma.supportTicket.findMany({
        where: { status: { notIn: ['RESOLVED', 'CLOSED'] } },
        select: { slaDueAt: true, firstResponseAt: true, createdAt: true, resolvedAt: true },
      }),
      prisma.supportTicket.findMany({
        where: { resolvedAt: { not: null } },
        select: { createdAt: true, firstResponseAt: true, resolvedAt: true },
        take: 500,
        orderBy: { resolvedAt: 'desc' },
      }),
    ])

    const breached = openRows.filter((r) => r.slaDueAt < now).length
    const avgFirstMs =
      resolved.filter((r) => r.firstResponseAt).reduce((s, r) => {
        return s + (r.firstResponseAt!.getTime() - r.createdAt.getTime())
      }, 0) / Math.max(1, resolved.filter((r) => r.firstResponseAt).length)
    const avgResolveMs =
      resolved.filter((r) => r.resolvedAt).reduce((s, r) => {
        return s + (r.resolvedAt!.getTime() - r.createdAt.getTime())
      }, 0) / Math.max(1, resolved.filter((r) => r.resolvedAt).length)

    return {
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      byPriority: Object.fromEntries(byPriority.map((r) => [r.priority, r._count._all])),
      byCategory: Object.fromEntries(byCategory.map((r) => [r.category, r._count._all])),
      openCount: openRows.length,
      breachedCount: breached,
      avgFirstResponseHours: Math.round((avgFirstMs / 36e5) * 10) / 10,
      avgResolutionHours: Math.round((avgResolveMs / 36e5) * 10) / 10,
    }
  },

  async createFromChat(opts: {
    sessionId: string
    tenantId: string
    createdById: string
    adminEmail: string
    subject: string
    category: SupportTicketCategory
    priority: SupportTicketPriority
    transcript: string
  }) {
    const subject = sanitizeText(opts.subject, 200)
    const body = sanitizeText(opts.transcript, 8000)
    const ticket = await prisma.$transaction(async (tx) => {
      const ticketNumber = await nextTicketNumber(tx)
      return tx.supportTicket.create({
        data: {
          tenantId: opts.tenantId,
          createdById: opts.createdById,
          ticketNumber,
          subject,
          category: opts.category,
          priority: opts.priority,
          status: 'IN_PROGRESS',
          assigneeAdminEmail: opts.adminEmail,
          slaDueAt: computeSlaDueAt(opts.priority),
          firstResponseAt: new Date(),
          sourceChatSessionId: opts.sessionId,
          messages: {
            create: {
              body: body || '(Converted from live chat)',
              authorType: 'SYSTEM',
              authorEmail: 'system',
              isInternal: false,
            },
          },
          events: {
            create: {
              action: 'CREATED',
              newStatus: 'IN_PROGRESS',
              newPriority: opts.priority,
              note: `Converted from chat ${opts.sessionId}`,
              performedByEmail: opts.adminEmail,
            },
          },
        },
        include: {
          messages: true,
          attachments: true,
          createdBy: { select: { id: true, name: true, email: true } },
          tenant: { select: { id: true, name: true, slug: true, ownerEmail: true } },
        },
      })
    })
    return mapTicket(ticket, { includeInternal: true })
  },
}
