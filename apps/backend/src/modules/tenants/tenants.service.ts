import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'

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
