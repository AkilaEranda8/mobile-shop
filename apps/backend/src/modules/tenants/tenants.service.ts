import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { normalizeReloadSettings } from '../daily-reload/reload-settings.util'
import { normalizeProductVariantSettings } from '../products/product-variant-settings.util'

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
    // Defensive allowlist — never trust arbitrary client fields onto the tenant row.
    const data: Record<string, unknown> = {}
    if (body.name   !== undefined) data.name   = body.name
    if (body.plan   !== undefined) data.plan   = body.plan
    if (body.status !== undefined) data.status = body.status
    return prisma.tenant.update({ where: { id }, data: data as any, include: { branches: true } })
  },

  async getInvoiceSettings(tenantId: string, _branchId?: string) {
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { invoiceSettings: true },
    })
    if (!t) throw new AppError('Tenant not found', 404)
    return (t.invoiceSettings ?? {}) as Record<string, unknown>
  },

  async updateInvoiceSettings(tenantId: string, settings: Record<string, unknown>) {
    const t = await prisma.tenant.update({
      where: { id: tenantId },
      data: { invoiceSettings: settings as any },
      select: { invoiceSettings: true },
    })
    return t.invoiceSettings
  },

  async getReloadSettings(tenantId: string) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { reloadSettings: true } })
    if (!t) throw new AppError('Tenant not found', 404)
    return normalizeReloadSettings(t.reloadSettings)
  },

  async updateReloadSettings(tenantId: string, settings: Record<string, unknown>) {
    const normalized = normalizeReloadSettings(settings)
    const t = await prisma.tenant.update({
      where: { id: tenantId },
      data: { reloadSettings: normalized as any },
      select: { reloadSettings: true },
    })
    return normalizeReloadSettings(t.reloadSettings)
  },

  async getProductVariantSettings(tenantId: string) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { productVariantSettings: true } })
    if (!t) throw new AppError('Tenant not found', 404)
    return normalizeProductVariantSettings(t.productVariantSettings)
  },

  async updateProductVariantSettings(tenantId: string, settings: Record<string, unknown>) {
    const normalized = normalizeProductVariantSettings(settings)
    const t = await prisma.tenant.update({
      where: { id: tenantId },
      data: { productVariantSettings: normalized as any },
      select: { productVariantSettings: true },
    })
    return normalizeProductVariantSettings(t.productVariantSettings)
  },

  // Branch CRUD
  async getBranches(tenantId: string) {
    return prisma.branch.findMany({ where: { tenantId } })
  },

  async createBranch(tenantId: string, body: { name: string; address: string; city: string; state: string; phone: string; email?: string; isHeadquarters?: boolean; isDefault?: boolean }) {
    return prisma.$transaction(async (tx) => {
      if (body.isHeadquarters) {
        await tx.branch.updateMany({ where: { tenantId, isHeadquarters: true }, data: { isHeadquarters: false } })
      }
      if (body.isDefault) {
        await tx.branch.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } })
      }
      return tx.branch.create({ data: { tenantId, ...body } })
    })
  },

  async updateBranch(tenantId: string, id: string, body: Partial<{ name: string; address: string; city: string; state: string; phone: string; email: string; isActive: boolean; isHeadquarters: boolean; isDefault: boolean }>) {
    const b = await prisma.branch.findFirst({ where: { id, tenantId } })
    if (!b) throw new AppError('Branch not found', 404)
    return prisma.$transaction(async (tx) => {
      if (body.isHeadquarters) {
        await tx.branch.updateMany({ where: { tenantId, isHeadquarters: true, id: { not: id } }, data: { isHeadquarters: false } })
      }
      if (body.isDefault) {
        await tx.branch.updateMany({ where: { tenantId, isDefault: true, id: { not: id } }, data: { isDefault: false } })
      }
      return tx.branch.update({ where: { id }, data: body })
    })
  },
}
