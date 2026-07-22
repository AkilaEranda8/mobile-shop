import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database'
import { AppError } from './error.middleware'
import { sendError } from '../utils/response'
import {
  canEditModule,
  canViewModule,
  normalizeRolePermissions,
  type RolePermissionMatrix,
  type RolePermissionModuleKey,
} from '../modules/tenants/role-permissions.util'

declare global {
  namespace Express {
    interface Request {
      rolePermissionMatrix?: RolePermissionMatrix
    }
  }
}

const matrixCache = new Map<string, { at: number; matrix: RolePermissionMatrix }>()
const CACHE_TTL_MS = 30_000

export async function loadRolePermissionMatrix(tenantId: string): Promise<RolePermissionMatrix> {
  const hit = matrixCache.get(tenantId)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.matrix

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { rolePermissions: true },
  })
  const matrix = normalizeRolePermissions(tenant?.rolePermissions)
  matrixCache.set(tenantId, { at: Date.now(), matrix })
  return matrix
}

/** Call after Owner saves the matrix so API enforcement picks up immediately. */
export function invalidateRolePermissionCache(tenantId: string) {
  matrixCache.delete(tenantId)
}

export async function attachRolePermissionMatrix(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role === 'PLATFORM_ADMIN' || !req.tenantId) {
      next()
      return
    }
    req.rolePermissionMatrix = await loadRolePermissionMatrix(req.tenantId)
    next()
  } catch (e) {
    next(e)
  }
}

function assertModuleLevel(
  req: Request,
  moduleKey: RolePermissionModuleKey,
  level: 'view' | 'edit',
) {
  if (!req.user) throw new AppError('Unauthorized', 401)
  if (req.user.role === 'PLATFORM_ADMIN' || req.user.role === 'OWNER') return

  const matrix = req.rolePermissionMatrix
  if (!matrix) throw new AppError('Role permissions not loaded', 500)

  const ok =
    level === 'edit'
      ? canEditModule(matrix, req.user.role, moduleKey)
      : canViewModule(matrix, req.user.role, moduleKey)

  if (!ok) {
    throw new AppError(
      level === 'edit'
        ? `Forbidden: ${moduleKey} requires Edit permission`
        : `Forbidden: ${moduleKey} is hidden for your role`,
      403,
    )
  }
}

/** Explicit check for a single route (view or edit). */
export function requireModuleAccess(
  moduleKey: RolePermissionModuleKey,
  level: 'view' | 'edit' = 'view',
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.rolePermissionMatrix && req.tenantId && req.user?.role !== 'PLATFORM_ADMIN') {
        req.rolePermissionMatrix = await loadRolePermissionMatrix(req.tenantId)
      }
      assertModuleLevel(req, moduleKey, level)
      next()
    } catch (e) {
      if (e instanceof AppError) {
        sendError(res, e.message, e.statusCode)
        return
      }
      next(e)
    }
  }
}

/**
 * Mount-level gate: GET/HEAD/OPTIONS → view; mutating methods → edit.
 * Skip OPTIONS preflight.
 */
export function enforceModuleAccess(moduleKey: RolePermissionModuleKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.method === 'OPTIONS') {
        next()
        return
      }
      if (!req.rolePermissionMatrix && req.tenantId && req.user?.role !== 'PLATFORM_ADMIN') {
        req.rolePermissionMatrix = await loadRolePermissionMatrix(req.tenantId)
      }
      const level: 'view' | 'edit' =
        req.method === 'GET' || req.method === 'HEAD' ? 'view' : 'edit'
      assertModuleLevel(req, moduleKey, level)
      next()
    } catch (e) {
      if (e instanceof AppError) {
        sendError(res, e.message, e.statusCode)
        return
      }
      next(e)
    }
  }
}

/**
 * GET allowed if the user can view ANY of the modules; mutations require edit on `mutateModule`.
 * Used for shared catalogs (e.g. products readable via POS or Inventory).
 */
export function enforceModuleAccessReadAny(
  readModules: RolePermissionModuleKey[],
  mutateModule: RolePermissionModuleKey,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.method === 'OPTIONS') {
        next()
        return
      }
      if (!req.user) throw new AppError('Unauthorized', 401)
      if (req.user.role === 'PLATFORM_ADMIN' || req.user.role === 'OWNER') {
        next()
        return
      }
      if (!req.rolePermissionMatrix && req.tenantId) {
        req.rolePermissionMatrix = await loadRolePermissionMatrix(req.tenantId)
      }
      const matrix = req.rolePermissionMatrix
      if (!matrix) throw new AppError('Role permissions not loaded', 500)

      if (req.method === 'GET' || req.method === 'HEAD') {
        const ok = readModules.some((m) => canViewModule(matrix, req.user!.role, m))
        if (!ok) throw new AppError('Forbidden: insufficient module access', 403)
        next()
        return
      }

      assertModuleLevel(req, mutateModule, 'edit')
      next()
    } catch (e) {
      if (e instanceof AppError) {
        sendError(res, e.message, e.statusCode)
        return
      }
      next(e)
    }
  }
}
