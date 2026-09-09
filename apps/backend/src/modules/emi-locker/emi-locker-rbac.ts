import type { Request } from 'express'
import { AppError } from '../../middleware/error.middleware'
import {
  canEditModule,
  canViewModule,
  DEFAULT_ROLE_PERMISSIONS,
  type RolePermissionModuleKey,
} from '../tenants/role-permissions.util'

/**
 * Spec action names mapped onto Hexalyte's existing hide|view|edit matrix.
 * Dangerous actions also require OWNER/MANAGER (enforced in routes via authorize).
 */
export type EmiLockerAction =
  | 'EMI_LOCKER_VIEW'
  | 'EMI_LOCKER_EDIT'
  | 'EMI_LOCKER_ENROLL'
  | 'EMI_LOCKER_RESTRICT'
  | 'EMI_LOCKER_RESTORE'
  | 'EMI_LOCKER_RELEASE'
  | 'EMI_LOCKER_SETTINGS'
  | 'EMI_LOCKER_REPORTS'

const MODULE: RolePermissionModuleKey = 'EMI_LOCKER'

export function assertEmiLockerAction(req: Request, action: EmiLockerAction) {
  const role = req.user?.role
  const matrix = req.rolePermissionMatrix ?? DEFAULT_ROLE_PERMISSIONS
  if (!role) throw new AppError('Unauthorized', 401)
  if (role === 'PLATFORM_ADMIN') return

  if (action === 'EMI_LOCKER_VIEW' || action === 'EMI_LOCKER_REPORTS') {
    if (!canViewModule(matrix, role, MODULE)) {
      throw new AppError('Insufficient permissions for EMI Locker view', 403)
    }
    return
  }

  if (!canEditModule(matrix, role, MODULE)) {
    throw new AppError(`Insufficient permissions for ${action}`, 403)
  }

  if (
    action === 'EMI_LOCKER_RESTRICT'
    || action === 'EMI_LOCKER_RESTORE'
    || action === 'EMI_LOCKER_RELEASE'
    || action === 'EMI_LOCKER_SETTINGS'
  ) {
    if (role !== 'OWNER' && role !== 'MANAGER') {
      throw new AppError(`Role ${role} cannot perform ${action}`, 403)
    }
  }
}
