import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { normalizeReloadSettings } from '../daily-reload/reload-settings.util'
import { normalizeProductVariantSettings } from '../products/product-variant-settings.util'
import {
  applyProductCodeSettings,
  normalizeProductCodeSettings,
} from '../products/product-code-settings.util'
import { peekProductCodes } from '../../utils/counters'
import { getUserBranchIds } from '../../utils/active-branch'
import {
  INVOICE_TEMPLATE_OPTIONS,
  normalizeInvoiceSettings,
} from './invoice-settings.util'

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
    // Defensive allowlist — never trust arbitrary client fields onto the tenant row.
    const data: Record<string, unknown> = {}
    if (body.name   !== undefined) data.name   = body.name
    if (body.plan   !== undefined) data.plan   = body.plan
    if (body.status !== undefined) data.status = body.status
    return prisma.tenant.update({ where: { id }, data: data as any, include: { branches: true } })
  },

  listInvoiceTemplates() {
    return INVOICE_TEMPLATE_OPTIONS
  },

  async getInvoiceSettings(tenantId: string, _branchId?: string) {
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { invoiceSettings: true, slug: true },
    })
    if (!t) throw new AppError('Tenant not found', 404)
    return normalizeInvoiceSettings(t.invoiceSettings, t.slug)
  },

  async updateInvoiceSettings(tenantId: string, patch: Record<string, unknown>) {
    const existing = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { invoiceSettings: true, slug: true },
    })
    if (!existing) throw new AppError('Tenant not found', 404)
    const prev =
      existing.invoiceSettings && typeof existing.invoiceSettings === 'object'
        ? (existing.invoiceSettings as Record<string, unknown>)
        : {}
    const patchBarcode =
      patch.barcodeLabel && typeof patch.barcodeLabel === 'object'
        ? (patch.barcodeLabel as Record<string, unknown>)
        : undefined
    const merged = {
      ...prev,
      ...patch,
      ...(patchBarcode
        ? {
            barcodeLabel: {
              ...(prev.barcodeLabel && typeof prev.barcodeLabel === 'object'
                ? (prev.barcodeLabel as Record<string, unknown>)
                : {}),
              ...patchBarcode,
            },
          }
        : {}),
    }
    const normalized = normalizeInvoiceSettings(merged, existing.slug)
    const t = await prisma.tenant.update({
      where: { id: tenantId },
      data: { invoiceSettings: normalized as any },
      select: { invoiceSettings: true, slug: true },
    })
    return normalizeInvoiceSettings(t.invoiceSettings, t.slug)
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

  async getProductCodeSettings(tenantId: string) {
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { productCodeSettings: true, slug: true },
    })
    if (!t) throw new AppError('Tenant not found', 404)
    const settings = normalizeProductCodeSettings(t.productCodeSettings)
    const peek = await peekProductCodes(tenantId, t.slug)
    return { ...settings, nextSku: peek.sku, nextBarcode: peek.barcode, prefix: peek.prefix }
  },

  async updateProductCodeSettings(tenantId: string, body: Record<string, unknown>) {
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    })
    if (!t) throw new AppError('Tenant not found', 404)
    const normalized = normalizeProductCodeSettings(body)
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { productCodeSettings: normalized as any },
    })
    await applyProductCodeSettings(tenantId, t.slug, normalized)
    return this.getProductCodeSettings(tenantId)
  },

  // Branch CRUD
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

  async updateBranch(
    tenantId: string,
    id: string,
    body: Partial<{ name: string; address: string; city: string; state: string; phone: string; email: string; isActive: boolean; isHeadquarters: boolean; isDefault: boolean }>,
    userId?: string,
    role?: string,
  ) {
    const b = await prisma.branch.findFirst({ where: { id, tenantId } })
    if (!b) throw new AppError('Branch not found', 404)
    if (role && userId && !OWNER_ROLES.has(role)) {
      const allowed = await getUserBranchIds(userId, tenantId, role)
      if (!allowed.includes(id)) throw new AppError('Branch access denied', 403)
    }
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
