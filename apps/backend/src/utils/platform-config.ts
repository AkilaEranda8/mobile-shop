import { prisma } from '../config/database'

export const DEFAULT_MAINTENANCE_MESSAGE =
  'Hexalyte is currently in maintenance mode. New logins are disabled and some features may be unavailable.'

export async function getMaintenanceStatus() {
  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: ['maintenance.enabled', 'maintenance.message'] } },
  })
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    enabled: map['maintenance.enabled'] === 'true',
    message: map['maintenance.message']?.trim() || DEFAULT_MAINTENANCE_MESSAGE,
  }
}

export async function syncMaintenanceAnnouncement(enabled: boolean, message: string) {
  // Only one live maintenance banner should exist at a time. Archive previous
  // ones both when re-enabling (avoids duplicates) and when disabling
  // (removes the non-dismissible banner from every tenant).
  await prisma.platformAnnouncement.updateMany({
    where: { title: 'Maintenance Mode Active', status: 'SENT' },
    data: { status: 'ARCHIVED' },
  })
  if (!enabled) return
  await prisma.platformAnnouncement.create({
    data: {
      title: 'Maintenance Mode Active',
      body: message,
      type: 'MAINTENANCE',
      target: 'ALL',
      dismissible: false,
      status: 'SENT',
      sentAt: new Date(),
      createdBy: 'Platform Admin',
    },
  })
}
