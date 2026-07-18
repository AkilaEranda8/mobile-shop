import type { FeatureSuggestionStatus, FeatureSuggestionPriority } from '@prisma/client'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getClientIp, logPlatformActivity } from '../../utils/activity-log'
import type { Request } from 'express'
import {
  toAdminSuggestionDto,
  toNotificationDto,
  toUserSuggestionDto,
  statusLabel,
  priorityLabel,
} from './feature-suggestions.dto'
import { featureSuggestionsRepository as repo } from './feature-suggestions.repository'
import { normalizeForCompare } from './sanitize.util'
import {
  DUPLICATE_WINDOW_HOURS,
  MAX_PAGE_SIZE,
  MAX_SUGGESTIONS_PER_DAY,
  type AdminSuggestionFilters,
  type AdminUpdateSuggestionInput,
  type CreateSuggestionInput,
} from './feature-suggestions.types'

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000)
}

function clampLimit(limit?: number): number {
  return Math.min(MAX_PAGE_SIZE, Math.max(1, limit ?? 20))
}

export const featureSuggestionsService = {
  async create(tenantId: string, userId: string, input: CreateSuggestionInput, req?: Request) {
    const dayStart = startOfUtcDay()
    const todayCount = await repo.countTodayByUser(tenantId, userId, dayStart)
    if (todayCount >= MAX_SUGGESTIONS_PER_DAY) {
      throw new AppError(`You can submit at most ${MAX_SUGGESTIONS_PER_DAY} suggestions per day`, 429)
    }

    const recent = await repo.findRecentByUser(tenantId, userId, hoursAgo(DUPLICATE_WINDOW_HOURS))
    const titleKey = normalizeForCompare(input.title)
    const descKey = normalizeForCompare(input.description)
    const duplicate = recent.find(
      (r) => normalizeForCompare(r.title) === titleKey && normalizeForCompare(r.description) === descKey,
    )
    if (duplicate) {
      throw new AppError('You already submitted an identical suggestion in the last 24 hours', 409)
    }

    const created = await prisma.$transaction(async (tx) => {
      const suggestion = await repo.createSuggestion(tx, { tenantId, submittedById: userId, input })
      await repo.createHistory(tx, {
        suggestionId: suggestion.id,
        action: 'CREATED',
        newStatus: 'NEW',
        newPriority: 'MEDIUM',
        performedByEmail: req?.user?.email ?? 'user',
      })
      return suggestion
    })

    void logPlatformActivity({
      eventType: 'FEATURE_SUGGESTION_CREATED',
      severity: 'INFO',
      actorType: 'USER',
      actor: req?.user?.email ?? userId,
      target: created.title,
      details: `Category: ${created.category}`,
      ip: req ? getClientIp(req) : undefined,
      tenantId,
      userId,
    })

    return toUserSuggestionDto(created)
  },

  async listOwn(tenantId: string, userId: string, page = 1, limit = 20) {
    const take = clampLimit(limit)
    const skip = (Math.max(1, page) - 1) * take
    const { rows, total } = await repo.listOwn(tenantId, userId, { skip, take })
    return {
      data: rows.map((r) => toUserSuggestionDto(r)),
      total,
      page: Math.max(1, page),
      limit: take,
    }
  },

  async getOwn(tenantId: string, userId: string, id: string) {
    const row = await repo.findOwnById(tenantId, userId, id)
    if (!row) throw new AppError('Suggestion not found', 404)
    const { history, ...suggestion } = row
    return toUserSuggestionDto(suggestion, history)
  },

  async adminSummary() {
    return repo.summary()
  },

  async adminList(filters: AdminSuggestionFilters) {
    const limit = clampLimit(filters.limit)
    const page = Math.max(1, filters.page || 1)
    const { rows, total } = await repo.listAdmin({ ...filters, page, limit })
    return {
      data: rows.map((r) => toAdminSuggestionDto(r)),
      total,
      page,
      limit,
      nextCursor: rows.length === limit ? rows[rows.length - 1]?.id : null,
    }
  },

  async adminGet(id: string) {
    const row = await repo.findByIdAdmin(id)
    if (!row) throw new AppError('Suggestion not found', 404)
    const { history, ...suggestion } = row
    return toAdminSuggestionDto(suggestion, history)
  },

  async adminUpdate(
    id: string,
    input: AdminUpdateSuggestionInput,
    adminEmail: string,
    req?: Request,
  ) {
    const existing = await repo.findByIdAdmin(id)
    if (!existing) throw new AppError('Suggestion not found', 404)

    const statusChanging = input.status !== undefined && input.status !== existing.status
    const priorityChanging = input.priority !== undefined && input.priority !== existing.priority
    const responseChanging =
      input.publicResponse !== undefined && input.publicResponse !== existing.publicResponse
    const noteChanging =
      input.internalNote !== undefined && input.internalNote !== existing.internalNote

    if (!statusChanging && !priorityChanging && !responseChanging && !noteChanging) {
      return toAdminSuggestionDto(existing, existing.history)
    }

    const nextStatus = (input.status ?? existing.status) as FeatureSuggestionStatus
    const nextPriority = (input.priority ?? existing.priority) as FeatureSuggestionPriority
    const nextResponse =
      input.publicResponse !== undefined ? input.publicResponse : existing.publicResponse
    const nextNote =
      input.internalNote !== undefined ? input.internalNote : existing.internalNote

    const shouldNotifyUser = statusChanging || responseChanging

    const updated = await prisma.$transaction(async (tx) => {
      const suggestion = await repo.updateSuggestion(tx, id, {
        ...(statusChanging ? { status: nextStatus } : {}),
        ...(priorityChanging ? { priority: nextPriority } : {}),
        ...(responseChanging ? { publicResponse: nextResponse } : {}),
        ...(noteChanging ? { internalNote: nextNote } : {}),
        ...((statusChanging || responseChanging)
          ? { respondedByEmail: adminEmail, respondedAt: new Date() }
          : {}),
      })

      if (statusChanging) {
        const action =
          nextStatus === 'RELEASED'
            ? 'RELEASED'
            : nextStatus === 'DECLINED'
              ? 'DECLINED'
              : 'STATUS_CHANGED'
        await repo.createHistory(tx, {
          suggestionId: id,
          action,
          oldStatus: existing.status,
          newStatus: nextStatus,
          performedByEmail: adminEmail,
        })
      }

      if (priorityChanging) {
        await repo.createHistory(tx, {
          suggestionId: id,
          action: 'PRIORITY_CHANGED',
          oldPriority: existing.priority,
          newPriority: nextPriority,
          performedByEmail: adminEmail,
        })
      }

      if (responseChanging) {
        await repo.createHistory(tx, {
          suggestionId: id,
          action: 'RESPONSE_UPDATED',
          publicResponse: nextResponse,
          performedByEmail: adminEmail,
        })
      }

      if (noteChanging && !statusChanging && !priorityChanging && !responseChanging) {
        // No NOTE_UPDATED action in enum; record activity timestamp without exposing the note.
        await repo.createHistory(tx, {
          suggestionId: id,
          action: 'RESPONSE_UPDATED',
          publicResponse: existing.publicResponse,
          performedByEmail: adminEmail,
        })
      }

      if (shouldNotifyUser) {
        const parts: string[] = []
        if (statusChanging) parts.push(`Status is now ${statusLabel(nextStatus)}.`)
        if (responseChanging && nextResponse) parts.push(nextResponse)
        else if (responseChanging && !nextResponse && statusChanging) {
          /* status message already added */
        } else if (responseChanging && nextResponse === null) {
          parts.push('The admin response was cleared.')
        }

        await repo.createNotification(tx, {
          tenantId: existing.tenantId,
          userId: existing.submittedById,
          type: 'FEATURE_SUGGESTION',
          title: statusChanging
            ? `Suggestion update: ${statusLabel(nextStatus)}`
            : 'Admin response on your suggestion',
          message: parts.join(' ').trim() || `Your suggestion "${existing.title}" was updated.`,
          link: `/dashboard/feature-suggestions?id=${id}`,
          relatedId: id,
        })
      }

      return suggestion
    })

    void logPlatformActivity({
      eventType: 'FEATURE_SUGGESTION_UPDATED',
      severity: 'INFO',
      actorType: 'ADMIN',
      actor: adminEmail,
      target: existing.title,
      details: [
        statusChanging ? `status ${existing.status}→${nextStatus}` : null,
        priorityChanging ? `priority ${existing.priority}→${nextPriority}` : null,
        responseChanging ? 'publicResponse updated' : null,
        noteChanging ? 'internalNote updated' : null,
      ].filter(Boolean).join('; '),
      ip: req ? getClientIp(req) : undefined,
      tenantId: existing.tenantId,
      userId: existing.submittedById,
    })

    const withHistory = await repo.findByIdAdmin(id)
    return toAdminSuggestionDto(updated, withHistory?.history)
  },

  async listNotifications(tenantId: string, userId: string, page = 1, limit = 20, unreadOnly = false) {
    const take = clampLimit(limit)
    const skip = (Math.max(1, page) - 1) * take
    const { rows, total, unreadCount } = await repo.listNotifications(tenantId, userId, {
      skip,
      take,
      unreadOnly,
    })
    return {
      data: rows.map(toNotificationDto),
      total,
      unreadCount,
      page: Math.max(1, page),
      limit: take,
    }
  },

  async markNotificationRead(tenantId: string, userId: string, id: string) {
    const row = await repo.markNotificationRead(tenantId, userId, id)
    if (!row) throw new AppError('Notification not found', 404)
    return toNotificationDto(row)
  },

  async markAllNotificationsRead(tenantId: string, userId: string) {
    const count = await repo.markAllNotificationsRead(tenantId, userId)
    return { updated: count }
  },
}

export { priorityLabel }
