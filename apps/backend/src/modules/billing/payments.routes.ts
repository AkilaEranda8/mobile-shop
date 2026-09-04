import { Router, Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { sendSuccess } from '../../utils/response'
import { handleHelaposWebhook } from './helapos.service'

const router = Router()

/** Tight limit on public notify endpoint to blunt brute-force / replay floods */
const helaposWebhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many webhook requests' },
})

/** Public HelaPOS Notify URL — no auth (signature + IP + amount checks inside) */
router.post(
  '/helapos/webhook',
  helaposWebhookLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawBody =
        typeof (req as any).rawBody === 'string' || Buffer.isBuffer((req as any).rawBody)
          ? (req as any).rawBody
          : undefined
      const result = await handleHelaposWebhook({
        body: req.body,
        rawBody,
        headers: req.headers as Record<string, string | string[] | undefined>,
        ip: req.ip || req.socket.remoteAddress || undefined,
      })
      sendSuccess(res, result, result.ok ? 'OK' : 'Ignored')
    } catch (e) { next(e) }
  },
)

export default router
