import { Router, Request, Response, NextFunction } from 'express'
import { authenticate, requirePermission } from '../../middleware/auth.middleware'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { PERMISSIONS } from '../../utils/permissions'
import { productTraceabilityService } from './product-traceability.service'

const router = Router({ mergeParams: true })

router.use(authenticate)
router.use(requirePermission(PERMISSIONS.PRODUCT_TRACEABILITY_VIEW))

type PaginatedHandler = (
  tenantId: string,
  productId: string,
  req: Request,
) => Promise<{ data: unknown[]; total: number; page: number; limit: number }>

function paginatedRoute(handler: PaginatedHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await handler(req.tenantId!, req.params.productId, req)
      sendPaginated(res, result.data, result.total, result.page, result.limit)
    } catch (err) {
      next(err)
    }
  }
}

router.get('/:productId/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await productTraceabilityService.getSummary(req.tenantId!, req.params.productId, req)
    sendSuccess(res, data)
  } catch (err) {
    next(err)
  }
})

router.get('/:productId/purchases', paginatedRoute(productTraceabilityService.getPurchases))
router.get('/:productId/sales', paginatedRoute(productTraceabilityService.getSales))
router.get('/:productId/movements', paginatedRoute(productTraceabilityService.getMovements))
router.get('/:productId/transfers', paginatedRoute(productTraceabilityService.getTransfers))
router.get('/:productId/serials', paginatedRoute(productTraceabilityService.getSerials))
router.get('/:productId/timeline', paginatedRoute(productTraceabilityService.getTimeline))

export default router
