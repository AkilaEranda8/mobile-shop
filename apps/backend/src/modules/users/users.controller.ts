import { Request, Response, NextFunction } from 'express'
import { usersService } from './users.service'
import { sendSuccess, sendPaginated } from '../../utils/response'

export const usersController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { data, total, page, limit } = await usersService.list(req.tenantId!, req)
      sendPaginated(res, data, total, page, limit)
    } catch (e) { next(e) }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.create(req.tenantId!, req.body, req.user?.role)
      sendSuccess(res, user, 'User created', 201)
    } catch (e) { next(e) }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.getById(req.tenantId!, req.params.id)
      sendSuccess(res, user)
    } catch (e) { next(e) }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.update(req.tenantId!, req.params.id, req.body, req.user?.role)
      sendSuccess(res, user)
    } catch (e) { next(e) }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await usersService.remove(req.tenantId!, req.params.id)
      sendSuccess(res, null, 'User deactivated')
    } catch (e) { next(e) }
  },
}
