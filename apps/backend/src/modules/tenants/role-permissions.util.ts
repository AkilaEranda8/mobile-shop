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
  { key: 'REPORTS', label: 'Reports' },
  { key: 'STAFF', label: 'Staff & Roles' },
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
    PRODUCT_COST: 'view',
  },
  CASHIER: {
    ...fill('hide'),
    DASHBOARD: 'edit',
    POS: 'edit',
    CUSTOMERS: 'edit',
    SERVICES: 'view',
    WARRANTY: 'view',
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
