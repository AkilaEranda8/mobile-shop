import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { normalizeReloadSettings } from '../daily-reload/reload-settings.util'

export const tenantsService = {
  async list() {
    return prisma.tenant.findMany({ include: { branches: true }, orderBy: { createdAt: 'desc' } })
  },

  async getById(id: string) {
    const t = await prisma.tenant.findUnique({ where: { id }, include: { branches: true } })
    if (!t) throw new AppError('Tenant not found', 404)
    return t
  },

  async update(id: string, body: Partial<{ name: string; plan: string; status: string }>) {
    return prisma.tenant.update({ where: { id }, data: body as any, include: { branches: true } })
  },

  async getInvoiceSettings(tenantId: string, branchId?: string) {
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        ownerEmail: true,
        invoiceSettings: true,
        branches: {
          where: { isActive: true },
          orderBy: [{ isHeadquarters: 'desc' }, { createdAt: 'asc' }],
        },
      },
    })
    if (!t) throw new AppError('Tenant not found', 404)

    const stored = (t.invoiceSettings ?? {}) as Record<string, unknown>
    const branch =
      (branchId ? t.branches.find(b => b.id === branchId) : undefined)
      ?? t.branches.find(b => b.isHeadquarters)
      ?? t.branches[0]
    const branchLine = branch
      ? [branch.address, branch.city, branch.state].filter(Boolean).join(', ')
      : ''

    const pick = (key: string, ...fallbacks: (string | null | undefined)[]) => {
      const v = stored[key]
      if (typeof v === 'string' && v.trim()) return v.trim()
      for (const fb of fallbacks) {
        if (typeof fb === 'string' && fb.trim()) return fb.trim()
      }
      return ''
    }

    return {
      ...stored,
      shopName: pick('shopName', t.name, branch?.name),
      email: pick('email', branch?.email ?? undefined, t.ownerEmail),
      phone: pick('phone', branch?.phone),
      address: pick('address', branchLine || undefined),
    }
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

  // Branch CRUD
  async getBranches(tenantId: string) {
    return prisma.branch.findMany({ where: { tenantId } })
  },

  async createBranch(tenantId: string, body: { name: string; address: string; city: string; state: string; phone: string; email?: string; isHeadquarters?: boolean }) {
    return prisma.branch.create({ data: { tenantId, ...body } })
  },

  async updateBranch(tenantId: string, id: string, body: Partial<{ name: string; address: string; city: string; state: string; phone: string; email: string; isActive: boolean }>) {
    const b = await prisma.branch.findFirst({ where: { id, tenantId } })
    if (!b) throw new AppError('Branch not found', 404)
    return prisma.branch.update({ where: { id }, data: body })
  },
}
