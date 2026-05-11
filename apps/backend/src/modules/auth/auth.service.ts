import bcrypt from 'bcryptjs'
import { prisma } from '../../config/database'
import { redis } from '../../config/redis'
import { signAccessToken, signRefreshToken, verifyToken } from '../../utils/jwt'
import { AppError } from '../../middleware/error.middleware'
import { env } from '../../config/env'
import { createOrGetGroup, createKcUser } from '../../utils/keycloakAdmin'

export const authService = {
  async login(email: string, password: string) {
    const user = await prisma.user.findFirst({
      where: { email, isActive: true },
      include: { branches: { select: { branchId: true } } },
    })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError('Invalid email or password', 401)
    }
    const payload = { userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } })
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        branchIds: user.branches.map((b: { branchId: string }) => b.branchId),
        avatar: user.avatar,
      },
    }
  },

  async registerTenant(data: {
    ownerName: string
    ownerEmail: string
    password: string
    shopName: string
    plan?: string
  }) {
    const existing = await prisma.user.findFirst({ where: { email: data.ownerEmail } })
    if (existing) throw new AppError('Email already in use', 409)

    const slug = data.shopName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const hashedPassword = await bcrypt.hash(data.password, 12)
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const tenant = await prisma.tenant.create({
      data: {
        name: data.shopName,
        slug,
        plan: (data.plan as any) || 'TRIAL',
        status: 'TRIAL',
        trialEndsAt,
        ownerEmail: data.ownerEmail,
        ownerName: data.ownerName,
        branches: {
          create: {
            name: data.shopName,
            address: '',
            city: '',
            state: '',
            phone: '',
            isHeadquarters: true,
            isActive: true,
          },
        },
      },
      include: { branches: true },
    })

    const branch = tenant.branches[0]
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: data.ownerEmail,
        name: data.ownerName,
        password: hashedPassword,
        role: 'OWNER',
        branches: { create: { branchId: branch.id } },
      },
    })

    const payload = { userId: user.id, tenantId: tenant.id, role: 'OWNER', email: user.email }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } })

    // KC sync (non-fatal)
    try {
      const groupId = await createOrGetGroup(slug, data.shopName)
      await createKcUser({
        dbUserId: user.id,
        tenantId: tenant.id,
        tenantSlug: slug,
        username: data.ownerEmail.split('@')[0],
        email: data.ownerEmail,
        name: data.ownerName,
        role: 'OWNER',
        password: data.password,
        groupId,
      })
    } catch (e) { console.warn('[KC] registerTenant sync failed:', (e as Error).message) }

    return { accessToken, refreshToken, tenant, user }
  },

  async refresh(refreshTokenStr: string) {
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshTokenStr }, include: { user: true } })
    if (!stored || stored.expiresAt < new Date()) throw new AppError('Invalid refresh token', 401)
    const payload = verifyToken(refreshTokenStr)
    const accessToken = signAccessToken(payload)
    return { accessToken }
  },

  async logout(accessToken: string, userId: string) {
    const ttl = 60 * 60
    await redis.set(`blacklist:${accessToken}`, '1', 'EX', ttl)
    await prisma.refreshToken.deleteMany({ where: { userId } })
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { branches: { select: { branchId: true } } },
    })
    if (!user) throw new AppError('User not found', 404)
    return user
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new AppError('User not found', 404)
    if (!(await bcrypt.compare(currentPassword, user.password))) throw new AppError('Current password incorrect', 400)
    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } })
  },

  // ── Keycloak proxy ──────────────────────────────────────────────────────────
  async kcLogin(username: string, password: string) {
    if (!env.KEYCLOAK_URL || !env.KC_CLIENT_ID) throw new AppError('Keycloak not configured', 503)
    const url = `${env.KEYCLOAK_URL}/realms/${env.KC_REALM}/protocol/openid-connect/token`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: env.KC_CLIENT_ID,
        client_secret: env.KC_CLIENT_SECRET ?? '',
        username,
        password,
        scope: 'openid profile email',
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new AppError((err as any).error_description ?? 'Invalid credentials', 401)
    }
    return res.json()
  },

  async kcRefresh(refreshToken: string) {
    if (!env.KEYCLOAK_URL || !env.KC_CLIENT_ID) throw new AppError('Keycloak not configured', 503)
    const url = `${env.KEYCLOAK_URL}/realms/${env.KC_REALM}/protocol/openid-connect/token`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.KC_CLIENT_ID,
        client_secret: env.KC_CLIENT_SECRET ?? '',
        refresh_token: refreshToken,
      }),
    })
    if (!res.ok) throw new AppError('Invalid or expired refresh token', 401)
    return res.json()
  },

  async kcLogout(refreshToken: string) {
    if (!env.KEYCLOAK_URL || !env.KC_CLIENT_ID) return
    const url = `${env.KEYCLOAK_URL}/realms/${env.KC_REALM}/protocol/openid-connect/logout`
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.KC_CLIENT_ID,
        client_secret: env.KC_CLIENT_SECRET ?? '',
        refresh_token: refreshToken,
      }),
    }).catch(() => {})
  },
}
