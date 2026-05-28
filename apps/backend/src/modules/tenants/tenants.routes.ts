import { Router, Request, Response, NextFunction } from 'express'
import { tenantsController } from './tenants.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { prisma } from '../../config/database'
import { sendSuccess } from '../../utils/response'

const router = Router()
router.use(authenticate)

const ALL_FEATURES = [
  'POS', 'REPAIRS', 'WARRANTY', 'WHATSAPP', 'ANALYTICS', 'REPORTS',
  'FINANCE', 'DELIVERY', 'EXCHANGES', 'STAFF', 'SUPPLIERS', 'IMEI', 'SERVICES',
]

// Features that are opt-in (default false — admin must explicitly enable per tenant)
const OPT_IN_FEATURES = ['DAILY_RELOAD']

router.get('/my-features', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user?.tenantId
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized' })
    const rows = await prisma.tenantFeature.findMany({ where: { tenantId } })
    const map: Record<string, boolean> = {}
    for (const f of ALL_FEATURES)    map[f] = true   // default ON
    for (const f of OPT_IN_FEATURES) map[f] = false  // default OFF — must be enabled by admin
    for (const r of rows) map[r.feature] = r.enabled // override with DB value
    sendSuccess(res, map)
  } catch (e) { next(e) }
})

router.get('/', authorize('PLATFORM_ADMIN'), tenantsController.list)
router.get('/:id', authorize('PLATFORM_ADMIN', 'OWNER'), tenantsController.getById)
router.put('/:id', authorize('PLATFORM_ADMIN', 'OWNER'), tenantsController.update)
router.get('/:id/invoice-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'), tenantsController.getInvoiceSettings)
router.patch('/:id/invoice-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER'), tenantsController.updateInvoiceSettings)

export default router
