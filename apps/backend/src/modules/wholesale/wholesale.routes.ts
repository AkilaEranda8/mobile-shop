import { Router, type Request, type Response, type NextFunction } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'
import { sendSuccess } from '../../utils/response'
import { effectiveBranchId } from '../../utils/active-branch'
import { isFeatureEnabledForBranch } from '../../utils/tenant-feature.util'
import { dealersRouter } from './dealers/dealers.routes'
import { pricingRouter } from './pricing/pricing.routes'
import { posRouter } from './pos/pos.routes'
import { quotationsRouter } from './quotations/quotations.routes'
import { ordersRouter } from './orders/orders.routes'
import { warehouseRouter } from './warehouse/warehouse.routes'
import { deliveryRouter } from './delivery/delivery.routes'
import { returnsRouter } from './returns/returns.routes'
import { collectionsRouter } from './collections/collections.routes'
import { reportsRouter } from './reports/reports.routes'
import { settingsRouter } from './settings/settings.routes'
import { vanRouter } from './van/van.routes'
import { getWholesaleSettings, upsertWholesaleSettings } from './settings/wholesale-settings.service'

const router = Router()

async function requireWholesale(req: Request, _res: Response, next: NextFunction) {
  try {
    const branchId = effectiveBranchId(req)
    if (!(await isFeatureEnabledForBranch(req.tenantId!, branchId, 'WHOLESALE'))) {
      throw new AppError('Wholesale is not enabled for this tenant/branch', 403)
    }
    next()
  } catch (error) {
    next(error)
  }
}

router.use(authenticate, requireWholesale)

router.get('/health', (_req, res) => {
  sendSuccess(res, { module: 'wholesale', ok: true })
})

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await getWholesaleSettings(req.tenantId!)
    sendSuccess(res, settings)
  } catch (e) {
    next(e)
  }
})

router.patch('/settings', async (req, res, next) => {
  try {
    const settings = await upsertWholesaleSettings(req.tenantId!, req.body ?? {})
    sendSuccess(res, settings)
  } catch (e) {
    next(e)
  }
})

router.use('/dealers', dealersRouter)
router.use('/pricing', pricingRouter)
router.use('/pos', posRouter)
router.use('/quotations', quotationsRouter)
router.use('/orders', ordersRouter)
router.use('/warehouse', warehouseRouter)
router.use('/delivery', deliveryRouter)
router.use('/returns', returnsRouter)
router.use('/collections', collectionsRouter)
router.use('/reports', reportsRouter)
router.use('/settings', settingsRouter)
router.use('/van', vanRouter)

export default router
