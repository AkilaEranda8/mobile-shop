import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { exchangesService } from './exchanges.service'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { completeExchangeSchema } from './exchanges.schema'

const router = Router()
router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await exchangesService.list(req.tenantId!, req)
    sendPaginated(res, r.data, r.total, r.page, r.limit)
  } catch (e) { next(e) }
})

router.get('/available-stock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userBranch = await prisma.userBranch.findFirst({
      where: { userId: req.user!.userId },
      select: { branchId: true },
    })
    const branch = userBranch?.branchId ?? (await prisma.branch.findFirst({
      where: { tenantId: req.tenantId! },
      orderBy: [{ isHeadquarters: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    }))?.id

    const data = await exchangesService.listAvailableStock(req.tenantId!, {
      search:      req.query.search as string | undefined,
      excludeImei: req.query.excludeImei as string | undefined,
      branchId:    branch,
    })
    sendSuccess(res, data)
  } catch (e) { next(e) }
})

router.post('/complete', validate(completeExchangeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } })
    const cashierName = u?.name || req.user!.email || 'Staff'
    const data = await exchangesService.completeExchange(
      req.tenantId!,
      req.user!.userId,
      cashierName,
      req.body,
    )
    sendSuccess(res, data, 'Exchange completed', 201)
  } catch (e) { next(e) }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await exchangesService.create(req.tenantId!, req.body, req.user?.userId ?? 'system'), 'Exchange recorded', 201)
  } catch (e) { next(e) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await exchangesService.getById(req.tenantId!, req.params.id))
  } catch (e) { next(e) }
})

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await exchangesService.update(req.tenantId!, req.params.id, req.body))
  } catch (e) { next(e) }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await exchangesService.remove(req.tenantId!, req.params.id))
  } catch (e) { next(e) }
})

export default router
