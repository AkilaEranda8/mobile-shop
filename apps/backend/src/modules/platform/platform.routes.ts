import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess } from '../../utils/response'
import { getMaintenanceStatus } from '../../utils/platform-config'
import { authenticate } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'

const router = Router()

function announcementTargetsForPlan(plan: string): string[] {
  const targets = new Set<string>(['ALL'])
  if (plan && plan !== 'TRIAL') targets.add(plan)
  return [...targets]
}

function announcementMatchesTenant(
  announcement: { target: string; targetTenants: string[] },
  tenant: { id: string; plan: string },
): boolean {
  if (announcement.target === 'SPECIFIC') {
    return announcement.targetTenants.includes(tenant.id)
  }
  return announcementTargetsForPlan(tenant.plan).includes(announcement.target)
}

router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const maintenance = await getMaintenanceStatus()
    sendSuccess(res, { maintenance, announcements: [] })
  } catch (e) { next(e) }
})

/** Active SENT announcements for the logged-in user (respects plan target + dismissals). */
router.get('/announcements', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId
    const tenantId = req.tenantId!
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, plan: true },
    })
    if (!tenant) throw new AppError('Tenant not found', 404)

    const dismissed = await prisma.announcementDismissal.findMany({
      where: { userId },
      select: { announcementId: true },
    })
    const dismissedIds = dismissed.map(d => d.announcementId)

    const candidates = await prisma.platformAnnouncement.findMany({
      where: {
        status: 'SENT',
        ...(dismissedIds.length ? { id: { notIn: dismissedIds } } : {}),
      },
      orderBy: { sentAt: 'desc' },
      take: 20,
      select: {
        id: true, title: true, body: true, type: true, sentAt: true,
        target: true, targetTenants: true, dismissible: true,
      },
    })

    const items = candidates
      .filter(a => announcementMatchesTenant(a, tenant))
      .slice(0, 5)
      .map(({ target: _t, targetTenants: _tt, ...rest }) => rest) // keeps dismissible

    sendSuccess(res, items)
  } catch (e) { next(e) }
})

router.post('/announcements/:id/dismiss', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId
    const announcementId = req.params.id

    const item = await prisma.platformAnnouncement.findUnique({ where: { id: announcementId } })
    if (!item || item.status !== 'SENT') throw new AppError('Announcement not found', 404)
    if (!item.dismissible) throw new AppError('This announcement cannot be dismissed', 400)

    const existing = await prisma.announcementDismissal.findUnique({
      where: { userId_announcementId: { userId, announcementId } },
    })

    if (!existing) {
      await prisma.$transaction([
        prisma.announcementDismissal.create({ data: { userId, announcementId } }),
        prisma.platformAnnouncement.update({
          where: { id: announcementId },
          data: { seenCount: { increment: 1 } },
        }),
      ])
    }

    sendSuccess(res, { dismissed: true })
  } catch (e) { next(e) }
})

export default router
