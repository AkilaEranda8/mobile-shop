import type {
  FeatureSuggestionPriority,
  FeatureSuggestionStatus,
  Prisma,
  UserNotificationType,
} from '@prisma/client'
import { prisma } from '../../config/database'
import type {
  AdminSuggestionFilters,
  CreateSuggestionInput,
  HistoryCreateInput,
} from './feature-suggestions.types'
import { dispatchInAppNotification } from '../notification-engine/notification-engine.adapter.in-app'

const submitterSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const

const tenantSelect = {
  id: true,
  name: true,
  slug: true,
} as const

export const featureSuggestionsRepository = {
  async createSuggestion(
    tx: Prisma.TransactionClient,
    data: {
      tenantId: string
      submittedById: string
      input: CreateSuggestionInput
    },
  ) {
    return tx.featureSuggestion.create({
      data: {
        tenantId: data.tenantId,
        submittedById: data.submittedById,
        category: data.input.category,
        title: data.input.title,
        description: data.input.description,
        status: 'NEW',
        priority: 'MEDIUM',
      },
    })
  },

  async createHistory(tx: Prisma.TransactionClient, data: HistoryCreateInput) {
    return tx.featureSuggestionHistory.create({
      data: {
        suggestionId: data.suggestionId,
        action: data.action,
        oldStatus: data.oldStatus ?? null,
        newStatus: data.newStatus ?? null,
        oldPriority: data.oldPriority ?? null,
        newPriority: data.newPriority ?? null,
        publicResponse: data.publicResponse ?? null,
        performedByEmail: data.performedByEmail,
      },
    })
  },

  async createNotification(
    tx: Prisma.TransactionClient,
    data: {
      tenantId: string
      userId: string
      type: UserNotificationType
      title: string
      message: string
      link?: string | null
      relatedId?: string | null
    },
  ) {
    const result = await dispatchInAppNotification(data, tx)
    if (!result.ok) throw new Error(result.error ?? 'Failed to create notification')
    return { id: result.messageId! }
  },

  async countTodayByUser(tenantId: string, userId: string, since: Date) {
    return prisma.featureSuggestion.count({
      where: {
        tenantId,
        submittedById: userId,
        createdAt: { gte: since },
      },
    })
  },

  async findRecentByUser(tenantId: string, userId: string, since: Date) {
    return prisma.featureSuggestion.findMany({
      where: {
        tenantId,
        submittedById: userId,
        createdAt: { gte: since },
      },
      select: { title: true, description: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  },

  async listOwn(
    tenantId: string,
    userId: string,
    opts: { skip: number; take: number },
  ) {
    const where = { tenantId, submittedById: userId }
    const [rows, total] = await Promise.all([
      prisma.featureSuggestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.featureSuggestion.count({ where }),
    ])
    return { rows, total }
  },

  async findOwnById(tenantId: string, userId: string, id: string) {
    return prisma.featureSuggestion.findFirst({
      where: { id, tenantId, submittedById: userId },
      include: {
        history: { orderBy: { createdAt: 'asc' } },
      },
    })
  },

  async findByIdAdmin(id: string) {
    return prisma.featureSuggestion.findUnique({
      where: { id },
      include: {
        tenant: { select: tenantSelect },
        submittedBy: { select: submitterSelect },
        history: { orderBy: { createdAt: 'asc' } },
      },
    })
  },

  buildAdminWhere(filters: AdminSuggestionFilters): Prisma.FeatureSuggestionWhereInput {
    const where: Prisma.FeatureSuggestionWhereInput = {}

    if (filters.status) where.status = filters.status
    if (filters.priority) where.priority = filters.priority
    if (filters.category) where.category = filters.category
    if (filters.tenant) {
      where.OR = [
        { tenantId: filters.tenant },
        { tenant: { name: { contains: filters.tenant, mode: 'insensitive' } } },
        { tenant: { slug: { contains: filters.tenant, mode: 'insensitive' } } },
      ]
    }
    if (filters.search) {
      const q = filters.search.trim()
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { category: { contains: q, mode: 'insensitive' } },
            { submittedBy: { name: { contains: q, mode: 'insensitive' } } },
            { submittedBy: { email: { contains: q, mode: 'insensitive' } } },
            { tenant: { name: { contains: q, mode: 'insensitive' } } },
            { tenant: { slug: { contains: q, mode: 'insensitive' } } },
          ],
        },
      ]
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom)
      if (filters.dateTo) {
        const end = new Date(filters.dateTo)
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999)
          where.createdAt.lte = end
        }
      }
    }
    return where
  },

  async listAdmin(filters: AdminSuggestionFilters) {
    const where = this.buildAdminWhere(filters)
    if (filters.cursor) {
      const cursorRow = await prisma.featureSuggestion.findUnique({
        where: { id: filters.cursor },
        select: { createdAt: true },
      })
      if (cursorRow) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          {
            OR: [
              { createdAt: { lt: cursorRow.createdAt } },
              { createdAt: cursorRow.createdAt, id: { lt: filters.cursor } },
            ],
          },
        ]
      }
    }

    const skip = filters.cursor ? 0 : (filters.page - 1) * filters.limit

    const [rows, total] = await Promise.all([
      prisma.featureSuggestion.findMany({
        where,
        include: {
          tenant: { select: tenantSelect },
          submittedBy: { select: submitterSelect },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: filters.limit,
      }),
      prisma.featureSuggestion.count({ where: filters.cursor ? this.buildAdminWhere({ ...filters, cursor: undefined }) : where }),
    ])

    return { rows, total }
  },

  async summary() {
    const [
      total,
      newCount,
      underReview,
      planned,
      inProgress,
      released,
      declined,
      highPriority,
      criticalPriority,
    ] = await Promise.all([
      prisma.featureSuggestion.count(),
      prisma.featureSuggestion.count({ where: { status: 'NEW' } }),
      prisma.featureSuggestion.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.featureSuggestion.count({ where: { status: 'PLANNED' } }),
      prisma.featureSuggestion.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.featureSuggestion.count({ where: { status: 'RELEASED' } }),
      prisma.featureSuggestion.count({ where: { status: 'DECLINED' } }),
      prisma.featureSuggestion.count({ where: { priority: 'HIGH' } }),
      prisma.featureSuggestion.count({ where: { priority: 'CRITICAL' } }),
    ])

    return {
      total,
      new: newCount,
      underReview,
      planned,
      inProgress,
      released,
      declined,
      highPriority,
      criticalPriority,
    }
  },

  async updateSuggestion(
    tx: Prisma.TransactionClient,
    id: string,
    data: {
      status?: FeatureSuggestionStatus
      priority?: FeatureSuggestionPriority
      publicResponse?: string | null
      internalNote?: string | null
      respondedByEmail?: string | null
      respondedAt?: Date | null
    },
  ) {
    return tx.featureSuggestion.update({
      where: { id },
      data,
      include: {
        tenant: { select: tenantSelect },
        submittedBy: { select: submitterSelect },
      },
    })
  },

  async listNotifications(
    tenantId: string,
    userId: string,
    opts: { skip: number; take: number; unreadOnly?: boolean },
  ) {
    const where = {
      tenantId,
      userId,
      ...(opts.unreadOnly ? { isRead: false } : {}),
    }
    const [rows, total, unreadCount] = await Promise.all([
      prisma.userNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.userNotification.count({ where }),
      prisma.userNotification.count({ where: { tenantId, userId, isRead: false } }),
    ])
    return { rows, total, unreadCount }
  },

  async markNotificationRead(tenantId: string, userId: string, id: string) {
    const existing = await prisma.userNotification.findFirst({
      where: { id, tenantId, userId },
    })
    if (!existing) return null
    if (existing.isRead) return existing
    return prisma.userNotification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })
  },

  async markAllNotificationsRead(tenantId: string, userId: string) {
    const result = await prisma.userNotification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    return result.count
  },

  async findRecentNewSuggestions(since: Date, take = 30) {
    return prisma.featureSuggestion.findMany({
      where: { status: 'NEW', createdAt: { gte: since } },
      include: {
        tenant: { select: { id: true, name: true } },
        submittedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    })
  },
}
