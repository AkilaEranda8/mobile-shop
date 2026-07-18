import type { Request, Response, NextFunction } from 'express'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { featureSuggestionsService } from './feature-suggestions.service'
import type {
  AdminUpdateSuggestionInput,
  CreateSuggestionInput,
} from './feature-suggestions.types'

export const featureSuggestionsController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await featureSuggestionsService.create(
        req.tenantId!,
        req.user!.userId,
        req.body as CreateSuggestionInput,
        req,
      )
      sendSuccess(res, data, 'Suggestion submitted', 201)
    } catch (e) { next(e) }
  },

  async listOwn(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
      const limit = parseInt(String(req.query.limit || '20'), 10) || 20
      const result = await featureSuggestionsService.listOwn(
        req.tenantId!,
        req.user!.userId,
        page,
        limit,
      )
      sendPaginated(res, result.data, result.total, result.page, result.limit)
    } catch (e) { next(e) }
  },

  async getOwn(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await featureSuggestionsService.getOwn(
        req.tenantId!,
        req.user!.userId,
        req.params.id,
      )
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async adminSummary(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await featureSuggestionsService.adminSummary()
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async adminList(req: Request, res: Response, next: NextFunction) {
    try {
      const q = req.query as Record<string, string | undefined>
      const result = await featureSuggestionsService.adminList({
        page: Math.max(1, parseInt(q.page || '1', 10) || 1),
        limit: parseInt(q.limit || '20', 10) || 20,
        cursor: q.cursor,
        search: q.search,
        status: q.status as never,
        priority: q.priority as never,
        category: q.category,
        tenant: q.tenant,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
      })
      sendSuccess(res, {
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        nextCursor: result.nextCursor,
      })
    } catch (e) { next(e) }
  },

  async adminGet(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await featureSuggestionsService.adminGet(req.params.id)
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },

  async adminUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await featureSuggestionsService.adminUpdate(
        req.params.id,
        req.body as AdminUpdateSuggestionInput,
        req.user?.email ?? 'admin',
        req,
      )
      sendSuccess(res, data, 'Suggestion updated')
    } catch (e) { next(e) }
  },

  async listNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
      const limit = parseInt(String(req.query.limit || '20'), 10) || 20
      const result = await featureSuggestionsService.listNotifications(
        req.tenantId!,
        req.user!.userId,
        page,
        limit,
        false,
      )
      sendSuccess(res, result)
    } catch (e) { next(e) }
  },

  async listUnreadNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
      const limit = parseInt(String(req.query.limit || '20'), 10) || 20
      const result = await featureSuggestionsService.listNotifications(
        req.tenantId!,
        req.user!.userId,
        page,
        limit,
        true,
      )
      sendSuccess(res, result)
    } catch (e) { next(e) }
  },

  async markNotificationRead(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await featureSuggestionsService.markNotificationRead(
        req.tenantId!,
        req.user!.userId,
        req.params.id,
      )
      sendSuccess(res, data, 'Notification marked as read')
    } catch (e) { next(e) }
  },

  async markAllNotificationsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await featureSuggestionsService.markAllNotificationsRead(
        req.tenantId!,
        req.user!.userId,
      )
      sendSuccess(res, data, 'All notifications marked as read')
    } catch (e) { next(e) }
  },
}
