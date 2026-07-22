/**
 * Run: npx tsx src/modules/tenants/role-permissions.util.test.ts
 */
import {
  normalizeRolePermissions,
  DEFAULT_ROLE_PERMISSIONS,
  canViewModule,
  canEditModule,
  getAccessForRole,
} from './role-permissions.util'

const n = normalizeRolePermissions(null)
if (n.OWNER.POS !== 'edit') throw new Error('owner always edit')
if (n.CASHIER.POS !== 'edit') throw new Error('cashier default pos edit')
if (n.CASHIER.FINANCE !== 'hide') throw new Error('cashier finance hide')

const patched = normalizeRolePermissions({
  CASHIER: { POS: 'hide', FINANCE: 'view' },
  OWNER: { POS: 'hide' },
})
if (patched.OWNER.POS !== 'edit') throw new Error('owner cannot be locked')
if (patched.CASHIER.POS !== 'hide') throw new Error('cashier pos hide not applied')
if (patched.CASHIER.FINANCE !== 'view') throw new Error('cashier finance view')
if (patched.MANAGER.STAFF !== DEFAULT_ROLE_PERMISSIONS.MANAGER.STAFF) throw new Error('manager default kept')

if (!canViewModule(patched, 'MANAGER', 'POS')) throw new Error('manager can view pos')
if (canEditModule(patched, 'CASHIER', 'FINANCE')) throw new Error('cashier cannot edit finance')
if (getAccessForRole(patched, 'OWNER', 'STAFF') !== 'edit') throw new Error('owner staff edit')

console.log('role-permissions.util.test.ts: all checks passed')
