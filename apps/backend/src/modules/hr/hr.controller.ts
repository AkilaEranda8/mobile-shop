import { Request, Response, NextFunction } from 'express'
import { sendSuccess } from '../../utils/response'
import { organizationService } from './organization.service'
import { employeesService } from './employees.service'

function actorEmail(req: Request) {
  return req.user?.email
}

export const hrController = {
  async overview(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await employeesService.overview(req.tenantId!, req))
    } catch (e) { next(e) }
  },

  async listDepartments(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await organizationService.listDepartments(req.tenantId!))
    } catch (e) { next(e) }
  },

  async createDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await organizationService.createDepartment(req.tenantId!, req.body, actorEmail(req)), 'Department created', 201)
    } catch (e) { next(e) }
  },

  async updateDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await organizationService.updateDepartment(req.tenantId!, req.params.id, req.body, actorEmail(req)))
    } catch (e) { next(e) }
  },

  async listDesignations(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await organizationService.listDesignations(req.tenantId!))
    } catch (e) { next(e) }
  },

  async createDesignation(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await organizationService.createDesignation(req.tenantId!, req.body, actorEmail(req)), 'Designation created', 201)
    } catch (e) { next(e) }
  },

  async updateDesignation(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await organizationService.updateDesignation(req.tenantId!, req.params.id, req.body, actorEmail(req)))
    } catch (e) { next(e) }
  },

  async listEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await employeesService.list(req.tenantId!, req))
    } catch (e) { next(e) }
  },

  async getEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await employeesService.getById(req.tenantId!, req.params.id, req))
    } catch (e) { next(e) }
  },

  async createEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await employeesService.create(req.tenantId!, req.body, req, actorEmail(req)), 'Employee created', 201)
    } catch (e) { next(e) }
  },

  async updateEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await employeesService.update(req.tenantId!, req.params.id, req.body, req, actorEmail(req)))
    } catch (e) { next(e) }
  },

  async linkUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.body.userId ?? null
      sendSuccess(res, await employeesService.linkUser(req.tenantId!, req.params.id, userId, req, actorEmail(req)))
    } catch (e) { next(e) }
  },
}
