/**
 * Mirrors backend role-permissions.util — keep in sync.
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

export const ACCESS_LEVEL_META: Record<
  RoleAccessLevel,
  { label: string; short: string; className: string }
> = {
  hide: {
    label: 'Hide',
    short: 'H',
    className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
  view: {
    label: 'View',
    short: 'V',
    className: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30',
  },
  edit: {
    label: 'Edit',
    short: 'E',
    className: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  },
}

/** Paths that require Edit access (View-only users are redirected away). */
export const EDIT_ONLY_PATH_PREFIXES = [
  '/inventory/add-product',
  '/dashboard/inventory/add-product',
  '/dashboard/stock-transfer',
  '/dashboard/supplier-payments',
  '/dashboard/accounting/journals',
  '/dashboard/accounting/petty-cash',
  '/dashboard/accounting/payroll',
  '/dashboard/accounting/periods',
  '/dashboard/accounting/settings',
] as const

export function pathRequiresEdit(pathname: string): boolean {
  return EDIT_ONLY_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

/** Map a dashboard path to a permission module (null = always allowed). */
export function pathToPermissionModule(pathname: string): RolePermissionModuleKey | null {
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'DASHBOARD'
  if (
    pathname.startsWith('/dashboard/pos') ||
    pathname === '/pos' ||
    pathname.startsWith('/dashboard/sales') ||
    pathname === '/sales' ||
    pathname.startsWith('/sales/') ||
    pathname.startsWith('/dashboard/returns') ||
    pathname === '/returns' ||
    pathname.startsWith('/returns/')
  ) {
    return 'POS'
  }
  if (pathname.startsWith('/dashboard/customers') || pathname === '/customers' || pathname.startsWith('/customers/')) {
    return 'CUSTOMERS'
  }
  if (pathname.startsWith('/dashboard/services') || pathname === '/services' || pathname.startsWith('/services/')) {
    return 'SERVICES'
  }
  if (
    pathname.startsWith('/dashboard/product-traceability') ||
    pathname.startsWith('/dashboard/inventory/product-traceability') ||
    pathname.startsWith('/inventory/product-traceability')
  ) {
    return 'PRODUCT_TRACEABILITY'
  }
  if (
    pathname === '/inventory' ||
    pathname.startsWith('/inventory/') ||
    pathname.startsWith('/dashboard/inventory') ||
    pathname.startsWith('/dashboard/stock-transfer')
  ) {
    return 'INVENTORY'
  }
  if (
    pathname.startsWith('/dashboard/suppliers') ||
    pathname === '/suppliers' ||
    pathname.startsWith('/suppliers/') ||
    pathname.startsWith('/dashboard/supplier-payments') ||
    pathname.startsWith('/dashboard/purchase-orders') ||
    pathname === '/purchase-orders' ||
    pathname.startsWith('/purchase-orders/')
  ) {
    return 'SUPPLIERS'
  }
  if (pathname.startsWith('/dashboard/imei') || pathname === '/imei' || pathname.startsWith('/imei/')) return 'IMEI'
  if (pathname.startsWith('/dashboard/repairs') || pathname === '/repairs' || pathname.startsWith('/repairs/')) {
    return 'REPAIRS'
  }
  if (pathname.startsWith('/dashboard/warranty') || pathname === '/warranty' || pathname.startsWith('/warranty/')) {
    return 'WARRANTY'
  }
  if (pathname.startsWith('/dashboard/exchanges') || pathname === '/exchanges' || pathname.startsWith('/exchanges/')) {
    return 'EXCHANGES'
  }
  if (pathname.startsWith('/dashboard/profit-allocation')) return 'PROFIT_ALLOCATION'
  if (pathname.startsWith('/dashboard/daily-closing')) return 'DAILY_CLOSING'
  if (pathname.startsWith('/dashboard/accounting')) return 'ACCOUNTING'
  if (
    pathname.startsWith('/dashboard/finance') ||
    pathname === '/finance' ||
    pathname.startsWith('/finance/') ||
    pathname.startsWith('/dashboard/profit-loss') ||
    pathname.startsWith('/dashboard/expenses')
  ) {
    return 'FINANCE'
  }
  if (
    pathname.startsWith('/dashboard/reports') ||
    pathname === '/dashboard/category-report' ||
    pathname === '/dashboard/customer-report' ||
    pathname === '/dashboard/purchase-report' ||
    pathname === '/dashboard/payment-methods' ||
    pathname === '/dashboard/daily-reload-report'
  ) {
    return pathname === '/dashboard/daily-reload-report' ? 'DAILY_RELOAD' : 'REPORTS'
  }
  if (pathname.startsWith('/dashboard/staff') || pathname === '/staff' || pathname.startsWith('/staff/')) return 'STAFF'
  if (pathname.startsWith('/dashboard/role-permissions')) return 'STAFF'
  if (pathname.startsWith('/dashboard/delivery') || pathname === '/delivery' || pathname.startsWith('/delivery/')) {
    return 'DELIVERY'
  }
  if (pathname.startsWith('/dashboard/whatsapp') || pathname === '/whatsapp' || pathname.startsWith('/whatsapp/')) {
    return 'WHATSAPP'
  }
  if (pathname.startsWith('/dashboard/daily-reload') || pathname === '/daily-reload' || pathname.startsWith('/daily-reload/')) {
    return 'DAILY_RELOAD'
  }
  if (pathname.startsWith('/dashboard/branches') || pathname === '/branches' || pathname.startsWith('/branches/')) {
    return 'BRANCHES'
  }
  if (pathname.startsWith('/dashboard/settings') || pathname === '/settings' || pathname.startsWith('/settings/')) {
    return 'SETTINGS'
  }
  if (
    pathname.startsWith('/dashboard/analytics') ||
    pathname === '/analytics' ||
    pathname.startsWith('/analytics/')
  ) {
    return 'REPORTS'
  }
  if (
    pathname.startsWith('/business-services') ||
    pathname.startsWith('/dashboard/business-services')
  ) {
    return 'SETTINGS'
  }
  if (
    pathname.startsWith('/purchase-invoice') ||
    pathname.startsWith('/dashboard/purchase-invoice')
  ) {
    return 'SUPPLIERS'
  }
  return null
}
