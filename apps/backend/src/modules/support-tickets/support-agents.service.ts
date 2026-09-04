import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { supportSseHub } from './support-sse'

/** Consider agent offline if no heartbeat for this long while isOnline=true */
const STALE_MS = 90_000

function effectiveOnline(isOnline: boolean, lastSeenAt: Date, now = new Date()) {
  if (!isOnline) return false
  return now.getTime() - lastSeenAt.getTime() <= STALE_MS
}

function mapAgent(row: {
  adminUserId: string
  email: string
  displayName: string
  title: string
  visibleOnTeam: boolean
  isOnline: boolean
  lastSeenAt: Date
}) {
  const online = effectiveOnline(row.isOnline, row.lastSeenAt)
  return {
    id: row.adminUserId,
    email: row.email,
    name: row.displayName,
    title: row.title,
    visibleOnTeam: row.visibleOnTeam,
    isOnline: online,
    lastSeenAt: row.lastSeenAt,
  }
}

async function ensurePresenceForAdmins() {
  const admins = await prisma.user.findMany({
    where: { role: 'PLATFORM_ADMIN', isActive: true },
    select: { id: true, email: true, name: true },
  })
  for (const a of admins) {
    await prisma.supportAgentPresence.upsert({
      where: { adminUserId: a.id },
      create: {
        adminUserId: a.id,
        email: a.email,
        displayName: a.name || a.email.split('@')[0],
        title: 'Support Specialist',
        visibleOnTeam: false,
        isOnline: false,
      },
      update: {
        email: a.email,
        displayName: a.name || a.email.split('@')[0],
      },
    })
  }
  return admins
}

function publishPresence(mapped: ReturnType<typeof mapAgent>) {
  supportSseHub.publish(supportSseHub.adminInboxChannel(), 'presence', { agents: [mapped] })
  supportSseHub.publish('chat:agents', 'presence', { agents: [mapped] })
}

export const supportAgentsService = {
  /** Tenant-facing: only admins marked visible on the support team */
  async listForTenant() {
    await ensurePresenceForAdmins()
    const rows = await prisma.supportAgentPresence.findMany({
      where: { visibleOnTeam: true },
      orderBy: [{ isOnline: 'desc' }, { displayName: 'asc' }],
    })
    return rows
      .map(mapAgent)
      .sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || a.name.localeCompare(b.name))
  },

  /** Admin roster: every platform admin with team + presence flags */
  async listForAdmin() {
    await ensurePresenceForAdmins()
    const rows = await prisma.supportAgentPresence.findMany({
      orderBy: [{ visibleOnTeam: 'desc' }, { displayName: 'asc' }],
    })
    return rows.map(mapAgent)
  },

  async getMine(adminUserId: string, email: string, name: string) {
    const row = await prisma.supportAgentPresence.upsert({
      where: { adminUserId },
      create: {
        adminUserId,
        email,
        displayName: name || email.split('@')[0],
        title: 'Support Specialist',
        visibleOnTeam: false,
        isOnline: false,
      },
      update: { email, displayName: name || email.split('@')[0] },
    })
    return mapAgent(row)
  },

  async setPresence(
    adminUserId: string,
    email: string,
    name: string,
    input: {
      isOnline?: boolean
      title?: string
      heartbeat?: boolean
      visibleOnTeam?: boolean
    },
  ) {
    await this.getMine(adminUserId, email, name)
    const current = await prisma.supportAgentPresence.findUniqueOrThrow({ where: { adminUserId } })
    const nextOnline = input.isOnline !== undefined ? input.isOnline : current.isOnline
    const row = await prisma.supportAgentPresence.update({
      where: { adminUserId },
      data: {
        isOnline: nextOnline,
        lastSeenAt: new Date(),
        ...(input.title ? { title: input.title.slice(0, 80) } : {}),
        ...(input.visibleOnTeam !== undefined ? { visibleOnTeam: input.visibleOnTeam } : {}),
      },
    })
    const mapped = mapAgent(row)
    publishPresence(mapped)
    return mapped
  },

  /** Update any platform admin's team visibility / online status */
  async updateAgent(
    targetAdminUserId: string,
    input: { isOnline?: boolean; title?: string; visibleOnTeam?: boolean },
  ) {
    await ensurePresenceForAdmins()
    const current = await prisma.supportAgentPresence.findUnique({
      where: { adminUserId: targetAdminUserId },
    })
    if (!current) throw new AppError('Support agent not found', 404)

    const row = await prisma.supportAgentPresence.update({
      where: { adminUserId: targetAdminUserId },
      data: {
        ...(input.isOnline !== undefined
          ? { isOnline: input.isOnline, lastSeenAt: new Date() }
          : {}),
        ...(input.title ? { title: input.title.slice(0, 80) } : {}),
        ...(input.visibleOnTeam !== undefined ? { visibleOnTeam: input.visibleOnTeam } : {}),
      },
    })
    const mapped = mapAgent(row)
    publishPresence(mapped)
    return mapped
  },

  async requireOnlineAgent(email: string) {
    await ensurePresenceForAdmins()
    const row = await prisma.supportAgentPresence.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        visibleOnTeam: true,
      },
    })
    if (!row) throw new AppError('Support agent not found', 404)
    return mapAgent(row)
  },
}
