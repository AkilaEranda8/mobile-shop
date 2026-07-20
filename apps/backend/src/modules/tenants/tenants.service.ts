import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getUserBranchIds } from '../../utils/active-branch'
import { INVOICE_TEMPLATE_OPTIONS } from './invoice-settings.util'
import {
  getAllTenantConfigs,
  getTenantConfig,
  listConfigDomains,
  setTenantConfig,
} from '../configuration-engine/configuration-engine.service'

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

  async getInvoiceSettings(tenantId: string, _branchId?: string) {
    return getTenantConfig(tenantId, 'invoice')
  },

  async updateInvoiceSettings(tenantId: string, patch: Record<string, unknown>) {
    return setTenantConfig(tenantId, 'invoice', patch)
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
