/**
 * Per-role module access for a tenant (Owner-managed).
 * Levels: hide | view | edit
 */

export const ROLE_ACCESS_LEVELS = ['hide', 'view', 'edit'] as const
export type RoleAccessLevel = (typeof ROLE_ACCESS_LEVELS)[number]

export const STAFF_ROLES = ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export const ROLE_PERMISSION_MODULES = [
  { key: 'DASHBOARD', label: 'Dashboard' },
  { key: 'POS', label: 'Point of Sale' },
  { key: 'CUSTOMERS', label: 'Customers' },
  { key: 'SERVICES', label: 'Services' },
  { key: 'INVENTORY', label: 'Inventory' },
  { key: 'PRODUCT_COST', label: 'Product Cost' },
  { key: 'PRODUCT_TRACEABILITY', label: 'Product Traceability' },
  { key: 'SUPPLIERS', label: 'Suppliers' },
  { key: 'IMEI', label: 'IMEI Tracker' },
  { key: 'REPAIRS', label: 'Repair Jobs' },
  { key: 'WARRANTY', label: 'Warranty' },
  { key: 'EXCHANGES', label: 'Device Exchange' },
  { key: 'FINANCE', label: 'Finance' },
  { key: 'PROFIT_ALLOCATION', label: 'Profit Allocation' },
  { key: 'DAILY_CLOSING', label: 'Daily Closing' },
  { key: 'ACCOUNTING', label: 'Accounting' },
  { key: 'HIRE_PURCHASE', label: 'Hire Purchase' },
  { key: 'WHOLESALE', label: 'Wholesale' },
  { key: 'WHOLESALE_POS', label: 'Wholesale POS' },
  { key: 'WHOLESALE_PRICING_ADMIN', label: 'Wholesale Pricing Admin' },
  { key: 'WHOLESALE_DEALERS', label: 'Wholesale Dealers' },
  { key: 'WHOLESALE_ORDERS', label: 'Wholesale Orders' },
  { key: 'WHOLESALE_WAREHOUSE', label: 'Wholesale Warehouse' },
  { key: 'WHOLESALE_DELIVERY', label: 'Wholesale Delivery' },
  { key: 'WHOLESALE_RETURNS', label: 'Wholesale Returns' },
  { key: 'WHOLESALE_COLLECTIONS', label: 'Wholesale Collections' },
  { key: 'WHOLESALE_REPORTS', label: 'Wholesale Reports' },
  { key: 'REP_VAN_SALES', label: 'Rep / Van Sales' },
  { key: 'REP_VAN_LOAD', label: 'Van Stock Load' },
  { key: 'REP_VAN_SELL', label: 'Van Sell' },
  { key: 'REP_VAN_COLLECT', label: 'Van Collect' },
  { key: 'REP_VAN_SETTLE', label: 'Van Settlement' },
  { key: 'REP_VAN_APPROVE', label: 'Van Approve' },
  { key: 'REP_VAN_REPORTS', label: 'Van Reports' },
  { key: 'REPORTS', label: 'Reports' },
  { key: 'STAFF', label: 'Staff & Roles' },
  { key: 'HR', label: 'HR' },
  { key: 'HR_SALARY', label: 'HR Salary' },
  { key: 'HR_PAYROLL', label: 'HR Payroll' },
  { key: 'DELIVERY', label: 'Delivery' },
  { key: 'WHATSAPP', label: 'WhatsApp' },
  { key: 'DAILY_RELOAD', label: 'Daily Reload' },
  { key: 'BRANCHES', label: 'Branches' },
  { key: 'SETTINGS', label: 'Settings' },
] as const

export type RolePermissionModuleKey = (typeof ROLE_PERMISSION_MODULES)[number]['key']

export type RolePermissionMatrix = Record<
  StaffRole,
  Record<RolePermissionModuleKey, RoleAccessLevel>
>

const MODULE_KEYS = ROLE_PERMISSION_MODULES.map((m) => m.key)

function fill(level: RoleAccessLevel): Record<RolePermissionModuleKey, RoleAccessLevel> {
  const row = {} as Record<RolePermissionModuleKey, RoleAccessLevel>
  for (const key of MODULE_KEYS) row[key] = level
  return row
}

/** Sensible defaults matching historical Staff matrix (Owner always full). */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMatrix = {
  OWNER: fill('edit'),
  MANAGER: {
    ...fill('edit'),
    STAFF: 'view',
    BRANCHES: 'hide',
    SETTINGS: 'view',
    PROFIT_ALLOCATION: 'view',
    ACCOUNTING: 'view',
    HIRE_PURCHASE: 'edit',
    WHOLESALE: 'edit',
    WHOLESALE_POS: 'edit',
    WHOLESALE_PRICING_ADMIN: 'edit',
    WHOLESALE_DEALERS: 'edit',
    WHOLESALE_ORDERS: 'edit',
    WHOLESALE_WAREHOUSE: 'edit',
    WHOLESALE_DELIVERY: 'edit',
    WHOLESALE_RETURNS: 'edit',
    WHOLESALE_COLLECTIONS: 'edit',
    WHOLESALE_REPORTS: 'edit',
    REP_VAN_SALES: 'edit',
    REP_VAN_LOAD: 'edit',
    REP_VAN_SELL: 'edit',
    REP_VAN_COLLECT: 'edit',
    REP_VAN_SETTLE: 'edit',
    REP_VAN_APPROVE: 'edit',
    REP_VAN_REPORTS: 'edit',
    PRODUCT_COST: 'view',
    HR_SALARY: 'view',
    HR_PAYROLL: 'view',
  },
  CASHIER: {
    ...fill('hide'),
    DASHBOARD: 'edit',
    POS: 'edit',
    CUSTOMERS: 'edit',
    SERVICES: 'view',
    WARRANTY: 'view',
    HIRE_PURCHASE: 'edit',
    WHOLESALE: 'view',
    WHOLESALE_POS: 'edit',
    WHOLESALE_DEALERS: 'view',
    WHOLESALE_ORDERS: 'view',
    WHOLESALE_COLLECTIONS: 'edit',
    REP_VAN_SALES: 'edit',
    REP_VAN_LOAD: 'view',
    REP_VAN_SELL: 'edit',
    REP_VAN_COLLECT: 'edit',
    REP_VAN_SETTLE: 'edit',
    REP_VAN_REPORTS: 'view',
    PRODUCT_COST: 'hide',
  },
  TECHNICIAN: {
    ...fill('hide'),
    DASHBOARD: 'edit',
    REPAIRS: 'edit',
    WARRANTY: 'edit',
    CUSTOMERS: 'view',
    INVENTORY: 'view',
    PRODUCT_COST: 'hide',
  },
}

function isLevel(v: unknown): v is RoleAccessLevel {
  return v === 'hide' || v === 'view' || v === 'edit'
}

export function normalizeRolePermissions(raw: unknown): RolePermissionMatrix {
  const out: RolePermissionMatrix = {
    OWNER: { ...DEFAULT_ROLE_PERMISSIONS.OWNER },
    MANAGER: { ...DEFAULT_ROLE_PERMISSIONS.MANAGER },
    CASHIER: { ...DEFAULT_ROLE_PERMISSIONS.CASHIER },
    TECHNICIAN: { ...DEFAULT_ROLE_PERMISSIONS.TECHNICIAN },
  }

  if (!raw || typeof raw !== 'object') {
    // Owner always full access
    out.OWNER = fill('edit')
    return out
  }

  const src = raw as Record<string, unknown>
  for (const role of STAFF_ROLES) {
    const roleSrc = src[role]
    if (!roleSrc || typeof roleSrc !== 'object') continue
    const row = roleSrc as Record<string, unknown>
    for (const key of MODULE_KEYS) {
      if (isLevel(row[key])) out[role][key] = row[key]
    }
  }

  // Owner cannot be locked out of the shop
  out.OWNER = fill('edit')
  return out
}

export function getAccessForRole(
  matrix: RolePermissionMatrix,
  role: string | undefined,
  moduleKey: RolePermissionModuleKey,
): RoleAccessLevel {
  if (!role) return 'hide'
  if (role === 'PLATFORM_ADMIN' || role === 'OWNER') return 'edit'
  const staffRole = STAFF_ROLES.includes(role as StaffRole) ? (role as StaffRole) : null
  if (!staffRole) return 'hide'
  return matrix[staffRole][moduleKey] ?? 'hide'
}

export function canViewModule(
  matrix: RolePermissionMatrix,
  role: string | undefined,
  moduleKey: RolePermissionModuleKey,
): boolean {
  const level = getAccessForRole(matrix, role, moduleKey)
  return level === 'view' || level === 'edit'
}

export function canEditModule(
  matrix: RolePermissionMatrix,
  role: string | undefined,
  moduleKey: RolePermissionModuleKey,
): boolean {
  return getAccessForRole(matrix, role, moduleKey) === 'edit'
}
