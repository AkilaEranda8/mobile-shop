import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { validate } from '../../../middleware/validate.middleware'
import { AppError } from '../../../middleware/error.middleware'
import { sendSuccess } from '../../../utils/response'
import { effectiveBranchId } from '../../../utils/active-branch'
import {
  loadRolePermissionMatrix,
  requireModuleAccess,
} from '../../../middleware/module-access.middleware'
import { canEditModule } from '../../tenants/role-permissions.util'
import { getAtpSnapshot } from '../../inventory-engine/atp.service'
import { softReserveImei } from '../../inventory-engine/inventory-engine.stock'
import { prisma } from '../../../config/database'
import { getWholesaleSettings } from '../settings/wholesale-settings.service'
import { createWholesaleInvoice } from '../sale/wholesale-sale.service'

const sellUnit = z.enum(['PIECE', 'BOX', 'CARTON'])
const paymentMethod = z.enum([
  'CASH',
  'CARD',
  'UPI',
  'BANK_TRANSFER',
  'WALLET',
  'CHEQUE',
  'CREDIT',
])

const checkoutSchema = z.object({
  dealerId: z.string().min(1),
  fulfillmentBranchId: z.string().min(1).optional(),
  salesRepId: z.string().min(1).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive(),
        sellUnit: sellUnit.optional(),
        sku: z.string().optional().nullable(),
        imei: z.string().optional().nullable(),
        unitPrice: z.number().min(0).optional().nullable(),
        discount: z.number().min(0).optional().nullable(),
      }),
    )
    .min(1),
  payments: z
    .array(
      z.object({
        method: paymentMethod,
        amount: z.number().positive(),
        reference: z.string().optional().nullable(),
      }),
    )
    .min(1),
})

const atpQuerySchema = z.object({
  productId: z.string().min(1),
  branchId: z.string().min(1).optional(),
  sku: z.string().optional(),
})

const softReserveSchema = z.object({
  imei: z.string().min(8),
  ttlMs: z.number().int().positive().optional(),
})

export const posRouter = Router()

posRouter.post(
  '/checkout',
  requireModuleAccess('WHOLESALE_POS', 'edit'),
  validate(checkoutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof checkoutSchema>
      const hasOverride = body.lines.some((l) => l.unitPrice != null)
      if (hasOverride) {
        const role = req.user?.role ?? ''
        if (role !== 'OWNER' && role !== 'PLATFORM_ADMIN') {
          const matrix =
            req.rolePermissionMatrix ?? (await loadRolePermissionMatrix(req.tenantId!))
          if (!canEditModule(matrix, role, 'WHOLESALE_PRICING_ADMIN')) {
            throw new AppError('Price override requires WHOLESALE_PRICING_ADMIN', 403)
          }
        }
      }

      const fulfillmentBranchId =
        body.fulfillmentBranchId || effectiveBranchId(req) || undefined
      if (!fulfillmentBranchId) {
        throw new AppError('fulfillmentBranchId is required', 400)
      }

      const user = req.user!
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { name: true },
      })
      const performedBy = u?.name || user.email || user.userId

      const invoice = await createWholesaleInvoice({
        tenantId: req.tenantId!,
        channel: 'COUNTER',
        dealerId: body.dealerId,
        fulfillmentBranchId,
        salesRepId: body.salesRepId || user.userId,
        notes: body.notes,
        lines: body.lines,
        payments: body.payments,
        performedBy,
        actorUserId: user.userId,
        actorEmail: user.email,
      })

      sendSuccess(res, invoice, 'Wholesale invoice created', 201)
    } catch (e) {
      next(e)
    }
  },
)

posRouter.get(
  '/atp',
  validate(atpQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = String(req.query.productId)
      const sku = req.query.sku ? String(req.query.sku) : undefined
      const branchId =
        (req.query.branchId as string | undefined) || effectiveBranchId(req) || undefined
      if (!branchId) throw new AppError('branchId is required', 400)

      const snap = await getAtpSnapshot(prisma, { productId, branchId, sku })
      sendSuccess(res, { productId, branchId, sku: sku ?? null, ...snap })
    } catch (e) {
      next(e)
    }
  },
)

posRouter.post(
  '/imei/soft-reserve',
  validate(softReserveSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await getWholesaleSettings(req.tenantId!)
      const reservedBy = req.user?.userId || req.user?.email || 'unknown'
      const result = await softReserveImei(prisma, {
        imei: req.body.imei,
        reservedBy,
        ttlMs: req.body.ttlMs ?? settings.imeiSoftReserveTtlMs,
      })
      sendSuccess(res, { imei: req.body.imei, ...result })
    } catch (e) {
      next(e)
    }
  },
)
