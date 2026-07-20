import { Router, Request, Response, NextFunction } from 'express'
import { tenantsController } from './tenants.controller'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { updateInvoiceSettingsSchema } from './invoice-settings.schema'
import { prisma } from '../../config/database'
import { sendSuccess } from '../../utils/response'
import { OPT_IN_FEATURES, buildFeatureMap, buildPriceMap } from './tenant-features'
import { handleAccountingFeatureBatch } from '../accounting/accounting-feature.util'

const router = Router()
router.use(authenticate)

router.get('/my-features', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user?.tenantId
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized' })
    const rows = await prisma.tenantFeature.findMany({ where: { tenantId } })
    sendSuccess(res, { features: buildFeatureMap(rows), prices: buildPriceMap(rows) })
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
    await handleAccountingFeatureBatch(tenantId, updates, (req as any).user?.email ?? 'owner')
    const rows = await prisma.tenantFeature.findMany({ where: { tenantId } })
    sendSuccess(res, { features: buildFeatureMap(rows), prices: buildPriceMap(rows) }, 'Features updated')
  } catch (e) { next(e) }
})

router.get('/invoice-templates', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'), tenantsController.listInvoiceTemplates)
router.get('/config-domains', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER'), tenantsController.listConfigDomains)
router.get('/me/settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'), tenantsController.getMySettings)
router.get('/', authorize('PLATFORM_ADMIN'), tenantsController.list)
router.get('/me', tenantsController.getMe)
router.get('/:id', authorize('PLATFORM_ADMIN', 'OWNER'), tenantsController.getById)
router.put('/:id', authorize('PLATFORM_ADMIN', 'OWNER'), tenantsController.update)
router.get('/:id/settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'), tenantsController.getAllSettings)
router.get('/:id/invoice-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'), tenantsController.getInvoiceSettings)
router.patch('/:id/invoice-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER'), validate(updateInvoiceSettingsSchema), tenantsController.updateInvoiceSettings)
router.get('/:id/reload-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'), tenantsController.getReloadSettings)
router.patch('/:id/reload-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER'), tenantsController.updateReloadSettings)
router.get('/:id/payment-method-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'), tenantsController.getPaymentMethodSettings)
router.patch('/:id/payment-method-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER'), tenantsController.updatePaymentMethodSettings)
router.get('/:id/product-variant-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'), tenantsController.getProductVariantSettings)
router.patch('/:id/product-variant-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER'), tenantsController.updateProductVariantSettings)
router.get('/:id/product-code-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'), tenantsController.getProductCodeSettings)
router.patch('/:id/product-code-settings', authorize('PLATFORM_ADMIN', 'OWNER', 'MANAGER'), tenantsController.updateProductCodeSettings)

export default router
