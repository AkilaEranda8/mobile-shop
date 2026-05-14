import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { salesService } from './sales.service'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateReturnNumber } from '../../utils/counters'

const router = Router()
router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try { const r = await salesService.list(req.tenantId!, req); sendPaginated(res, r.data, r.total, r.page, r.limit) } catch (e) { next(e) }
})

router.get('/returns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const [data, total] = await Promise.all([
      prisma.saleReturn.findMany({
        where: { tenantId: req.tenantId! },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true, sale: { select: { invoiceNumber: true, customerName: true } } },
      }),
      prisma.saleReturn.count({ where: { tenantId: req.tenantId! } }),
    ])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await salesService.getById(req.tenantId!, req.params.id)) } catch (e) { next(e) }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await salesService.create(req.tenantId!, req.user!.userId, req.user!.email, req.body), 'Sale created', 201) } catch (e) { next(e) }
})

router.post('/:id/returns', authorize('OWNER', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      include: { items: true },
    })
    if (!sale) throw new AppError('Sale not found', 404)
    const existingReturn = await prisma.saleReturn.findFirst({ where: { saleId: sale.id } })
    if (existingReturn) throw new AppError('A return has already been processed for this order', 400)

    const { items, reason, refundMethod, notes } = req.body
    if (!items?.length) throw new AppError('No items provided for return', 400)

    // Validate quantities against original sale
    for (const ri of items) {
      const orig = sale.items.find((si: any) => si.productId === ri.productId)
      if (!orig) throw new AppError(`Item ${ri.productName} not found in original sale`, 400)
      if (ri.quantity > orig.quantity) throw new AppError(`Return qty for ${ri.productName} exceeds sold qty`, 400)
    }

    const returnNumber = await generateReturnNumber(req.tenantId!)
    const refundAmount = items.reduce((s: number, i: any) => s + i.total, 0)

    const userBranch = await prisma.userBranch.findFirst({ where: { userId: req.user!.userId } })
    const branchId = userBranch?.branchId ?? sale.branchId

    const saleReturn = await prisma.$transaction(async (tx: any) => {
      // Create return record
      const ret = await tx.saleReturn.create({
        data: {
          tenantId:     req.tenantId!,
          branchId,
          saleId:       sale.id,
          returnNumber,
          reason,
          refundAmount,
          refundMethod,
          processedBy:  req.user?.userId ?? 'system',
          notes:        notes ?? null,
          items: {
            create: items.map((i: any) => ({
              productId:   i.productId ?? undefined,
              productName: i.productName,
              quantity:    Number(i.quantity),
              unitPrice:   Number(i.unitPrice),
              total:       Number(i.total),
            })),
          },
        },
        include: { items: true },
      })

      // Restock products + create StockMovements
      for (const ri of items) {
        if (ri.productId) {
          await tx.product.update({
            where: { id: ri.productId },
            data:  { stock: { increment: ri.quantity } },
          })
          await tx.stockMovement.create({
            data: {
              productId:   ri.productId,
              branchId:    branchId ?? sale.branchId,
              type:        'RETURN',
              quantity:    ri.quantity,
              reference:   returnNumber,
              note:        `Return for ${sale.invoiceNumber} — ${reason}`,
              performedBy: req.user?.userId ?? 'system',
            },
          })
        }
      }

      // Always mark sale as RETURNED once any return is processed
      await tx.sale.update({ where: { id: sale.id }, data: { status: 'RETURNED' } })

      // Create Transaction for refund payout
      if (branchId) {
        await tx.transaction.create({
          data: {
            tenantId:      req.tenantId!,
            branchId,
            type:          'EXPENSE',
            category:      'Refund',
            amount:        refundAmount,
            description:   `Refund for ${sale.invoiceNumber} — ${reason}`,
            paymentMethod: refundMethod,
            reference:     returnNumber,
            performedBy:   req.user?.userId ?? 'system',
          },
        })
      }

      return ret
    })

    sendSuccess(res, saleReturn, 'Return processed successfully', 201)
  } catch (e) { next(e) }
})

export default router
