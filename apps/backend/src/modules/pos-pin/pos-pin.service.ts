import bcrypt from 'bcryptjs'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getTenantConfig, setTenantConfig } from '../configuration-engine/configuration-engine.service'
import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'
import { ensureTenantAccess } from '../../utils/tenant-access'
import { getMaintenanceStatus } from '../../utils/platform-config'
import {
  isKcAuthEnabled,
  kcTokenExchangeForDbUser,
} from '../../utils/keycloakAdmin'
import { signAccessToken, signRefreshToken } from '../../utils/jwt'
import { getTenantBranches, getUserBranchIds, pickDefaultBranchId } from '../../utils/active-branch'
import { recordAuditEventSafe } from '../audit-engine/audit-engine.service'
import { normalizePosPinSettings, type PosPinSettings } from './pos-pin-settings.util'
import {
  assertPinLength,
  hashPin,
  normalizePinInput,
  pinDigest,
  verifyPinHash,
} from './pos-pin.crypto'
import {
  clearPinFail,
  getPinLockTtl,
  incrPinFail,
  isPinLocked,
  isPinRateLimited,
  setPinLock,
} from './pos-pin.lockout'

async function assertPosPinFeature(tenantId: string) {
  if (!(await isTenantFeatureEnabled(tenantId, 'POS_QUICK_PIN'))) {
    throw new AppError('POS Quick PIN is not enabled for this shop', 403)
  }
}

async function loadPosPinSettings(tenantId: string): Promise<PosPinSettings> {
  return getTenantConfig<PosPinSettings>(tenantId, 'posPin', { bypassCache: true })
}

async function buildUserSession(user: {
  id: string
  email: string
  name: string
  role: string
  tenantId: string
  avatar: string | null
  branches: Array<{ branchId: string }>
  pinMustChange?: boolean
}) {
  const branchIds = user.role === 'OWNER'
    ? (await getUserBranchIds(user.id, user.tenantId, user.role))
    : user.branches.map((b) => b.branchId)
  const tenantBranches = user.role !== 'PLATFORM_ADMIN'
    ? await getTenantBranches(user.tenantId)
    : []
  const assignedBranches = tenantBranches.filter(b => branchIds.includes(b.id))
  const suggestedBranchId = pickDefaultBranchId(tenantBranches, branchIds)
  const tenant = user.role !== 'PLATFORM_ADMIN'
    ? await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { slug: true } })
    : null
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    tenantSlug: tenant?.slug,
    branchIds,
    branches: assignedBranches,
    suggestedBranchId,
    avatar: user.avatar,
    pinMustChange: !!user.pinMustChange,
  }
}

async function issueLocalTokens(user: {
  id: string
  tenantId: string
  role: string
  email: string
}, opts?: { posPinAuth?: boolean }) {
  const payload = {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
    ...(opts?.posPinAuth ? { posPinAuth: true as const } : {}),
  }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)
  const days = user.role === 'PLATFORM_ADMIN' ? 30 : 7
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } })
  return { accessToken, refreshToken }
}

async function issueTokensForUser(user: {
  id: string
  tenantId: string
  role: string
  email: string
  name: string
  isActive: boolean
  avatar: string | null
  branches: Array<{ branchId: string }>
  pinMustChange: boolean
}) {
  if (user.role === 'PLATFORM_ADMIN') {
    throw new AppError('POS PIN is not available for platform admins', 403)
  }

  let tokens: { accessToken: string; refreshToken: string }
  if (isKcAuthEnabled()) {
    try {
      tokens = await kcTokenExchangeForDbUser(user.id)
    } catch (e) {
      // Production Keycloak may only have Standard Token Exchange (no requested_subject).
      // After Hexalyte verifies the PIN, issue a scoped app JWT (same trust gate as TE).
      console.warn(
        '[POS PIN] KC token exchange unavailable, using posPinAuth session:',
        (e as Error).message,
      )
      tokens = await issueLocalTokens(user, { posPinAuth: true })
    }
  } else {
    tokens = await issueLocalTokens(user)
  }

  const sessionUser = await buildUserSession(user)
  return { ...tokens, user: sessionUser }
}

async function resolveTenantIdFromSlug(tenantSlug: string): Promise<string> {
  const slug = tenantSlug.trim().toLowerCase()
  if (!slug) throw new AppError('Shop context required for PIN login', 400)
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } })
  if (!tenant) throw new AppError('Invalid PIN', 401)
  return tenant.id
}

async function registerFail(opts: {
  tenantId: string
  userId: string
  settings: PosPinSettings
  ip?: string
  actorEmail?: string
}) {
  const fails = await incrPinFail(opts.tenantId, opts.userId, opts.settings.lockoutSeconds)
  await prisma.user.update({
    where: { id: opts.userId },
    data: {
      pinFailedAttempts: fails,
      ...(fails >= opts.settings.maxFailedAttempts
        ? { pinLockedUntil: new Date(Date.now() + opts.settings.lockoutSeconds * 1000) }
        : {}),
    },
  })
  if (fails >= opts.settings.maxFailedAttempts) {
    await setPinLock(opts.tenantId, opts.userId, opts.settings.lockoutSeconds)
    await recordAuditEventSafe({
      tenantId: opts.tenantId,
      actor: { userId: opts.userId, email: opts.actorEmail },
      eventType: 'POS_PIN_LOCKOUT',
      entityType: 'PosPin',
      entityId: opts.userId,
      ip: opts.ip,
      afterJson: { attempts: fails, lockoutSeconds: opts.settings.lockoutSeconds },
    })
  }
  await recordAuditEventSafe({
    tenantId: opts.tenantId,
    actor: { userId: opts.userId, email: opts.actorEmail },
    eventType: 'POS_PIN_LOGIN_FAILED',
    entityType: 'PosPin',
    entityId: opts.userId,
    ip: opts.ip,
    afterJson: { attempts: fails },
  })
}

export const posPinService = {
  async getSettings(tenantId: string) {
    await assertPosPinFeature(tenantId)
    return loadPosPinSettings(tenantId)
  },

  async updateSettings(tenantId: string, patch: Record<string, unknown>) {
    await assertPosPinFeature(tenantId)
    return setTenantConfig(tenantId, 'posPin', patch)
  },

  async loginByPin(opts: { tenantSlug: string; pin: string; ip?: string }) {
    const tenantId = await resolveTenantIdFromSlug(opts.tenantSlug)
    await assertPosPinFeature(tenantId)
    await ensureTenantAccess(tenantId)

    const maintenance = await getMaintenanceStatus()
    if (maintenance.enabled) throw new AppError(maintenance.message, 503)

    const settings = await loadPosPinSettings(tenantId)
    if (!settings.enabled) throw new AppError('POS PIN login is disabled', 403)
    if (!settings.allowColdPinLogin) {
      throw new AppError('Cold PIN login is disabled — open POS with password first', 403)
    }

    if (await isPinRateLimited(tenantId, opts.ip || 'unknown')) {
      throw new AppError('Too many PIN attempts. Try again later.', 429)
    }

    const pin = normalizePinInput(opts.pin)
    assertPinLength(pin, settings.pinLength)
    const digest = pinDigest(tenantId, pin)

    const user = await prisma.user.findFirst({
      where: { tenantId, pinDigest: digest, pinEnabled: true, isActive: true },
      include: { branches: { select: { branchId: true } } },
    })

    // Generic failure — do not reveal whether digest matched
    if (!user || !user.pinHash) {
      await recordAuditEventSafe({
        tenantId,
        eventType: 'POS_PIN_LOGIN_FAILED',
        entityType: 'PosPin',
        entityId: 'unknown',
        ip: opts.ip,
        afterJson: { reason: 'no_match' },
      })
      throw new AppError('Invalid PIN', 401)
    }

    if (user.role === 'PLATFORM_ADMIN') throw new AppError('Invalid PIN', 401)

    if (await isPinLocked(tenantId, user.id) || (user.pinLockedUntil && user.pinLockedUntil > new Date())) {
      const ttl = await getPinLockTtl(tenantId, user.id)
      throw new AppError(
        ttl > 0 ? `PIN locked. Try again in ${Math.ceil(ttl / 60)} minute(s).` : 'PIN locked. Try again later.',
        401,
      )
    }

    const ok = await verifyPinHash(pin, user.pinHash)
    if (!ok) {
      await registerFail({
        tenantId,
        userId: user.id,
        settings,
        ip: opts.ip,
        actorEmail: user.email,
      })
      throw new AppError('Invalid PIN', 401)
    }

    await clearPinFail(tenantId, user.id)
    await prisma.user.update({
      where: { id: user.id },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    })

    const result = await issueTokensForUser(user)
    await recordAuditEventSafe({
      tenantId,
      actor: { userId: user.id, email: user.email },
      eventType: 'POS_PIN_LOGIN_SUCCESS',
      entityType: 'PosPin',
      entityId: user.id,
      ip: opts.ip,
    })
    return result
  },

  async switchByPin(opts: {
    tenantId: string
    currentUserId: string
    pin: string
    ip?: string
  }) {
    await assertPosPinFeature(opts.tenantId)
    await ensureTenantAccess(opts.tenantId)

    const settings = await loadPosPinSettings(opts.tenantId)
    if (!settings.enabled) throw new AppError('POS PIN login is disabled', 403)

    if (await isPinRateLimited(opts.tenantId, opts.ip || 'unknown')) {
      throw new AppError('Too many PIN attempts. Try again later.', 429)
    }

    const pin = normalizePinInput(opts.pin)
    assertPinLength(pin, settings.pinLength)
    const digest = pinDigest(opts.tenantId, pin)

    const user = await prisma.user.findFirst({
      where: {
        tenantId: opts.tenantId,
        pinDigest: digest,
        pinEnabled: true,
        isActive: true,
      },
      include: { branches: { select: { branchId: true } } },
    })
    if (!user?.pinHash) throw new AppError('Invalid PIN', 401)

    if (await isPinLocked(opts.tenantId, user.id) || (user.pinLockedUntil && user.pinLockedUntil > new Date())) {
      throw new AppError('PIN locked. Try again later.', 401)
    }

    const ok = await verifyPinHash(pin, user.pinHash)
    if (!ok) {
      await registerFail({
        tenantId: opts.tenantId,
        userId: user.id,
        settings,
        ip: opts.ip,
        actorEmail: user.email,
      })
      throw new AppError('Invalid PIN', 401)
    }

    await clearPinFail(opts.tenantId, user.id)
    await prisma.user.update({
      where: { id: user.id },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    })

    const result = await issueTokensForUser(user)
    await recordAuditEventSafe({
      tenantId: opts.tenantId,
      actor: { userId: opts.currentUserId },
      eventType: 'POS_PIN_SWITCH',
      entityType: 'PosPin',
      entityId: user.id,
      ip: opts.ip,
      beforeJson: { fromUserId: opts.currentUserId },
      afterJson: { toUserId: user.id },
    })
    return result
  },

  async unlockByPin(opts: {
    tenantId: string
    userId: string
    pin: string
    ip?: string
  }) {
    await assertPosPinFeature(opts.tenantId)
    const settings = await loadPosPinSettings(opts.tenantId)
    if (settings.requirePasswordAfterLock) {
      throw new AppError('Password required to unlock — use full sign-in', 403)
    }

    if (await isPinRateLimited(opts.tenantId, opts.ip || 'unknown')) {
      throw new AppError('Too many PIN attempts. Try again later.', 429)
    }

    const pin = normalizePinInput(opts.pin)
    assertPinLength(pin, settings.pinLength)

    const user = await prisma.user.findFirst({
      where: { id: opts.userId, tenantId: opts.tenantId, isActive: true, pinEnabled: true },
      select: {
        id: true,
        email: true,
        pinHash: true,
        pinDigest: true,
        pinLockedUntil: true,
      },
    })
    if (!user?.pinHash) throw new AppError('Invalid PIN', 401)

    if (await isPinLocked(opts.tenantId, user.id) || (user.pinLockedUntil && user.pinLockedUntil > new Date())) {
      throw new AppError('PIN locked. Try again later.', 401)
    }

    // Must be THIS user's PIN
    const digest = pinDigest(opts.tenantId, pin)
    if (user.pinDigest !== digest || !(await verifyPinHash(pin, user.pinHash))) {
      await registerFail({
        tenantId: opts.tenantId,
        userId: user.id,
        settings,
        ip: opts.ip,
        actorEmail: user.email,
      })
      throw new AppError('Invalid PIN', 401)
    }

    await clearPinFail(opts.tenantId, user.id)
    await recordAuditEventSafe({
      tenantId: opts.tenantId,
      actor: { userId: user.id, email: user.email },
      eventType: 'POS_PIN_UNLOCK',
      entityType: 'PosPin',
      entityId: user.id,
      ip: opts.ip,
    })
    return { unlocked: true, userId: user.id }
  },

  async setOwnPin(opts: {
    tenantId: string
    userId: string
    pin: string
    currentPin?: string
    currentPassword?: string
    ip?: string
  }) {
    await assertPosPinFeature(opts.tenantId)
    const settings = await loadPosPinSettings(opts.tenantId)
    const pin = normalizePinInput(opts.pin)
    assertPinLength(pin, settings.pinLength)

    const user = await prisma.user.findFirst({
      where: { id: opts.userId, tenantId: opts.tenantId, isActive: true },
    })
    if (!user) throw new AppError('User not found', 404)
    if (user.role === 'PLATFORM_ADMIN') throw new AppError('POS PIN is not available for platform admins', 403)

    if (user.pinEnabled && user.pinHash) {
      if (opts.currentPin) {
        const cur = normalizePinInput(opts.currentPin)
        if (!(await verifyPinHash(cur, user.pinHash))) {
          throw new AppError('Current PIN incorrect', 400)
        }
      } else if (opts.currentPassword) {
        if (!(await bcrypt.compare(opts.currentPassword, user.password))) {
          throw new AppError('Current password incorrect', 400)
        }
      } else {
        throw new AppError('currentPin or currentPassword required', 400)
      }
    } else if (opts.currentPassword) {
      if (!(await bcrypt.compare(opts.currentPassword, user.password))) {
        throw new AppError('Current password incorrect', 400)
      }
    } else {
      throw new AppError('Password required to set PIN for the first time', 400)
    }

    const digest = pinDigest(opts.tenantId, pin)
    const clash = await prisma.user.findFirst({
      where: {
        tenantId: opts.tenantId,
        pinDigest: digest,
        pinEnabled: true,
        NOT: { id: user.id },
      },
      select: { id: true },
    })
    if (clash) throw new AppError('This PIN is already used by another staff member', 409)

    const hashed = await hashPin(pin)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        pinDigest: digest,
        pinHash: hashed,
        pinEnabled: true,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        pinUpdatedAt: new Date(),
        pinMustChange: false,
      },
    })
    await clearPinFail(opts.tenantId, user.id)

    await recordAuditEventSafe({
      tenantId: opts.tenantId,
      actor: { userId: user.id, email: user.email },
      eventType: user.pinEnabled ? 'POS_PIN_CHANGED' : 'POS_PIN_ENABLED',
      entityType: 'PosPin',
      entityId: user.id,
      ip: opts.ip,
    })
    return { enabled: true }
  },

  async adminResetPin(opts: {
    tenantId: string
    actorUserId: string
    actorEmail: string
    targetUserId: string
    pin: string
    mustChange?: boolean
    ip?: string
  }) {
    await assertPosPinFeature(opts.tenantId)
    const settings = await loadPosPinSettings(opts.tenantId)
    const pin = normalizePinInput(opts.pin)
    assertPinLength(pin, settings.pinLength)

    const target = await prisma.user.findFirst({
      where: { id: opts.targetUserId, tenantId: opts.tenantId },
    })
    if (!target) throw new AppError('User not found', 404)
    if (target.role === 'PLATFORM_ADMIN') throw new AppError('Cannot set POS PIN for platform admin', 400)

    const digest = pinDigest(opts.tenantId, pin)
    const clash = await prisma.user.findFirst({
      where: {
        tenantId: opts.tenantId,
        pinDigest: digest,
        pinEnabled: true,
        NOT: { id: target.id },
      },
      select: { id: true },
    })
    if (clash) throw new AppError('This PIN is already used by another staff member', 409)

    const hashed = await hashPin(pin)
    await prisma.user.update({
      where: { id: target.id },
      data: {
        pinDigest: digest,
        pinHash: hashed,
        pinEnabled: true,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        pinUpdatedAt: new Date(),
        pinMustChange: opts.mustChange !== false,
      },
    })
    await clearPinFail(opts.tenantId, target.id)

    await recordAuditEventSafe({
      tenantId: opts.tenantId,
      actor: { userId: opts.actorUserId, email: opts.actorEmail },
      eventType: 'POS_PIN_RESET',
      entityType: 'PosPin',
      entityId: target.id,
      ip: opts.ip,
      afterJson: { mustChange: opts.mustChange !== false },
    })
    return { enabled: true, mustChange: opts.mustChange !== false }
  },

  async disablePin(opts: {
    tenantId: string
    actorUserId: string
    actorEmail: string
    targetUserId: string
    ip?: string
  }) {
    await assertPosPinFeature(opts.tenantId)
    const target = await prisma.user.findFirst({
      where: { id: opts.targetUserId, tenantId: opts.tenantId },
    })
    if (!target) throw new AppError('User not found', 404)

    await prisma.user.update({
      where: { id: target.id },
      data: {
        pinEnabled: false,
        pinHash: null,
        pinDigest: null,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        pinMustChange: false,
        pinUpdatedAt: new Date(),
      },
    })
    await clearPinFail(opts.tenantId, target.id)

    await recordAuditEventSafe({
      tenantId: opts.tenantId,
      actor: { userId: opts.actorUserId, email: opts.actorEmail },
      eventType: 'POS_PIN_DISABLED',
      entityType: 'PosPin',
      entityId: target.id,
      ip: opts.ip,
    })
    return { enabled: false }
  },

  async getPinStatusForUser(tenantId: string, userId: string) {
    const u = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        pinEnabled: true,
        pinMustChange: true,
        pinUpdatedAt: true,
        pinLockedUntil: true,
        pinFailedAttempts: true,
      },
    })
    if (!u) throw new AppError('User not found', 404)
    return {
      enabled: u.pinEnabled,
      mustChange: u.pinMustChange,
      updatedAt: u.pinUpdatedAt,
      lockedUntil: u.pinLockedUntil,
      failedAttempts: u.pinFailedAttempts,
    }
  },
}

// re-export for settings consumers
export { normalizePosPinSettings }
