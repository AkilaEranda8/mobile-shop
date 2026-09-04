import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { authenticate } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess } from '../../utils/response'
import { supportChatService } from './support-chat.service'
import { chatMessageSchema, createChatSessionSchema } from './support.validators'
import { initSseHeaders, supportSseHub, writeSse } from './support-sse'

const router = Router()

router.use((req, _res, next) => {
  if (!req.headers.authorization && typeof req.query.access_token === 'string') {
    req.headers.authorization = `Bearer ${req.query.access_token}`
  }
  next()
})
router.use(authenticate)

router.post(
  '/sessions',
  validate(createChatSessionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await supportChatService.startOrResume(
          req.tenantId!,
          req.user!.userId,
          req.user!.email,
          req.body,
        ),
        'Chat started',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

router.get('/sessions/mine', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await supportChatService.listMine(req.tenantId!, req.user!.userId))
  } catch (e) {
    next(e)
  }
})

router.get('/sessions/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await supportChatService.getMessages(req.params.id, req.tenantId!))
  } catch (e) {
    next(e)
  }
})

router.post(
  '/sessions/:id/messages',
  validate(chatMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await supportChatService.sendMessage({
          sessionId: req.params.id,
          body: req.body.body,
          authorType: 'TENANT_USER',
          authorUserId: req.user!.userId,
          authorEmail: req.user!.email,
          tenantId: req.tenantId!,
        }),
        'Sent',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

router.post('/sessions/:id/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await supportChatService.end(req.params.id, req.user!.email, req.tenantId!))
  } catch (e) {
    next(e)
  }
})

router.get('/sessions/:id/stream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await supportChatService.getMessages(req.params.id, req.tenantId!)
    initSseHeaders(res)
    writeSse(res, 'ready', { sessionId: req.params.id })
    const clientId = randomUUID()
    const unsubscribe = supportSseHub.subscribe(
      supportSseHub.sessionChannel(req.params.id),
      {
        id: clientId,
        write: (event, data) => writeSse(res, event, data),
      },
    )
    const ping = setInterval(() => {
      try {
        writeSse(res, 'ping', { t: Date.now() })
      } catch {
        clearInterval(ping)
      }
    }, 25000)
    req.on('close', () => {
      clearInterval(ping)
      unsubscribe()
    })
  } catch (e) {
    next(e)
  }
})

export default router
