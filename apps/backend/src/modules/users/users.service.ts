import bcrypt from 'bcryptjs'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { Request } from 'express'
import { createOrGetGroup, createKcUser, updateKcUser, deleteKcUser } from '../../utils/keycloakAdmin'

export const usersService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const role = req.query.role as string | undefined
    const where: any = {
      tenantId,
      ...(role ? { role: role as any } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] } : {}),
    }
    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, include: { branches: { select: { branchId: true } } } }),
      prisma.user.count({ where }),
    ])
    return { data, total, page, limit }
  },

  async create(tenantId: string, body: { email: string; name: string; role: string; password: string; branchIds?: string[] }) {
    const existing = await prisma.user.findFirst({ where: { tenantId, email: body.email } })
    if (existing) throw new AppError('Email already in use', 409)
    const password = await bcrypt.hash(body.password, 12)
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: body.email,
        name: body.name,
        role: body.role as any,
        password,
        branches: body.branchIds ? { create: body.branchIds.map((id) => ({ branchId: id })) } : undefined,
      },
      include: { branches: { select: { branchId: true } } },
    })
    // KC sync (non-fatal)
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
      if (tenant) {
        const groupId = await createOrGetGroup(tenant.slug, tenant.name)
        await createKcUser({
          dbUserId: user.id,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          username: body.email.split('@')[0],
          email: body.email,
          name: body.name,
          role: body.role,
          password: body.password,
          groupId,
        })
      }
    } catch (e) { console.warn('[KC] user create sync failed:', (e as Error).message) }
    const { password: _, ...safe } = user as any
    return safe
  },

  async getById(tenantId: string, id: string) {
    const user = await prisma.user.findFirst({ where: { id, tenantId }, include: { branches: { select: { branchId: true } } } })
    if (!user) throw new AppError('User not found', 404)
    const { password: _, ...safe } = user as any
    return safe
  },

  async update(tenantId: string, id: string, body: Partial<{ name: string; role: string; isActive: boolean; branchIds: string[] }>) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } })
    if (!user) throw new AppError('User not found', 404)
    const { branchIds, ...rest } = body
    if (branchIds) {
      await prisma.userBranch.deleteMany({ where: { userId: id } })
      await prisma.userBranch.createMany({ data: branchIds.map((bid) => ({ userId: id, branchId: bid })) })
    }
    const updated = await prisma.user.update({ where: { id }, data: rest as any, include: { branches: { select: { branchId: true } } } })
    // KC sync (non-fatal)
    try {
      await updateKcUser(id, { name: rest.name, role: rest.role, isActive: rest.isActive })
    } catch (e) { console.warn('[KC] user update sync failed:', (e as Error).message) }
    return updated
  },

  async remove(tenantId: string, id: string) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } })
    if (!user) throw new AppError('User not found', 404)
    await prisma.user.update({ where: { id }, data: { isActive: false } })
    // KC sync (non-fatal)
    try {
      await deleteKcUser(id)
    } catch (e) { console.warn('[KC] user remove sync failed:', (e as Error).message) }
  },
}
