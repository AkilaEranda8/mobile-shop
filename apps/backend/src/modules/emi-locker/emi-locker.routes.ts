import { Router, type Request, type Response, type NextFunction } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { enforceModuleAccess, requireModuleAccess } from '../../middleware/module-access.middleware'
import { validate } from '../../middleware/validate.middleware'
import { AppError } from '../../middleware/error.middleware'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { effectiveBranchId, resolveMutationBranchId } from '../../utils/active-branch'
import { isFeatureEnabledForBranch } from '../../utils/tenant-feature.util'
import { emiLockerService } from './emi-locker.service'
import {
  createEnrollmentSchema,
  createPolicySchema,
  deviceActionSchema,
  listCommandsQuerySchema,
  listDevicesQuerySchema,
  registerManagedDeviceSchema,
  updateEmiLockerSettingsSchema,
  updateManagedDeviceSchema,
  updatePolicySchema,
} from './emi-locker.schema'
import { assertEmiLockerAction } from './emi-locker-rbac'

const router = Router()

async function requireFeature(req: Request, _res: Response, next: NextFunction) {
  try {
    const branchId = effectiveBranchId(req)
    if (!(await isFeatureEnabledForBranch(req.tenantId!, branchId, 'EMI_LOCKER'))) {
      throw new AppError('EMI Device Locker is not enabled for this tenant/branch', 403)
    }
    next()
  } catch (e) {
    next(e)
  }
}

function actor(req: Request) {
  return { userId: req.user?.userId, email: req.user?.email }
}

router.use(authenticate)
router.use(enforceModuleAccess('EMI_LOCKER'))
router.use(requireFeature)

router.get('/dashboard', requireModuleAccess('EMI_LOCKER', 'view'), async (req, res, next) => {
  try {
    const data = await emiLockerService.getDashboard(req.tenantId!, effectiveBranchId(req) ?? null)
    sendSuccess(res, data)
  } catch (e) {
    next(e)
  }
})

router.get(
  '/devices',
  requireModuleAccess('EMI_LOCKER', 'view'),
  validate(listDevicesQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const q = listDevicesQuerySchema.parse(req.query)
      const { rows, total } = await emiLockerService.listDevices(
        req.tenantId!,
        effectiveBranchId(req) ?? null,
        q,
      )
      sendPaginated(res, rows, total, q.page, q.limit)
    } catch (e) {
      next(e)
    }
  },
)

router.post(
  '/devices',
  requireModuleAccess('EMI_LOCKER', 'edit'),
  validate(registerManagedDeviceSchema),
  async (req, res, next) => {
    try {
      const branchId = await resolveMutationBranchId(req, {})
      const body = registerManagedDeviceSchema.parse(req.body)
      const result = await emiLockerService.registerDevice(
        req.tenantId!,
        branchId,
        body,
        actor(req),
        req.ip,
      )
      sendSuccess(res, result, 'Managed device registered', 201)
    } catch (e) {
      next(e)
    }
  },
)

router.get('/devices/:id', requireModuleAccess('EMI_LOCKER', 'view'), async (req, res, next) => {
  try {
    assertEmiLockerAction(req, 'EMI_LOCKER_VIEW')
    sendSuccess(res, await emiLockerService.getDevice(req.tenantId!, req.params.id))
  } catch (e) {
    next(e)
  }
})

router.patch(
  '/devices/:id',
  requireModuleAccess('EMI_LOCKER', 'edit'),
  validate(updateManagedDeviceSchema),
  async (req, res, next) => {
    try {
      assertEmiLockerAction(req, 'EMI_LOCKER_EDIT')
      const body = updateManagedDeviceSchema.parse(req.body)
      sendSuccess(
        res,
        await emiLockerService.updateDevice(req.tenantId!, req.params.id, body, actor(req), req.ip),
        'Device updated',
      )
    } catch (e) {
      next(e)
    }
  },
)

router.get(
  '/commands',
  requireModuleAccess('EMI_LOCKER', 'view'),
  validate(listCommandsQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      assertEmiLockerAction(req, 'EMI_LOCKER_VIEW')
      const q = listCommandsQuerySchema.parse(req.query)
      const { rows, total } = await emiLockerService.listCommands(
        req.tenantId!,
        effectiveBranchId(req) ?? null,
        q,
      )
      sendPaginated(res, rows, total, q.page, q.limit)
    } catch (e) {
      next(e)
    }
  },
)

router.get('/devices/:id/enrollment', requireModuleAccess('EMI_LOCKER', 'view'), async (req, res, next) => {
  try {
    // Tenant scope: unknown/cross-tenant device IDs must 404 (do not leak existence via empty 200)
    await emiLockerService.getDevice(req.tenantId!, req.params.id)
    const rows = await prisma.deviceEnrollment.findMany({
      where: { tenantId: req.tenantId!, deviceId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        enrollmentCode: true,
        status: true,
        expiresAt: true,
        consumedAt: true,
        failedAt: true,
        failureReason: true,
        createdAt: true,
        tokenPreview: true,
      },
    })
    sendSuccess(res, rows)
  } catch (e) {
    next(e)
  }
})

router.post(
  '/devices/:id/enrollment',
  requireModuleAccess('EMI_LOCKER', 'edit'),
  validate(createEnrollmentSchema),
  async (req, res, next) => {
    try {
      assertEmiLockerAction(req, 'EMI_LOCKER_ENROLL')
      const body = createEnrollmentSchema.parse(req.body)
      const result = await emiLockerService.createEnrollment(
        req.tenantId!,
        req.params.id,
        body,
        actor(req),
        req.ip,
      )
      sendSuccess(res, result, 'Enrollment QR generated', 201)
    } catch (e) {
      next(e)
    }
  },
)

router.post(
  '/devices/:id/sync',
  requireModuleAccess('EMI_LOCKER', 'edit'),
  async (req, res, next) => {
    try {
      sendSuccess(res, await emiLockerService.syncDevice(req.tenantId!, req.params.id, actor(req)))
    } catch (e) {
      next(e)
    }
  },
)

router.post(
  '/devices/:id/restrict',
  authorize('OWNER', 'MANAGER'),
  requireModuleAccess('EMI_LOCKER', 'edit'),
  validate(deviceActionSchema),
  async (req, res, next) => {
    try {
      assertEmiLockerAction(req, 'EMI_LOCKER_RESTRICT')
      const body = deviceActionSchema.parse(req.body)
      const result = await emiLockerService.requestRestrict(req.tenantId!, req.params.id, {
        reason: body.reason,
        idempotencyKey: body.idempotencyKey,
        actor: actor(req),
        ip: req.ip,
        force: true,
      })
      sendSuccess(res, result, 'Restriction command queued')
    } catch (e) {
      next(e)
    }
  },
)

router.post(
  '/devices/:id/restore',
  authorize('OWNER', 'MANAGER'),
  requireModuleAccess('EMI_LOCKER', 'edit'),
  validate(deviceActionSchema),
  async (req, res, next) => {
    try {
      assertEmiLockerAction(req, 'EMI_LOCKER_RESTORE')
      const body = deviceActionSchema.parse(req.body)
      const result = await emiLockerService.requestRestore(req.tenantId!, req.params.id, {
        reason: body.reason,
        idempotencyKey: body.idempotencyKey,
        actor: actor(req),
        ip: req.ip,
      })
      sendSuccess(res, result, 'Restore command queued')
    } catch (e) {
      next(e)
    }
  },
)

router.post(
  '/devices/:id/release',
  authorize('OWNER', 'MANAGER'),
  requireModuleAccess('EMI_LOCKER', 'edit'),
  validate(deviceActionSchema),
  async (req, res, next) => {
    try {
      assertEmiLockerAction(req, 'EMI_LOCKER_RELEASE')
      const body = deviceActionSchema.parse(req.body)
      const result = await emiLockerService.requestRelease(req.tenantId!, req.params.id, {
        reason: body.reason,
        idempotencyKey: body.idempotencyKey,
        actor: actor(req),
        ip: req.ip,
        force: true,
      })
      sendSuccess(res, result, 'Release command queued')
    } catch (e) {
      next(e)
    }
  },
)

router.get('/devices/:id/commands', requireModuleAccess('EMI_LOCKER', 'view'), async (req, res, next) => {
  try {
    const device = await emiLockerService.getDevice(req.tenantId!, req.params.id)
    sendSuccess(res, device.commands)
  } catch (e) {
    next(e)
  }
})

router.get('/devices/:id/events', requireModuleAccess('EMI_LOCKER', 'view'), async (req, res, next) => {
  try {
    const device = await emiLockerService.getDevice(req.tenantId!, req.params.id)
    sendSuccess(res, device.events)
  } catch (e) {
    next(e)
  }
})

router.get('/settings', requireModuleAccess('EMI_LOCKER', 'view'), async (req, res, next) => {
  try {
    const branchId = await resolveMutationBranchId(req, {})
    sendSuccess(res, await emiLockerService.getSettings(req.tenantId!, branchId))
  } catch (e) {
    next(e)
  }
})

router.patch(
  '/settings',
  authorize('OWNER', 'MANAGER'),
  requireModuleAccess('EMI_LOCKER', 'edit'),
  validate(updateEmiLockerSettingsSchema),
  async (req, res, next) => {
    try {
      assertEmiLockerAction(req, 'EMI_LOCKER_SETTINGS')
      const branchId = await resolveMutationBranchId(req, {})
      const body = updateEmiLockerSettingsSchema.parse(req.body)
      const data = {
        ...body,
        supportEmail: body.supportEmail === '' ? null : body.supportEmail,
      }
      sendSuccess(
        res,
        await emiLockerService.updateSettings(req.tenantId!, branchId, data, actor(req), req.ip),
      )
    } catch (e) {
      next(e)
    }
  },
)

router.get('/reports/devices', requireModuleAccess('EMI_LOCKER', 'view'), async (req, res, next) => {
  try {
    const { rows, total } = await emiLockerService.listDevices(req.tenantId!, effectiveBranchId(req) ?? null, {
      page: 1,
      limit: 100,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    })
    sendSuccess(res, { total, devices: rows })
  } catch (e) {
    next(e)
  }
})

router.get('/reports/overdue', requireModuleAccess('EMI_LOCKER', 'view'), async (req, res, next) => {
  try {
    const branchId = effectiveBranchId(req) ?? null
    const { rows } = await emiLockerService.listDevices(req.tenantId!, branchId, {
      page: 1,
      limit: 100,
      status: 'OVERDUE',
    })
    const restricted = await emiLockerService.listDevices(req.tenantId!, branchId, {
      page: 1,
      limit: 100,
      status: 'RESTRICTED',
    })
    sendSuccess(res, { overdue: rows, restricted: restricted.rows })
  } catch (e) {
    next(e)
  }
})

router.get('/reports/restrictions', requireModuleAccess('EMI_LOCKER', 'view'), async (req, res, next) => {
  try {
    const branchId = effectiveBranchId(req) ?? null
    const restricted = await emiLockerService.listDevices(req.tenantId!, branchId, {
      page: 1,
      limit: 100,
      status: 'RESTRICTED',
    })
    sendSuccess(res, { restricted: restricted.rows, total: restricted.total })
  } catch (e) {
    next(e)
  }
})

router.get('/reports/collections', requireModuleAccess('EMI_LOCKER', 'view'), async (req, res, next) => {
  try {
    // Collections remain HP financial truth — locker only surfaces dashboard finance aggregates
    const data = await emiLockerService.getDashboard(req.tenantId!, effectiveBranchId(req) ?? null)
    sendSuccess(res, {
      collectedAmount: data.collectedAmount,
      outstandingAmount: data.outstandingAmount,
      collectionPercentage: data.collectionPercentage,
      dueToday: data.dueToday,
      overdueAccounts: data.overdueAccounts,
    })
  } catch (e) {
    next(e)
  }
})

router.get('/policies', requireModuleAccess('EMI_LOCKER', 'view'), async (req, res, next) => {
  try {
    const rows = await prisma.devicePolicy.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    })
    sendSuccess(res, rows)
  } catch (e) {
    next(e)
  }
})

router.post(
  '/policies',
  authorize('OWNER', 'MANAGER'),
  requireModuleAccess('EMI_LOCKER', 'edit'),
  validate(createPolicySchema),
  async (req, res, next) => {
    try {
      const branchId = await resolveMutationBranchId(req, {})
      const body = createPolicySchema.parse(req.body)
      const row = await prisma.devicePolicy.create({
        data: {
          tenantId: req.tenantId!,
          branchId,
          name: body.name,
          kind: body.kind,
          amapiPolicyName: body.amapiPolicyName ?? null,
          policyJson: (body.policyJson ?? undefined) as Prisma.InputJsonValue | undefined,
          isDefault: body.isDefault ?? false,
          isActive: body.isActive ?? true,
        },
      })
      sendSuccess(res, row, 'Policy created', 201)
    } catch (e) {
      next(e)
    }
  },
)

router.patch(
  '/policies/:id',
  authorize('OWNER', 'MANAGER'),
  requireModuleAccess('EMI_LOCKER', 'edit'),
  validate(updatePolicySchema),
  async (req, res, next) => {
    try {
      const body = updatePolicySchema.parse(req.body)
      const existing = await prisma.devicePolicy.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      })
      if (!existing) throw new AppError('Policy not found', 404)
      const row = await prisma.devicePolicy.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.kind !== undefined ? { kind: body.kind } : {}),
          ...(body.amapiPolicyName !== undefined ? { amapiPolicyName: body.amapiPolicyName } : {}),
          ...(body.policyJson !== undefined
            ? { policyJson: body.policyJson as Prisma.InputJsonValue }
            : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      })
      sendSuccess(res, row, 'Policy updated')
    } catch (e) {
      next(e)
    }
  },
)

/** Internal enrollment consume — authenticated device/agent callback (Phase 3 may use AMAPI webhook instead). */
router.post('/enrollment/consume', requireModuleAccess('EMI_LOCKER', 'edit'), async (req, res, next) => {
  try {
    const enrollmentCode = String(req.body?.enrollmentCode || '')
    const token = String(req.body?.token || '')
    if (!enrollmentCode || !token) throw new AppError('enrollmentCode and token are required', 400)
    sendSuccess(
      res,
      await emiLockerService.consumeEnrollmentToken(req.tenantId!, enrollmentCode, token),
      'Device enrolled',
    )
  } catch (e) {
    next(e)
  }
})

export default router
