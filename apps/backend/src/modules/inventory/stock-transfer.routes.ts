import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess } from '../../utils/response'
import { stockTransferSchema } from './stock-transfer.schema'
import { stockTransferService } from './stock-transfer.service'
import { effectiveBranchId } from '../../utils/active-branch'
import { AppError } from '../../middleware/error.middleware'

const router = Router()
router.use(authenticate)

router.get('/transfers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
    const data = await stockTransferService.list(req.tenantId!, { branchId, limit })
    sendSuccess(res, data)
  } catch (e) { next(e) }
})

router.get('/transfer/imeis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = req.query.productId as string
    const fromBranchId = req.query.fromBranchId as string
    const variationKey = req.query.variationKey as string | undefined
    if (!productId || !fromBranchId) throw new AppError('productId and fromBranchId are required', 400)
    const data = await stockTransferService.listTransferImeis(
      req.tenantId!,
      productId,
      fromBranchId,
      variationKey,
    )
    sendSuccess(res, data)
  } catch (e) { next(e) }
})

router.get('/transfer/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = req.query.productId as string
    const toBranchId = req.query.toBranchId as string
    const variationKey = req.query.variationKey as string | undefined
    if (!productId || !toBranchId) throw new AppError('productId and toBranchId are required', 400)
    const data = await stockTransferService.preview(req.tenantId!, productId, toBranchId, variationKey)
    sendSuccess(res, data)
  } catch (e) { next(e) }
})

router.post(
  '/transfer',
  authorize('OWNER', 'MANAGER'),
  validate(stockTransferSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { name: true },
      })
      const performedBy = u?.name || user.email || user.userId
      const data = await stockTransferService.transfer(
        req.tenantId!,
        user.userId,
        user.role,
        performedBy,
        req.body,
      )
      sendSuccess(res, data, 'Stock transferred', 201)
    } catch (e) { next(e) }
  },
)

export default router
