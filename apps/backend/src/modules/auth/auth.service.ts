import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '../../config/database'
import { redis } from '../../config/redis'
import { signAccessToken, signRefreshToken, verifyToken } from '../../utils/jwt'
import { AppError } from '../../middleware/error.middleware'
import { env } from '../../config/env'
import { createOrGetGroup, createKcUser } from '../../utils/keycloakAdmin'
import { sendMail } from '../../utils/mailer'
import { getMaintenanceStatus } from '../../utils/platform-config'
import { ensureTenantAccess } from '../../utils/tenant-access'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Emails in DB may retain original casing; login always compares case-insensitively. */
function emailEquals(normalizedEmail: string) {
  return { equals: normalizedEmail, mode: 'insensitive' as const }
}

export const authService = {
  async login(email: string, password: string, tenantSlug?: string) {
    const normalizedEmail = normalizeEmail(email)
    const where: any = { email: emailEquals(normalizedEmail), isActive: true }
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
      if (!tenant) throw new AppError('Invalid email or password', 401)
      where.tenantId = tenant.id
    }
    const user = await prisma.user.findFirst({
      where,
      include: { branches: { select: { branchId: true } } },
    })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError('Invalid email or password', 401)
    }
    if (user.role !== 'PLATFORM_ADMIN') {
      await ensureTenantAccess(user.tenantId)
    }
    const maintenance = await getMaintenanceStatus()
    if (maintenance.enabled && user.role !== 'PLATFORM_ADMIN') {
      throw new AppError(maintenance.message, 503)
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
    phone?: string
    city?: string
  }) {
    const ownerEmail = normalizeEmail(data.ownerEmail)
    const existing = await prisma.user.findFirst({ where: { email: emailEquals(ownerEmail) } })
    if (existing) throw new AppError('Email already in use', 409)

    const baseSlug = data.shopName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '')
    const existing_slug = await prisma.tenant.findFirst({ where: { slug: baseSlug } })
    const slug = existing_slug ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug
    const subdomain = `${slug}.app.hexalyte.com`
    const hashedPassword = await bcrypt.hash(data.password, 12)
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const tenant = await prisma.tenant.create({
      data: {
        name: data.shopName,
        slug,
        plan: (data.plan as any) || 'TRIAL',
        status: 'TRIAL',
        trialEndsAt,
        ownerEmail,
        ownerName: data.ownerName,
        branches: {
          create: {
            name: data.shopName,
            address: '',
            city: data.city?.trim() || '',
            state: '',
            phone: data.phone?.trim() || '',
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
        email: ownerEmail,
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
        username: ownerEmail.split('@')[0],
        email: ownerEmail,
        name: data.ownerName,
        role: 'OWNER',
        password: data.password,
        groupId,
      })
      console.log(`[KC] User created for tenant ${slug}`)
    } catch (e) { console.warn('[KC] registerTenant sync failed (non-fatal):', (e as Error).message) }

    return {
      accessToken,
      refreshToken,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        trialEndsAt: tenant.trialEndsAt,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: tenant.id,
        branchIds: [branch.id],
        avatar: user.avatar,
      },
      subdomain,
    }
  },

  async refresh(refreshTokenStr: string) {
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshTokenStr }, include: { user: true } })
    if (!stored || stored.expiresAt < new Date()) throw new AppError('Invalid refresh token', 401)
    if (!stored.user.isActive) throw new AppError('Account is inactive', 403)
    if (stored.user.role !== 'PLATFORM_ADMIN') {
      await ensureTenantAccess(stored.user.tenantId)
    }
    const { iat: _iat, exp: _exp, ...payload } = verifyToken(refreshTokenStr) as any
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
    const { password: _pw, ...safe } = user as any
    return safe
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new AppError('User not found', 404)
    if (!(await bcrypt.compare(currentPassword, user.password))) throw new AppError('Current password incorrect', 400)
    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } })
  },

  // ── Forgot / Reset Password ─────────────────────────────────────────────────
  async forgotPassword(email: string) {
    const normalizedEmail = normalizeEmail(email)
    const user = await prisma.user.findFirst({ where: { email: emailEquals(normalizedEmail), isActive: true } })
    // Always respond OK to prevent email enumeration
    if (!user) return

    const token = crypto.randomBytes(32).toString('hex')
    await redis.set(`pwd:reset:${token}`, user.id, 'EX', 900) // 15 min TTL

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } })
    const appBase = tenant?.slug
      ? `https://${tenant.slug}.app.hexalyte.com`
      : env.FRONTEND_URL

    const resetUrl = `${appBase}/reset-password?token=${token}`

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Reset your password</title>
<style>
body{margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;}
.wrap{max-width:580px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);}
.top{height:6px;background:linear-gradient(90deg,#6d28d9,#7c3aed,#0e7490);}
.header{background:linear-gradient(135deg,#1e1b4b,#312e81);padding:32px 36px 24px;text-align:center;}
.header h1{margin:0;color:#fff;font-size:20px;font-weight:700;}
.header p{margin:6px 0 0;color:#c4b5fd;font-size:13px;}
.body{padding:32px 36px;}
.body p{margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;}
.btn{display:inline-block;background:linear-gradient(135deg,#7c3aed,#0e7490);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:14px;font-weight:600;letter-spacing:.3px;}
.note{background:#f8f5ff;border:1px solid #ede9fe;border-radius:10px;padding:14px 18px;margin:20px 0 0;}
.note p{margin:0;font-size:12px;color:#7c3aed;}
.footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;text-align:center;}
.footer p{margin:0;font-size:11px;color:#94a3b8;}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"></div>
  <div class="header">
    <h1>Password Reset Request</h1>
    <p>${tenant?.name ?? 'Hexalyte'} · Account Security</p>
  </div>
  <div class="body">
    <p>Hi <strong>${user.name}</strong>,</p>
    <p>We received a request to reset the password for your account (<strong>${email}</strong>). Click the button below to set a new password. This link will expire in <strong>15 minutes</strong>.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </div>
    <div class="note">
      <p>⚠️ If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    </div>
    <p style="margin-top:20px;font-size:12px;color:#94a3b8;">Or copy this link into your browser:<br/><span style="color:#7c3aed;word-break:break-all;">${resetUrl}</span></p>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} ${tenant?.name ?? 'Hexalyte'} · Powered by Hexalyte Innovation</p>
  </div>
</div>
</body>
</html>`

    try {
      await sendMail(email, 'Reset your password', html)
    } catch (e) {
      console.warn('[Auth] SMTP not configured – reset link for', email, ':', resetUrl)
    }
  },

  async resetPassword(token: string, newPassword: string) {
    const userId = await redis.get(`pwd:reset:${token}`)
    if (!userId) throw new AppError('Invalid or expired reset link. Please request a new one.', 400)

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } })
    await redis.del(`pwd:reset:${token}`)

    // Also delete all existing refresh tokens so old sessions are invalidated
    await prisma.refreshToken.deleteMany({ where: { userId } })
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
