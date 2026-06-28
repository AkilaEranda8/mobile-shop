import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess } from '../../utils/response'
import { stockTransferSchema } from './stock-transfer.schema'
import { stockTransferService } from './stock-transfer.service'
import { effectiveBranchId } from '../../utils/active-branch'

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
