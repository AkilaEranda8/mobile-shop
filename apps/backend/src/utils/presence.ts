import type { Request } from 'express'
import { redis } from '../config/redis'
import { prisma } from '../config/database'
import { getClientIp } from './activity-log'

const LAST_SEEN_ZSET = 'presence:last'
const userKey = (userId: string) => `presence:u:${userId}`
const throttleKey = (userId: string) => `presence:t:${userId}`

const WRITE_THROTTLE_SEC = 30
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** Users seen within this window count as online. */
export const ONLINE_WINDOW_MS = 3 * 60 * 1000
/** Seen within this window (but not online) count as idle. */
export const IDLE_WINDOW_MS = 30 * 60 * 1000

function areaFromPath(path: string): string {
  const clean = path.split('?')[0].replace(/^\/api\/v\d+\//, '').replace(/^\/+/, '')
  return clean.split('/')[0] || ''
}

/** Fire-and-forget heartbeat for tenant users; throttled per user. */
export function recordPresence(req: Request): void {
  const user = req.user
  if (!user?.userId || !user.tenantId || user.role === 'PLATFORM_ADMIN' || user.impersonation) return

  const now = Date.now()
  const userId = user.userId
  void (async () => {
    const acquired = await redis.set(throttleKey(userId), '1', 'EX', WRITE_THROTTLE_SEC, 'NX')
    if (!acquired) return
    const ua = String(req.headers['user-agent'] ?? '').slice(0, 300)
    await redis
      .multi()
      .zadd(LAST_SEEN_ZSET, now, userId)
      .hset(userKey(userId), {
        tenantId: user.tenantId,
        branchId: req.activeBranchId ?? '',
        role: user.role,
        ip: getClientIp(req),
        ua,
        area: areaFromPath(req.originalUrl || req.path),
        desktop: /Electron|HexalyteDesktop/i.test(ua) ? '1' : '0',
        lastSeen: String(now),
      })
      .pexpire(userKey(userId), RETENTION_MS)
      .exec()
  })().catch(() => { /* presence is best-effort */ })
}

type PresenceUser = {
  userId: string
  name: string
  email: string
  role: string
  branchName: string | null
  lastSeen: number
  state: 'online' | 'idle' | 'offline'
  area: string
  ip: string
  device: string
}

function deviceLabel(ua: string, desktop: boolean): string {
  if (desktop) return 'Desktop app'
  const os = /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/i.test(ua) ? 'iOS'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux' : ''
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : ''
  const mobile = /Mobile|Android|iPhone/i.test(ua) ? ' (mobile)' : ''
  return [browser, os].filter(Boolean).join(' · ') + mobile || 'Unknown'
}

type LoginRow = { tenantId: string; createdAt: Date; actor: string; target: string; ip: string; details: string }

function loginMethod(details: string): string {
  if (/cashier switch/i.test(details)) return 'PIN switch'
  if (/POS PIN/i.test(details)) return 'PIN'
  return 'Password'
}

function stateFor(lastSeen: number, now: number): PresenceUser['state'] {
  const age = now - lastSeen
  if (age <= ONLINE_WINDOW_MS) return 'online'
  if (age <= IDLE_WINDOW_MS) return 'idle'
  return 'offline'
}

/** Tenant-level live monitor: every tenant with last activity and currently active users. */
export async function getTenantPresence() {
  const now = Date.now()
  await redis.zremrangebyscore(LAST_SEEN_ZSET, 0, now - RETENTION_MS).catch(() => 0)
  const flat = await redis.zrangebyscore(LAST_SEEN_ZSET, now - RETENTION_MS, '+inf', 'WITHSCORES')

  const seen: { userId: string; lastSeen: number }[] = []
  for (let i = 0; i < flat.length; i += 2) seen.push({ userId: flat[i], lastSeen: Number(flat[i + 1]) })

  const hashes = seen.length
    ? await redis.pipeline(seen.map(s => ['hgetall', userKey(s.userId)])).exec()
    : []

  const userIds = seen.map(s => s.userId)
  const [users, tenants] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, role: true, tenantId: true },
        })
      : Promise.resolve([]),
    prisma.tenant.findMany({
      where: { slug: { notIn: ['hexalyte-billing-internal', 'hexalyte-platform-internal'] } },
      select: { id: true, name: true, slug: true, plan: true, status: true, trialEndsAt: true, createdAt: true },
    }),
  ])
  const userById = new Map(users.map(u => [u.id, u]))

  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000)
  const [lastLogins, loginCounts] = await Promise.all([
    prisma.$queryRaw<LoginRow[]>`
      SELECT DISTINCT ON ("tenantId") "tenantId", "createdAt", "actor", "target", "ip", "details"
      FROM "PlatformActivityLog"
      WHERE "eventType" = 'TENANT_LOGIN' AND "tenantId" IS NOT NULL
      ORDER BY "tenantId", "createdAt" DESC`,
    prisma.platformActivityLog.groupBy({
      by: ['tenantId'],
      where: { eventType: 'TENANT_LOGIN', tenantId: { not: null }, createdAt: { gte: since30d } },
      _count: { _all: true },
    }),
  ])
  const lastLoginByTenant = new Map(lastLogins.map(l => [l.tenantId, l]))
  const loginCountByTenant = new Map(loginCounts.map(c => [c.tenantId, c._count._all]))

  const branchIds = new Set<string>()
  const meta = seen.map((s, i) => {
    const h = ((hashes?.[i]?.[1] ?? {}) as Record<string, string>)
    if (h.branchId) branchIds.add(h.branchId)
    return { ...s, h }
  })
  const branches = branchIds.size
    ? await prisma.branch.findMany({ where: { id: { in: [...branchIds] } }, select: { id: true, name: true } })
    : []
  const branchById = new Map(branches.map(b => [b.id, b.name]))

  const byTenant = new Map<string, PresenceUser[]>()
  for (const m of meta) {
    const u = userById.get(m.userId)
    const tenantId = u?.tenantId ?? m.h.tenantId
    if (!tenantId) continue
    const list = byTenant.get(tenantId) ?? []
    list.push({
      userId: m.userId,
      name: u?.name ?? 'Unknown user',
      email: u?.email ?? '',
      role: u?.role ?? m.h.role ?? '',
      branchName: m.h.branchId ? branchById.get(m.h.branchId) ?? null : null,
      lastSeen: m.lastSeen,
      state: stateFor(m.lastSeen, now),
      area: m.h.area ?? '',
      ip: m.h.ip ?? '',
      device: deviceLabel(m.h.ua ?? '', m.h.desktop === '1'),
    })
    byTenant.set(tenantId, list)
  }

  const since24h = now - 24 * 60 * 60 * 1000

  const rows = tenants.map(t => {
    const list = (byTenant.get(t.id) ?? []).sort((a, b) => b.lastSeen - a.lastSeen)
    const login = lastLoginByTenant.get(t.id)
    const lastLoginAt = login ? login.createdAt.getTime() : null
    const lastSeen = Math.max(list[0]?.lastSeen ?? 0, lastLoginAt ?? 0) || null
    const onlineUsers = list.filter(u => u.state === 'online').length
    const idleUsers = list.filter(u => u.state === 'idle').length
    return {
      tenantId: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      status: t.status,
      trialEndsAt: t.trialEndsAt,
      createdAt: t.createdAt,
      state: onlineUsers > 0 ? 'online' : idleUsers > 0 ? 'idle' : 'offline',
      onlineUsers,
      idleUsers,
      lastSeen,
      lastLogin: login
        ? { at: lastLoginAt!, name: login.target, email: login.actor, ip: login.ip, method: loginMethod(login.details) }
        : null,
      logins30d: loginCountByTenant.get(t.id) ?? 0,
      users: list.filter(u => u.state !== 'offline'),
      recentUsers: list.slice(0, 10),
    }
  })

  const rank = { online: 0, idle: 1, offline: 2 } as const
  rows.sort((a, b) =>
    rank[a.state as keyof typeof rank] - rank[b.state as keyof typeof rank]
    || (b.lastSeen ?? 0) - (a.lastSeen ?? 0)
    || a.name.localeCompare(b.name))

  return {
    generatedAt: now,
    onlineWindowMinutes: ONLINE_WINDOW_MS / 60_000,
    summary: {
      totalTenants: rows.length,
      onlineTenants: rows.filter(r => r.state === 'online').length,
      idleTenants: rows.filter(r => r.state === 'idle').length,
      onlineUsers: rows.reduce((n, r) => n + r.onlineUsers, 0),
      active24hTenants: rows.filter(r => r.lastSeen != null && r.lastSeen >= since24h).length,
      neverSeenTenants: rows.filter(r => r.lastSeen == null).length,
    },
    tenants: rows,
  }
}

/** Per-tenant drill-down: every user with last login / last activity, plus recent login history. */
export async function getTenantLoginDetail(tenantId: string) {
  const now = Date.now()
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000)
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const userIds = users.map(u => u.id)
  const emails = users.map(u => u.email.toLowerCase())

  const [lastLogins, counts, history, scores] = await Promise.all([
    userIds.length
      ? prisma.$queryRaw<{ userId: string; createdAt: Date; ip: string; details: string }[]>`
          SELECT DISTINCT ON ("userId") "userId", "createdAt", "ip", "details"
          FROM "PlatformActivityLog"
          WHERE "eventType" = 'TENANT_LOGIN' AND "tenantId" = ${tenantId} AND "userId" IS NOT NULL
          ORDER BY "userId", "createdAt" DESC`
      : Promise.resolve([]),
    prisma.platformActivityLog.groupBy({
      by: ['userId'],
      where: { eventType: 'TENANT_LOGIN', tenantId, createdAt: { gte: since30d } },
      _count: { _all: true },
    }),
    prisma.platformActivityLog.findMany({
      where: {
        OR: [
          { tenantId, eventType: { in: ['TENANT_LOGIN', 'LOGOUT'] } },
          ...(emails.length ? [{ eventType: 'LOGIN_FAILED', actor: { in: emails } }] : []),
        ],
      },
      select: { id: true, eventType: true, actor: true, target: true, ip: true, details: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    userIds.length
      ? redis.pipeline(userIds.map(id => ['zscore', LAST_SEEN_ZSET, id])).exec().catch(() => null)
      : Promise.resolve(null),
  ])

  const loginByUser = new Map(lastLogins.map(l => [l.userId, l]))
  const countByUser = new Map(counts.map(c => [c.userId, c._count._all]))

  return {
    users: users.map((u, i) => {
      const login = loginByUser.get(u.id)
      const score = scores?.[i]?.[1]
      const lastActive = score != null ? Number(score) : null
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        lastLogin: login ? { at: login.createdAt.getTime(), ip: login.ip, method: loginMethod(login.details) } : null,
        logins30d: countByUser.get(u.id) ?? 0,
        lastActive,
        state: lastActive != null ? stateFor(lastActive, now) : 'offline',
      }
    }),
    history: history.map(h => ({
      id: h.id,
      at: h.createdAt.getTime(),
      type: h.eventType === 'TENANT_LOGIN' ? 'login' : h.eventType === 'LOGOUT' ? 'logout' : 'failed',
      email: h.actor,
      name: h.target,
      ip: h.ip,
      method: h.eventType === 'TENANT_LOGIN' ? loginMethod(h.details) : null,
      details: h.details,
    })),
  }
}
