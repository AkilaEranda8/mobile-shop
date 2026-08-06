import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getUserBranchIds } from '../../utils/active-branch'
import { INVOICE_TEMPLATE_OPTIONS, normalizeInvoiceSettings } from './invoice-settings.util'
import {
  getAllTenantConfigs,
  getTenantConfig,
  listConfigDomains,
  setTenantConfig,
} from '../configuration-engine/configuration-engine.service'
import { normalizeRolePermissions } from './role-permissions.util'
import { ensureBranchCashAccounts } from '../accounting/accounting-init.service'
import { invalidateRolePermissionCache } from '../../middleware/module-access.middleware'

const OWNER_ROLES = new Set(['OWNER', 'PLATFORM_ADMIN'])

export const tenantsService = {
  async list() {
    return prisma.tenant.findMany({ include: { branches: true }, orderBy: { createdAt: 'desc' } })
  },

  async getById(id: string) {
    const t = await prisma.tenant.findUnique({ where: { id }, include: { branches: true } })
    if (!t) throw new AppError('Tenant not found', 404)
    return t
  },

  async update(id: string, body: Partial<{ name: string; plan: string; status: string }> & Record<string, unknown>) {
    const data: Record<string, unknown> = {}
    if (body.name   !== undefined) data.name   = body.name
    if (body.plan   !== undefined) data.plan   = body.plan
    if (body.status !== undefined) data.status = body.status
    return prisma.tenant.update({ where: { id }, data: data as any, include: { branches: true } })
  },

  listInvoiceTemplates() {
    return INVOICE_TEMPLATE_OPTIONS
  },

  listConfigDomains() {
    return listConfigDomains()
  },

  async getAllSettings(tenantId: string) {
    return getAllTenantConfigs(tenantId)
  },

  async getInvoiceSettings(tenantId: string, branchId?: string) {
    const base = await getTenantConfig(tenantId, 'invoice') as Record<string, unknown>
    if (!branchId) return base

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { invoiceSettings: true, name: true, phone: true, email: true, address: true, city: true, state: true },
    })
    if (!branch) throw new AppError('Branch not found', 404)

    const override =
      branch.invoiceSettings && typeof branch.invoiceSettings === 'object'
        ? (branch.invoiceSettings as Record<string, unknown>)
        : null

    if (override) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } })
      return normalizeInvoiceSettings(
        {
          ...base,
          ...override,
          ...(override.barcodeLabel && typeof override.barcodeLabel === 'object'
            ? {
                barcodeLabel: {
                  ...(base.barcodeLabel && typeof base.barcodeLabel === 'object'
                    ? (base.barcodeLabel as Record<string, unknown>)
                    : {}),
                  ...(override.barcodeLabel as Record<string, unknown>),
                },
              }
            : {}),
        },
        tenant?.slug,
      )
    }

    // No branch override yet — fill empty identity from Branch profile
    const branchLine = [branch.address, branch.city, branch.state].filter(Boolean).join(', ')
    return {
      ...base,
      shopName: String(base.shopName ?? '').trim() || branch.name || '',
      phone: String(base.phone ?? '').trim() || branch.phone || '',
      email: String(base.email ?? '').trim() || branch.email || '',
      address: String(base.address ?? '').trim() || branchLine || '',
    }
  },

  async updateInvoiceSettings(tenantId: string, patch: Record<string, unknown>) {
    const branchId = typeof patch.branchId === 'string' && patch.branchId.trim()
      ? patch.branchId.trim()
      : undefined
    const { branchId: _omit, ...settingsPatch } = patch

    if (!branchId) {
      return setTenantConfig(tenantId, 'invoice', settingsPatch)
    }

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true, invoiceSettings: true },
    })
    if (!branch) throw new AppError('Branch not found', 404)

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, invoiceSettings: true } })
    if (!tenant) throw new AppError('Tenant not found', 404)

    const tenantBase = normalizeInvoiceSettings(tenant.invoiceSettings, tenant.slug) as unknown as Record<string, unknown>
    const prevBranch =
      branch.invoiceSettings && typeof branch.invoiceSettings === 'object'
        ? (branch.invoiceSettings as Record<string, unknown>)
        : {}

    // Start from effective settings (tenant + existing branch), then apply patch
    const mergedRaw = {
      ...tenantBase,
      ...prevBranch,
      ...settingsPatch,
      ...(settingsPatch.barcodeLabel && typeof settingsPatch.barcodeLabel === 'object'
        ? {
            barcodeLabel: {
              ...(tenantBase.barcodeLabel && typeof tenantBase.barcodeLabel === 'object'
                ? (tenantBase.barcodeLabel as Record<string, unknown>)
                : {}),
              ...(prevBranch.barcodeLabel && typeof prevBranch.barcodeLabel === 'object'
                ? (prevBranch.barcodeLabel as Record<string, unknown>)
                : {}),
              ...(settingsPatch.barcodeLabel as Record<string, unknown>),
            },
          }
        : {}),
    }
    const normalized = normalizeInvoiceSettings(mergedRaw, tenant.slug)

    await prisma.branch.update({
      where: { id: branch.id },
      data: { invoiceSettings: normalized as any },
    })

    return normalized
  },

  async getReloadSettings(tenantId: string) {
    return getTenantConfig(tenantId, 'reload')
  },

  async updateReloadSettings(tenantId: string, settings: Record<string, unknown>) {
    return setTenantConfig(tenantId, 'reload', settings)
  },

  async getPaymentMethodSettings(tenantId: string) {
    return getTenantConfig(tenantId, 'paymentMethod')
  },

  async updatePaymentMethodSettings(tenantId: string, settings: Record<string, unknown>) {
    return setTenantConfig(tenantId, 'paymentMethod', settings)
  },

  async getProductVariantSettings(tenantId: string) {
    return getTenantConfig(tenantId, 'productVariant')
  },

  async updateProductVariantSettings(tenantId: string, settings: Record<string, unknown>) {
    return setTenantConfig(tenantId, 'productVariant', settings)
  },

  async getProductCodeSettings(tenantId: string) {
    return getTenantConfig(tenantId, 'productCode')
  },

  async updateProductCodeSettings(tenantId: string, body: Record<string, unknown>) {
    return setTenantConfig(tenantId, 'productCode', body)
  },

  async getPosUiSettings(tenantId: string) {
    return getTenantConfig(tenantId, 'posUi')
  },

  async updatePosUiSettings(tenantId: string, body: Record<string, unknown>) {
    return setTenantConfig(tenantId, 'posUi', body)
  },

  async getRolePermissions(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { rolePermissions: true },
    })
    return normalizeRolePermissions(tenant?.rolePermissions)
  },

  async updateRolePermissions(tenantId: string, body: unknown) {
    const raw =
      body && typeof body === 'object' && 'rolePermissions' in (body as object)
        ? (body as { rolePermissions: unknown }).rolePermissions
        : body
    const normalized = normalizeRolePermissions(raw)
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { rolePermissions: normalized },
    })
    invalidateRolePermissionCache(tenantId)
    return normalized
  },

  async getBranches(tenantId: string, userId: string, role: string) {
    const where: { tenantId: string; id?: { in: string[] } } = { tenantId }
    if (!OWNER_ROLES.has(role)) {
      const ids = await getUserBranchIds(userId, tenantId, role)
      if (!ids.length) return []
      where.id = { in: ids }
    }
    return prisma.branch.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { isHeadquarters: 'desc' }, { name: 'asc' }],
    })
  },

  async createBranch(tenantId: string, body: { name: string; address: string; city: string; state: string; phone: string; email?: string; isHeadquarters?: boolean; isDefault?: boolean; dailyClosingEnabled?: boolean }) {
    // Prevent mass-assignment overwriting tenantId (or other unexpected fields).
    const {
      name,
      address,
      city,
      state,
      phone,
      email,
      isHeadquarters,
      isDefault,
      dailyClosingEnabled,
    } = body as any

    const branch = await prisma.$transaction(async (tx) => {
      if (isHeadquarters) {
        await tx.branch.updateMany({ where: { tenantId, isHeadquarters: true }, data: { isHeadquarters: false } })
      }
      if (isDefault) {
        await tx.branch.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } })
      }
      return tx.branch.create({
        data: {
          tenantId,
          name,
          address,
          city,
          state,
          phone,
          email,
          isHeadquarters,
          isDefault,
          dailyClosingEnabled,
        },
      })
    })
    try {
      await ensureBranchCashAccounts(tenantId, branch.id, branch.name)
    } catch (e) {
      console.error('[createBranch] accounting seed failed:', (e as Error).message)
    }
    return branch
  },

  async updateBranch(
    tenantId: string,
    id: string,
    body: Partial<{ name: string; address: string; city: string; state: string; phone: string; email: string; isActive: boolean; isHeadquarters: boolean; isDefault: boolean; dailyClosingEnabled: boolean }>,
    userId?: string,
    role?: string,
  ) {
    // Whitelist updatable fields to avoid overwriting tenantId or other sensitive columns.
    const {
      name,
      address,
      city,
      state,
      phone,
      email,
      isActive,
      isHeadquarters,
      isDefault,
      dailyClosingEnabled,
    } = body as any

    const safeUpdate: Partial<{
      name: string
      address: string
      city: string
      state: string
      phone: string
      email: string
      isActive: boolean
      isHeadquarters: boolean
      isDefault: boolean
      dailyClosingEnabled: boolean
    }> = {
      name,
      address,
      city,
      state,
      phone,
      email,
      isActive,
      isHeadquarters,
      isDefault,
      dailyClosingEnabled,
    }

    const b = await prisma.branch.findFirst({ where: { id, tenantId } })
    if (!b) throw new AppError('Branch not found', 404)
    if (role && userId && !OWNER_ROLES.has(role)) {
      const allowed = await getUserBranchIds(userId, tenantId, role)
      if (!allowed.includes(id)) throw new AppError('Branch access denied', 403)
    }
    return prisma.$transaction(async (tx) => {
      if (isHeadquarters) {
        await tx.branch.updateMany({ where: { tenantId, isHeadquarters: true, id: { not: id } }, data: { isHeadquarters: false } })
      }
      if (isDefault) {
        await tx.branch.updateMany({ where: { tenantId, isDefault: true, id: { not: id } }, data: { isDefault: false } })
      }
      return tx.branch.update({ where: { id }, data: safeUpdate })
    })
  },
}
