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
  'DAILY_RELOAD', 'CUSTOMER_CREDIT',
]

// Features that are opt-in (default false — enable per tenant in admin or settings)
const OPT_IN_FEATURES = ['DAILY_RELOAD', 'CUSTOMER_CREDIT']

function buildFeatureMap(rows: { feature: string; enabled: boolean }[]) {
  const map: Record<string, boolean> = {}
  for (const f of ALL_FEATURES) map[f] = !OPT_IN_FEATURES.includes(f)
  for (const f of OPT_IN_FEATURES) map[f] = false
  for (const r of rows) map[r.feature] = r.enabled
  return map
}

router.get('/my-features', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user?.tenantId
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized' })
    const rows = await prisma.tenantFeature.findMany({ where: { tenantId } })
    sendSuccess(res, buildFeatureMap(rows))
  } catch (e) { next(e) }
})

router.patch('/my-features', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user?.tenantId
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized' })
    const updates: Record<string, boolean> = req.body.features ?? {}
    const allowed = Object.entries(updates).filter(([f]) => OPT_IN_FEATURES.includes(f))
    await Promise.all(
      allowed.map(([feature, enabled]) =>
        prisma.tenantFeature.upsert({
          where: { tenantId_feature: { tenantId, feature } },
          create: { tenantId, feature, enabled },
          update: { enabled },
        }),
      ),
    )
    const rows = await prisma.tenantFeature.findMany({ where: { tenantId } })
    sendSuccess(res, buildFeatureMap(rows), 'Features updated')
  } catch (e) { next(e) }
})

router.get('/', authorize('PLATFORM_ADMIN'), tenantsController.list)
router.get('/:id', authorize('PLATFORM_ADMIN', 'OWNER'), tenantsController.getById)
router.put('/:id', authorize('PLATFORM_ADMIN', 'OWNER'), tenantsController.update)
router.get('/:id/invoice-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'), tenantsController.getInvoiceSettings)
router.patch('/:id/invoice-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER'), tenantsController.updateInvoiceSettings)

export default router
