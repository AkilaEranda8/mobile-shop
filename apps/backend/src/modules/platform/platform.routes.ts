import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess } from '../../utils/response'
import { getMaintenanceStatus } from '../../utils/platform-config'

const router = Router()

router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const maintenance = await getMaintenanceStatus()
    const announcements = maintenance.enabled
      ? await prisma.platformAnnouncement.findMany({
          where: { type: 'MAINTENANCE', status: 'SENT' },
          orderBy: { sentAt: 'desc' },
          take: 3,
          select: { id: true, title: true, body: true, type: true, sentAt: true },
        })
      : []
    sendSuccess(res, { maintenance, announcements })
  } catch (e) { next(e) }
})

export default router
