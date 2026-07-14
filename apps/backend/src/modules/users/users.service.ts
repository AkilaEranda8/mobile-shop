import bcrypt from 'bcryptjs'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { Request } from 'express'
import { createOrGetGroup, ensureKcUser, updateKcUser, isKcConfigured } from '../../utils/keycloakAdmin'

// Roles a tenant admin (OWNER/MANAGER) is permitted to assign. PLATFORM_ADMIN is
// intentionally excluded so tenant users can never escalate to platform access.
const ASSIGNABLE_ROLES = ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']

export const usersService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const role = req.query.role as string | undefined
    const branchId = req.query.branchId as string | undefined
    const where: any = {
      tenantId,
      ...(role ? { role: role as any } : {}),
      ...(branchId ? { branches: { some: { branchId } } } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] } : {}),
    }
    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, include: { branches: { select: { branchId: true } } } }),
      prisma.user.count({ where }),
    ])
    return { data, total, page, limit }
  },

  async create(tenantId: string, body: { email: string; name: string; role: string; password: string; branchIds?: string[] }) {
    if (!ASSIGNABLE_ROLES.includes(body.role)) throw new AppError('Invalid role', 400)
    const email = body.email.trim().toLowerCase()
    if (!body.password || body.password.length < 6) throw new AppError('Password must be at least 6 characters', 400)
    const existing = await prisma.user.findFirst({
      where: { tenantId, email: { equals: email, mode: 'insensitive' } },
    })
    if (existing) throw new AppError('Email already in use', 409)
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new AppError('Tenant not found', 404)

    const password = await bcrypt.hash(body.password, 12)
    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        name: body.name.trim(),
        role: body.role as any,
        password,
        branches: body.branchIds ? { create: body.branchIds.map((id) => ({ branchId: id })) } : undefined,
      },
      include: { branches: { select: { branchId: true } } },
    })

    // Always create the same account on Keycloak when auth server is configured
    if (isKcConfigured()) {
      try {
        const groupId = await createOrGetGroup(tenant.slug, tenant.name)
        await ensureKcUser({
          dbUserId: user.id,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          email,
          name: body.name.trim(),
          role: body.role,
          password: body.password,
          groupId: groupId || undefined,
          isActive: true,
        })
      } catch (e) {
        console.error('[KC] user create sync failed:', (e as Error).message)
        await prisma.userBranch.deleteMany({ where: { userId: user.id } }).catch(() => {})
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
        throw new AppError(
          'Failed to create user on the authentication server. Check Keycloak connectivity and try again.',
          503,
        )
      }
    }

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
    if (body.role !== undefined && !ASSIGNABLE_ROLES.includes(body.role)) throw new AppError('Invalid role', 400)
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
      if (isKcConfigured()) {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
        await updateKcUser(id, {
          name: rest.name,
          role: rest.role,
          isActive: rest.isActive,
          tenantId,
          tenantSlug: tenant?.slug,
          email: updated.email,
        })
      }
    } catch (e) { console.warn('[KC] user update sync failed:', (e as Error).message) }
    const { password: _pw, ...safe } = updated as any
    return safe
  },

  async remove(tenantId: string, id: string) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } })
    if (!user) throw new AppError('User not found', 404)
    await prisma.user.update({ where: { id }, data: { isActive: false } })
    // Soft-disable on Keycloak to match DB (do not hard-delete auth identity)
    try {
      if (isKcConfigured()) {
        await updateKcUser(id, { isActive: false })
      }
    } catch (e) { console.warn('[KC] user deactivate sync failed:', (e as Error).message) }
  },
}
