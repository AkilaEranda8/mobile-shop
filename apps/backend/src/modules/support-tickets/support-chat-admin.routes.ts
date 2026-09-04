import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { supportChatService } from './support-chat.service'
import { supportAgentsService } from './support-agents.service'
import { agentPresenceSchema, adminPatchAgentSchema, chatMessageSchema, convertChatSchema } from './support.validators'
import { initSseHeaders, supportSseHub, writeSse } from './support-sse'
import { prisma } from '../../config/database'

const router = Router()

router.use((req, _res, next) => {
  if (!req.headers.authorization && typeof req.query.access_token === 'string') {
    req.headers.authorization = `Bearer ${req.query.access_token}`
  }
  next()
})

router.get('/agents', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await supportAgentsService.listForAdmin())
  } catch (e) {
    next(e)
  }
})

router.get('/agents/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { name: true, email: true },
    })
    sendSuccess(
      res,
      await supportAgentsService.getMine(
        req.user!.userId,
        req.user!.email,
        user?.name || req.user!.email,
      ),
    )
  } catch (e) {
    next(e)
  }
})

router.patch(
  '/agents/me',
  validate(agentPresenceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { name: true, email: true },
      })
      sendSuccess(
        res,
        await supportAgentsService.setPresence(
          req.user!.userId,
          req.user!.email,
          user?.name || req.user!.email,
          req.body,
        ),
      )
    } catch (e) {
      next(e)
    }
  },
)

router.patch(
  '/agents/:adminUserId',
  validate(adminPatchAgentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await supportAgentsService.updateAgent(req.params.adminUserId, req.body))
    } catch (e) {
      next(e)
    }
  },
)

router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await supportChatService.adminList({
      status: req.query.status as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 40,
    })
    sendPaginated(res, result.data, result.total, result.page, result.limit)
  } catch (e) {
    next(e)
  }
})

router.get('/sessions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await supportChatService.getMessages(req.params.id))
  } catch (e) {
    next(e)
  }
})

router.post('/sessions/:id/claim', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await supportChatService.claim(req.params.id, req.user!.email))
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
          authorType: 'PLATFORM_ADMIN',
          authorEmail: req.user!.email,
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
    sendSuccess(res, await supportChatService.end(req.params.id, req.user!.email))
  } catch (e) {
    next(e)
  }
})

router.post(
  '/sessions/:id/convert-to-ticket',
  validate(convertChatSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await supportChatService.convertToTicket(req.params.id, req.user!.email, req.body),
        'Converted',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

router.get('/sessions/:id/stream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await supportChatService.getMessages(req.params.id)
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

router.get('/presence/stream', async (req: Request, res: Response) => {
  initSseHeaders(res)
  writeSse(res, 'ready', { channel: 'admin:inbox' })
  const clientId = randomUUID()
  const unsubscribe = supportSseHub.subscribe(supportSseHub.adminInboxChannel(), {
    id: clientId,
    write: (event, data) => writeSse(res, event, data),
  })
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
})

export default router
