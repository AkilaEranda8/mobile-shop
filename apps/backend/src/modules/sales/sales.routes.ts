import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { salesService } from './sales.service'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { prisma } from '../../config/database'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateReturnNumber } from '../../utils/counters'
import { voidWarrantiesForSaleReturn } from '../warranty/warranty.service'

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
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } })
    const cashierName = u?.name || req.user!.email
    sendSuccess(res, await salesService.create(req.tenantId!, req.user!.userId, cashierName, req.body), 'Sale created', 201)
  } catch (e) { next(e) }
})

router.post('/:id/returns', authorize('OWNER', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      include: { items: true },
    })
    if (!sale) throw new AppError('Sale not found', 404)
    if (sale.status === 'RETURNED') throw new AppError('This order has already been fully returned', 400)
    await assertBusinessDayOpenIfEnabled(req.tenantId!, sale.branchId)

    const { items, reason, refundMethod, notes } = req.body
    if (!items?.length) throw new AppError('No items provided for return', 400)

    // Sum already-returned quantities per product from prior returns
    const priorReturns = await prisma.saleReturn.findMany({
      where: { saleId: sale.id },
      include: { items: true },
    })
    const alreadyReturned: Record<string, number> = {}
    for (const ret of priorReturns) {
      for (const ri of ret.items) {
        if (ri.productId) alreadyReturned[ri.productId] = (alreadyReturned[ri.productId] ?? 0) + ri.quantity
      }
    }

    // Validate quantities against remaining returnable qty
    for (const ri of items) {
      const orig = sale.items.find((si: any) => si.productId === ri.productId)
      if (!orig) throw new AppError(`Item "${ri.productName}" not found in original sale`, 400)
      const available = orig.quantity - (alreadyReturned[ri.productId] ?? 0)
      if (available <= 0) throw new AppError(`"${ri.productName}" has already been fully returned`, 400)
      if (ri.quantity > available) throw new AppError(`Return qty for "${ri.productName}" exceeds available (${available} remaining)`, 400)
    }

    const returnNumber = await generateReturnNumber(req.tenantId!)
    const refundAmount = items.reduce((s: number, i: any) => s + Number(i.total), 0)

    const userBranch = await prisma.userBranch.findFirst({ where: { userId: req.user!.userId } })
    const branchId = userBranch?.branchId ?? sale.branchId

    // Determine new sale status: RETURNED only when all units are fully returned
    const totalSoldQty    = sale.items.reduce((s: number, i: any) => s + i.quantity, 0)
    const totalNewQty     = items.reduce((s: number, i: any) => s + Number(i.quantity), 0)
    const totalPriorQty   = Object.values(alreadyReturned).reduce((s: number, v) => s + (v as number), 0)
    const newSaleStatus   = (totalPriorQty + totalNewQty >= totalSoldQty) ? 'RETURNED' : sale.status
    const isFullReturn    = newSaleStatus === 'RETURNED'

    const saleReturn = await prisma.$transaction(async (tx: any) => {
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

      // Restock products + StockMovements + reset IMEI
      for (const ri of items) {
        if (ri.productId) {
          await tx.product.update({
            where: { id: ri.productId },
            data:  { stock: { increment: Number(ri.quantity) } },
          })
          await tx.stockMovement.create({
            data: {
              productId:   ri.productId,
              branchId:    branchId ?? sale.branchId,
              type:        'RETURN',
              quantity:    Number(ri.quantity),
              reference:   returnNumber,
              note:        `Return for ${sale.invoiceNumber} — ${reason}`,
              performedBy: req.user?.userId ?? 'system',
            },
          })
        }
        // Use IMEI from request if provided, else find from original sale item
        const imeiToReset = ri.imei ?? sale.items.find((si: any) => si.productId === ri.productId && si.imei)?.imei
        if (imeiToReset) {
          await tx.imeiRecord.updateMany({
            where: { imei: imeiToReset },
            data:  { status: 'IN_STOCK', saleId: null, customerId: null },
          })
        }
      }

      // Split the refund across what the customer already paid vs still owed, so a
      // partially-paid (credit) sale doesn't end up with negative paidAmount or a
      // stale dueAmount/customer balance.
      const refundFromPaid = Math.min(refundAmount, sale.paidAmount)
      const refundFromDue  = Math.max(0, refundAmount - refundFromPaid)

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status:     newSaleStatus,
          total:      { decrement: refundAmount },
          paidAmount: { decrement: refundFromPaid },
          ...(refundFromDue > 0 && { dueAmount: { decrement: refundFromDue } }),
        },
      })

      // Reduce the customer's outstanding balance by the credit portion of the refund.
      if (refundFromDue > 0 && sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data:  { totalDue: { decrement: refundFromDue } },
        }).catch(() => {})
      }

      // Adjust original INCOME transaction to reflect the refund
      const origIncomeTx = await tx.transaction.findFirst({
        where: { reference: sale.invoiceNumber, type: 'INCOME', tenantId: req.tenantId! },
      })
      if (origIncomeTx) {
        const newAmount = origIncomeTx.amount - refundAmount
        if (newAmount <= 0) {
          await tx.transaction.delete({ where: { id: origIncomeTx.id } })
        } else {
          await tx.transaction.update({ where: { id: origIncomeTx.id }, data: { amount: newAmount } })
        }
      }

      // Decrement customer totalPurchases on full return only
      if (isFullReturn && sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data:  { totalPurchases: { decrement: 1 } },
        }).catch(() => {})
      }

      const returnedImeis = items
        .map((ri: any) => ri.imei ?? sale.items.find((si: any) => si.productId === ri.productId && si.imei)?.imei)
        .filter(Boolean) as string[]
      await voidWarrantiesForSaleReturn(tx, req.tenantId!, sale.id, returnedImeis)

      return ret
    })

    sendSuccess(res, saleReturn, 'Return processed successfully', 201)
  } catch (e) { next(e) }
})

export default router
