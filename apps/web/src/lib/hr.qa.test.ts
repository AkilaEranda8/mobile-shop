/**
 * HR frontend permission / path QA (no browser).
 * Run from apps/web: npx tsx --tsconfig tsconfig.json src/lib/hr.qa.test.ts
 * Or via: npx ts-node if configured. Prefer compiling through tsc imports.
 *
 * This file is imported by a small runner script.
 */
import {
  pathToPermissionModule,
  pathRequiresEdit,
  canViewModule,
  canEditModule,
  DEFAULT_ROLE_PERMISSIONS,
  normalizeRolePermissions,
} from './role-permissions'
import { isFeatureEnabled, OPT_IN_FEATURES } from './tenant-features'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert((OPT_IN_FEATURES as readonly string[]).includes('HR_PAYROLL'), 'HR_PAYROLL opt-in listed')
assert(isFeatureEnabled({}, 'HR_PAYROLL') === false, 'HR_PAYROLL default OFF')
assert(isFeatureEnabled({ HR_PAYROLL: true }, 'HR_PAYROLL') === true, 'HR_PAYROLL can enable')

assert(pathToPermissionModule('/dashboard/hr') === 'HR', 'hr overview → HR')
assert(pathToPermissionModule('/dashboard/hr/employees') === 'HR', 'employees → HR')
assert(pathToPermissionModule('/dashboard/hr/departments') === 'HR', 'departments → HR')
assert(pathToPermissionModule('/dashboard/hr/designations') === 'HR', 'designations → HR')
assert(pathToPermissionModule('/dashboard/hr/settings') === 'HR', 'settings → HR')
assert(pathToPermissionModule('/dashboard/hr/salary') === 'HR_SALARY', 'salary → HR_SALARY')
assert(pathToPermissionModule('/dashboard/hr/payroll') === 'HR_PAYROLL', 'payroll → HR_PAYROLL')
assert(pathToPermissionModule('/dashboard/staff') === 'STAFF', 'staff stays STAFF')

assert(pathRequiresEdit('/dashboard/hr/settings') === true, 'settings requires edit')
assert(pathRequiresEdit('/dashboard/hr/employees') === false, 'employees list not edit-only path')

const matrix = normalizeRolePermissions(null)
assert(canViewModule(matrix, 'OWNER', 'HR') === true, 'owner views HR')
assert(canEditModule(matrix, 'OWNER', 'HR') === true, 'owner edits HR')
assert(canViewModule(matrix, 'MANAGER', 'HR') === true, 'manager views HR (default edit fill)')
assert(canEditModule(matrix, 'MANAGER', 'HR') === true, 'manager edits HR')
assert(canEditModule(matrix, 'MANAGER', 'HR_PAYROLL') === false, 'manager HR_PAYROLL view-only default')
assert(canViewModule(matrix, 'CASHIER', 'HR') === false, 'cashier HR hidden by default')
assert(canViewModule(matrix, 'TECHNICIAN', 'HR') === false, 'tech HR hidden by default')
assert(DEFAULT_ROLE_PERMISSIONS.CASHIER.HR === 'hide', 'cashier default hide')

console.log('hr.qa.test.ts (web): all checks passed')
