import type { SupportChatSession, SupportChatMessage, Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { sanitizeText } from './support.util'
import { notifySupportInbox, notifyTenantUser } from './support-notify'
import { supportSseHub } from './support-sse'
import { supportTicketsService } from './support-tickets.service'
import type { SupportTicketCategory, SupportTicketPriority } from '@prisma/client'

type SessionRow = SupportChatSession & {
  messages?: SupportChatMessage[]
  startedBy?: { id: string; name: string; email: string }
  tenant?: { id: string; name: string; slug: string; ownerEmail: string }
  convertedTicket?: { id: string; ticketNumber: string } | null
}

function mapSession(s: SessionRow) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    tenant: s.tenant
      ? { id: s.tenant.id, name: s.tenant.name, slug: s.tenant.slug, ownerEmail: s.tenant.ownerEmail }
      : undefined,
    startedBy: s.startedBy
      ? { id: s.startedBy.id, name: s.startedBy.name, email: s.startedBy.email }
      : undefined,
    startedById: s.startedById,
    assigneeAdminEmail: s.assigneeAdminEmail,
    status: s.status,
    subject: s.subject,
    lastMessageAt: s.lastMessageAt,
    endedAt: s.endedAt,
    createdAt: s.createdAt,
    ticket: s.convertedTicket
      ? { id: s.convertedTicket.id, ticketNumber: s.convertedTicket.ticketNumber }
      : null,
    messages: (s.messages ?? []).map((m) => ({
      id: m.id,
      body: m.body,
      authorType: m.authorType,
      authorEmail: m.authorEmail,
      authorUserId: m.authorUserId,
      createdAt: m.createdAt,
    })),
  }
}

export const supportChatService = {
  async startOrResume(
    tenantId: string,
    userId: string,
    userEmail: string,
    input?: { subject?: string; body?: string },
  ) {
    const open = await prisma.supportChatSession.findFirst({
      where: {
        tenantId,
        startedById: userId,
        status: { in: ['WAITING', 'ACTIVE'] },
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 100 },
        startedBy: { select: { id: true, name: true, email: true } },
        convertedTicket: { select: { id: true, ticketNumber: true } },
      },
    })
    if (open) return mapSession(open)

    const subject = input?.subject ? sanitizeText(input.subject, 200) : 'Live support'
    const body = input?.body ? sanitizeText(input.body) : null
    const session = await prisma.supportChatSession.create({
      data: {
        tenantId,
        startedById: userId,
        subject,
        status: 'WAITING',
        messages: body
          ? {
              create: {
                body,
                authorType: 'TENANT_USER',
                authorUserId: userId,
                authorEmail: userEmail,
              },
            }
          : {
              create: {
                body: 'Chat started — an agent will join shortly.',
                authorType: 'SYSTEM',
                authorEmail: 'system',
              },
            },
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        startedBy: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true, ownerEmail: true } },
        convertedTicket: { select: { id: true, ticketNumber: true } },
      },
    })

    supportSseHub.publish(supportSseHub.adminInboxChannel(), 'session', {
      type: 'WAITING',
      session: mapSession(session),
    })
    void notifySupportInbox(
      `[Chat] New live chat — ${session.tenant?.name ?? tenantId}`,
      `<p>A tenant started a live chat.</p><p>Subject: ${subject}</p>`,
    )

    return mapSession(session)
  },

  async listMine(tenantId: string, userId: string) {
    const rows = await prisma.supportChatSession.findMany({
      where: { tenantId, startedById: userId },
      orderBy: { lastMessageAt: 'desc' },
      take: 30,
      include: {
        convertedTicket: { select: { id: true, ticketNumber: true } },
      },
    })
    return rows.map((r) => mapSession(r))
  },

  async getMessages(sessionId: string, tenantId?: string) {
    const session = await prisma.supportChatSession.findFirst({
      where: { id: sessionId, ...(tenantId ? { tenantId } : {}) },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        startedBy: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true, ownerEmail: true } },
        convertedTicket: { select: { id: true, ticketNumber: true } },
      },
    })
    if (!session) throw new AppError('Chat session not found', 404)
    return mapSession(session)
  },

  async sendMessage(opts: {
    sessionId: string
    body: string
    authorType: 'TENANT_USER' | 'PLATFORM_ADMIN'
    authorUserId?: string
    authorEmail: string
    tenantId?: string
  }) {
    const body = sanitizeText(opts.body)
    const session = await prisma.supportChatSession.findFirst({
      where: {
        id: opts.sessionId,
        ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
      },
    })
    if (!session) throw new AppError('Chat session not found', 404)
    if (session.status === 'ENDED') throw new AppError('Chat has ended', 400)

    const msg = await prisma.supportChatMessage.create({
      data: {
        sessionId: opts.sessionId,
        body,
        authorType: opts.authorType,
        authorUserId: opts.authorUserId ?? null,
        authorEmail: opts.authorEmail,
      },
    })
    await prisma.supportChatSession.update({
      where: { id: opts.sessionId },
      data: { lastMessageAt: new Date() },
    })

    const payload = {
      id: msg.id,
      body: msg.body,
      authorType: msg.authorType,
      authorEmail: msg.authorEmail,
      authorUserId: msg.authorUserId,
      createdAt: msg.createdAt,
      sessionId: opts.sessionId,
    }
    supportSseHub.publish(supportSseHub.sessionChannel(opts.sessionId), 'message', payload)
    supportSseHub.publish(supportSseHub.adminInboxChannel(), 'message', payload)

    if (opts.authorType === 'PLATFORM_ADMIN') {
      void notifyTenantUser({
        tenantId: session.tenantId,
        userId: session.startedById,
        type: 'SUPPORT_CHAT',
        title: 'Support replied in live chat',
        message: body.slice(0, 240),
        link: '/dashboard/support-tickets?tab=chat',
        relatedId: session.id,
      })
    } else {
      void notifySupportInbox(`[Chat] Message — ${session.id}`, `<p>${body}</p>`)
    }

    return payload
  },

  async end(sessionId: string, email: string, tenantId?: string) {
    const session = await prisma.supportChatSession.findFirst({
      where: { id: sessionId, ...(tenantId ? { tenantId } : {}) },
    })
    if (!session) throw new AppError('Chat session not found', 404)
    if (session.status === 'ENDED') return mapSession(session)

    await prisma.supportChatMessage.create({
      data: {
        sessionId,
        body: `Chat ended by ${email}`,
        authorType: 'SYSTEM',
        authorEmail: 'system',
      },
    })
    const updated = await prisma.supportChatSession.update({
      where: { id: sessionId },
      data: { status: 'ENDED', endedAt: new Date(), lastMessageAt: new Date() },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        startedBy: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true, ownerEmail: true } },
        convertedTicket: { select: { id: true, ticketNumber: true } },
      },
    })
    supportSseHub.publish(supportSseHub.sessionChannel(sessionId), 'session', {
      type: 'ENDED',
      session: mapSession(updated),
    })
    supportSseHub.publish(supportSseHub.adminInboxChannel(), 'session', {
      type: 'ENDED',
      sessionId,
    })
    return mapSession(updated)
  },

  async adminList(filters: { status?: string; page?: number; limit?: number }) {
    const take = Math.min(100, Math.max(1, filters.limit ?? 40))
    const page = Math.max(1, filters.page ?? 1)
    const where: Prisma.SupportChatSessionWhereInput = {
      ...(filters.status
        ? { status: filters.status as 'WAITING' | 'ACTIVE' | 'ENDED' }
        : { status: { in: ['WAITING', 'ACTIVE'] } }),
    }
    const [rows, total] = await Promise.all([
      prisma.supportChatSession.findMany({
        where,
        orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }],
        skip: (page - 1) * take,
        take,
        include: {
          tenant: { select: { id: true, name: true, slug: true, ownerEmail: true } },
          startedBy: { select: { id: true, name: true, email: true } },
          convertedTicket: { select: { id: true, ticketNumber: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.supportChatSession.count({ where }),
    ])
    return { data: rows.map((r) => mapSession(r)), total, page, limit: take }
  },

  async claim(sessionId: string, adminEmail: string) {
    const session = await prisma.supportChatSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new AppError('Chat session not found', 404)
    if (session.status === 'ENDED') throw new AppError('Chat has ended', 400)

    const updated = await prisma.$transaction(async (tx) => {
      await tx.supportChatMessage.create({
        data: {
          sessionId,
          body: `${adminEmail} joined the chat`,
          authorType: 'SYSTEM',
          authorEmail: 'system',
        },
      })
      return tx.supportChatSession.update({
        where: { id: sessionId },
        data: {
          status: 'ACTIVE',
          assigneeAdminEmail: adminEmail,
          lastMessageAt: new Date(),
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          startedBy: { select: { id: true, name: true, email: true } },
          tenant: { select: { id: true, name: true, slug: true, ownerEmail: true } },
          convertedTicket: { select: { id: true, ticketNumber: true } },
        },
      })
    })

    const mapped = mapSession(updated)
    supportSseHub.publish(supportSseHub.sessionChannel(sessionId), 'session', {
      type: 'CLAIMED',
      session: mapped,
    })
    supportSseHub.publish(supportSseHub.adminInboxChannel(), 'session', {
      type: 'CLAIMED',
      session: mapped,
    })
    return mapped
  },

  async convertToTicket(
    sessionId: string,
    adminEmail: string,
    input?: { subject?: string; category?: SupportTicketCategory; priority?: SupportTicketPriority },
  ) {
    const session = await prisma.supportChatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        convertedTicket: true,
      },
    })
    if (!session) throw new AppError('Chat session not found', 404)
    if (session.convertedTicket) {
      return supportTicketsService.adminGet(session.convertedTicket.id)
    }

    const transcript = session.messages
      .map((m) => `[${m.authorType}] ${m.authorEmail}: ${m.body}`)
      .join('\n')
      .slice(0, 7500)

    const ticket = await supportTicketsService.createFromChat({
      sessionId,
      tenantId: session.tenantId,
      createdById: session.startedById,
      adminEmail,
      subject: input?.subject || session.subject || 'Live chat follow-up',
      category: input?.category || 'OTHER',
      priority: input?.priority || 'MEDIUM',
      transcript,
    })

    await prisma.supportChatMessage.create({
      data: {
        sessionId,
        body: `Converted to ticket ${ticket.ticketNumber}`,
        authorType: 'SYSTEM',
        authorEmail: 'system',
      },
    })

    return ticket
  },
}
