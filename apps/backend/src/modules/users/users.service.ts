import bcrypt from 'bcryptjs'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { Request } from 'express'
import { createOrGetGroup, ensureKcUser, updateKcUser, updateKcPassword, isKcConfigured } from '../../utils/keycloakAdmin'
import { effectiveBranchId } from '../../utils/active-branch'

// Roles a tenant admin (OWNER/MANAGER) is permitted to assign. PLATFORM_ADMIN is
// intentionally excluded so tenant users can never escalate to platform access.
const ASSIGNABLE_ROLES = ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']

export const usersService = {
  async list(tenantId: string, req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const role = req.query.role as string | undefined
    let branchId = (req.query.branchId as string | undefined) || effectiveBranchId(req) || undefined

    const actor = req.user
    let allowedBranchIds: string[] | null = null
    if (actor && actor.role !== 'OWNER' && actor.role !== 'PLATFORM_ADMIN') {
      const mine = await prisma.userBranch.findMany({
        where: { userId: actor.userId },
        select: { branchId: true },
      })
      allowedBranchIds = mine.map((b) => b.branchId)
      if (!allowedBranchIds.length) {
        return { data: [], total: 0, page, limit }
      }
      if (branchId && !allowedBranchIds.includes(branchId)) {
        throw new AppError('You cannot view staff for this branch', 403)
      }
      if (!branchId && allowedBranchIds.length === 1) {
        branchId = allowedBranchIds[0]
      }
    }

    const and: any[] = [{ tenantId }]
    if (role) and.push({ role: role as any })
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      })
    }
    if (branchId) {
      and.push({
        OR: [
          { branches: { some: { branchId } } },
          { role: 'OWNER' },
        ],
      })
    } else if (allowedBranchIds) {
      and.push({
        OR: [
          { branches: { some: { branchId: { in: allowedBranchIds } } } },
          { role: 'OWNER' },
        ],
      })
    }

    const where = { AND: and }
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { branches: { select: { branchId: true } } },
      }),
      prisma.user.count({ where }),
    ])
    return { data, total, page, limit }
  },

  async create(tenantId: string, body: { email: string; name: string; role: string; password: string; branchIds?: string[] }, actorRole?: string) {
    if (!ASSIGNABLE_ROLES.includes(body.role)) throw new AppError('Invalid role', 400)
    if (body.role === 'OWNER' && actorRole !== 'OWNER' && actorRole !== 'PLATFORM_ADMIN') {
      throw new AppError('Only an Owner can create another Owner account', 403)
    }
    const email = body.email.trim().toLowerCase()
    if (!body.password || body.password.length < 6) throw new AppError('Password must be at least 6 characters', 400)
    const branchIds = Array.isArray(body.branchIds) ? [...new Set(body.branchIds.filter(Boolean))] : []
    if (!branchIds.length) {
      throw new AppError('Assign at least one branch to this staff member', 400)
    }
    const validBranches = await prisma.branch.findMany({
      where: { tenantId, id: { in: branchIds }, isActive: true },
      select: { id: true },
    })
    if (validBranches.length !== branchIds.length) {
      throw new AppError('One or more selected branches are invalid', 400)
    }
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
        branches: { create: branchIds.map((id) => ({ branchId: id })) },
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

  async update(
    tenantId: string,
    id: string,
    body: Partial<{ name: string; email: string; role: string; isActive: boolean; branchIds: string[]; password: string }>,
    actorRole?: string,
  ) {
    if (body.role !== undefined && !ASSIGNABLE_ROLES.includes(body.role)) throw new AppError('Invalid role', 400)
    if (body.role === 'OWNER' && actorRole !== 'OWNER' && actorRole !== 'PLATFORM_ADMIN') {
      throw new AppError('Only an Owner can assign the Owner role', 403)
    }
    const user = await prisma.user.findFirst({ where: { id, tenantId } })
    if (!user) throw new AppError('User not found', 404)
    const actorIsOwnerOrPlatform = actorRole === 'OWNER' || actorRole === 'PLATFORM_ADMIN'
    if (user.role === 'OWNER' && !actorIsOwnerOrPlatform) {
      throw new AppError('Only an Owner can modify an Owner account', 403)
    }
    if (user.role === 'OWNER' && body.role && body.role !== 'OWNER' && !actorIsOwnerOrPlatform) {
      throw new AppError('Only an Owner can change another Owner\'s role', 403)
    }

    const { branchIds, password, name, email, role, isActive } = body
    if (password !== undefined) {
      if (!password || password.length < 6) throw new AppError('Password must be at least 6 characters', 400)
    }
    if (email !== undefined) {
      const nextEmail = email.trim().toLowerCase()
      if (!nextEmail) throw new AppError('Email is required', 400)
      const clash = await prisma.user.findFirst({
        where: {
          tenantId,
          id: { not: id },
          email: { equals: nextEmail, mode: 'insensitive' },
        },
      })
      if (clash) throw new AppError('Email already in use', 409)
    }

    if (branchIds !== undefined) {
      const nextIds = [...new Set(branchIds.filter(Boolean))]
      if (!nextIds.length) {
        throw new AppError('Assign at least one branch to this staff member', 400)
      }
      const validBranches = await prisma.branch.findMany({
        where: { tenantId, id: { in: nextIds }, isActive: true },
        select: { id: true },
      })
      if (validBranches.length !== nextIds.length) {
        throw new AppError('One or more selected branches are invalid', 400)
      }
      await prisma.userBranch.deleteMany({ where: { userId: id } })
      await prisma.userBranch.createMany({ data: nextIds.map((bid) => ({ userId: id, branchId: bid })) })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name.trim()
    if (email !== undefined) data.email = email.trim().toLowerCase()
    if (role !== undefined) data.role = role
    if (isActive !== undefined) data.isActive = isActive
    if (password) data.password = await bcrypt.hash(password, 12)

    const updated = await prisma.user.update({
      where: { id },
      data: data as any,
      include: { branches: { select: { branchId: true } } },
    })
    // KC sync (non-fatal)
    try {
      if (isKcConfigured()) {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
        await updateKcUser(id, {
          name: typeof data.name === 'string' ? data.name : undefined,
          role: typeof data.role === 'string' ? data.role : undefined,
          isActive: typeof data.isActive === 'boolean' ? data.isActive : undefined,
          tenantId,
          tenantSlug: tenant?.slug,
          email: typeof data.email === 'string' ? data.email : updated.email,
        })
        if (password) await updateKcPassword(id, password)
      }
    } catch (e) { console.warn('[KC] user update sync failed:', (e as Error).message) }
    const { password: _pw, ...safe } = updated as any
    return safe
  },

  async remove(tenantId: string, id: string, actorRole?: string) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } })
    if (!user) throw new AppError('User not found', 404)
    if (user.role === 'OWNER' && actorRole !== 'OWNER' && actorRole !== 'PLATFORM_ADMIN') {
      throw new AppError('Only an Owner can deactivate an Owner account', 403)
    }
    await prisma.user.update({ where: { id }, data: { isActive: false } })
    // Soft-disable on Keycloak to match DB (do not hard-delete auth identity)
    try {
      if (isKcConfigured()) {
        await updateKcUser(id, { isActive: false })
      }
    } catch (e) { console.warn('[KC] user deactivate sync failed:', (e as Error).message) }
  },
}
