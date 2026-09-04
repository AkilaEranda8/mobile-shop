import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../../../middleware/validate.middleware'
import { AppError } from '../../../middleware/error.middleware'
import { requireModuleAccess } from '../../../middleware/module-access.middleware'
import { sendPaginated, sendSuccess } from '../../../utils/response'
import { getPagination } from '../../../utils/pagination'
import { effectiveBranchId } from '../../../utils/active-branch'
import { isFeatureEnabledForBranch } from '../../../utils/tenant-feature.util'
import { prisma } from '../../../config/database'
import {
  loadRolePermissionMatrix,
} from '../../../middleware/module-access.middleware'
import { canEditModule } from '../../tenants/role-permissions.util'
import {
  createVehicleSchema,
  updateVehicleSchema,
  createRepSchema,
  updateRepSchema,
  vanLoadSchema,
  vanSaleSchema,
  createSettlementSchema,
  upsertVisitSchema,
} from './van.schema'
import * as vanService from './van.service'

export const vanRouter = Router()

async function requireRepVanSales(req: Request, _res: Response, next: NextFunction) {
  try {
    const branchId = effectiveBranchId(req)
    if (!(await isFeatureEnabledForBranch(req.tenantId!, branchId, 'REP_VAN_SALES'))) {
      throw new AppError('Rep / Van Sales is not enabled for this tenant/branch', 403)
    }
    next()
  } catch (error) {
    next(error)
  }
}

vanRouter.use(requireRepVanSales)

vanRouter.get(
  '/vehicles',
  requireModuleAccess('REP_VAN_SALES', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await vanService.listVehicles(req.tenantId!, req.query.active === 'true'),
      )
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.post(
  '/vehicles',
  requireModuleAccess('REP_VAN_SALES', 'edit'),
  validate(createVehicleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await vanService.createVehicle(req.tenantId!, req.body),
        'Vehicle created',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.patch(
  '/vehicles/:id',
  requireModuleAccess('REP_VAN_SALES', 'edit'),
  validate(updateVehicleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await vanService.updateVehicle(req.tenantId!, req.params.id, req.body),
        'Vehicle updated',
      )
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.get(
  '/reps',
  requireModuleAccess('REP_VAN_SALES', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await vanService.listReps(req.tenantId!))
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.post(
  '/reps',
  requireModuleAccess('REP_VAN_SALES', 'edit'),
  validate(createRepSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await vanService.createRep(req.tenantId!, req.body), 'Rep created', 201)
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.patch(
  '/reps/:id',
  requireModuleAccess('REP_VAN_SALES', 'edit'),
  validate(updateRepSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await vanService.updateRep(req.tenantId!, req.params.id, req.body),
        'Rep updated',
      )
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.post(
  '/load',
  requireModuleAccess('REP_VAN_LOAD', 'edit'),
  validate(vanLoadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { name: true },
      })
      sendSuccess(
        res,
        await vanService.loadVan(req.tenantId!, req.body, {
          userId: user.userId,
          role: user.role || 'STAFF',
          performedBy: u?.name || user.email || user.userId,
        }),
        'Van loaded',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.post(
  '/sale',
  requireModuleAccess('REP_VAN_SELL', 'edit'),
  validate(vanSaleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body
      const hasOverride = body.lines.some((l: { unitPrice?: number | null }) => l.unitPrice != null)
      if (hasOverride) {
        const role = req.user?.role ?? ''
        if (role !== 'OWNER' && role !== 'PLATFORM_ADMIN') {
          const matrix =
            req.rolePermissionMatrix ?? (await loadRolePermissionMatrix(req.tenantId!))
          if (!canEditModule(matrix, role, 'WHOLESALE_PRICING_ADMIN')) {
            throw new AppError('Price override requires WHOLESALE_PRICING_ADMIN', 403)
          }
        }
      }
      const user = req.user!
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { name: true },
      })
      sendSuccess(
        res,
        await vanService.vanSale(req.tenantId!, body, {
          userId: user.userId,
          email: user.email,
          performedBy: u?.name || user.email || user.userId,
        }),
        'Van sale invoiced',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.get(
  '/settlements',
  requireModuleAccess('REP_VAN_SETTLE', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, page } = getPagination(req)
      const { data, total } = await vanService.listSettlements(req.tenantId!, {
        skip,
        limit,
        status: req.query.status as string | undefined,
        vehicleId: req.query.vehicleId as string | undefined,
      })
      sendPaginated(res, data, total, page, limit)
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.post(
  '/settlements',
  requireModuleAccess('REP_VAN_SETTLE', 'edit'),
  validate(createSettlementSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await vanService.createSettlement(req.tenantId!, req.body, req.user!.userId),
        'Settlement created',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.post(
  '/settlements/:id/submit',
  requireModuleAccess('REP_VAN_SETTLE', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await vanService.submitSettlement(req.tenantId!, req.params.id),
        'Settlement submitted',
      )
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.post(
  '/settlements/:id/approve',
  requireModuleAccess('REP_VAN_APPROVE', 'edit'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await vanService.approveSettlement(req.tenantId!, req.params.id, req.user?.email),
        'Settlement approved',
      )
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.get(
  '/visits',
  requireModuleAccess('REP_VAN_SALES', 'view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, page } = getPagination(req)
      const { data, total } = await vanService.listVisits(req.tenantId!, {
        skip,
        limit,
        repUserId: (req.query.repUserId as string) || req.user?.userId,
      })
      sendPaginated(res, data, total, page, limit)
    } catch (e) {
      next(e)
    }
  },
)

vanRouter.post(
  '/visits',
  requireModuleAccess('REP_VAN_SELL', 'edit'),
  validate(upsertVisitSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await vanService.upsertVisit(req.tenantId!, req.user!.userId, req.body),
        'Visit saved',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)
