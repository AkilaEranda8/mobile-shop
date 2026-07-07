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
import { emitSaleReturnAccounting } from '../accounting/integration/accounting-events.service'
import { assertBranchRecordAccess } from '../../utils/active-branch'

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
  try { sendSuccess(res, await salesService.getById(req.tenantId!, req.params.id, req)) } catch (e) { next(e) }
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
    assertBranchRecordAccess(req, sale.branchId)
    if (sale.status === 'RETURNED') throw new AppError('This order has already been fully returned', 400)
    await assertBusinessDayOpenIfEnabled(req.tenantId!, sale.branchId)

    const { items, reason, refundMethod, notes } = req.body
    if (!items?.length) throw new AppError('No items provided for return', 400)

    const requested = (items as any[]).map((raw) => ({
      saleItemId: raw?.saleItemId ? String(raw.saleItemId) : null,
      productId: raw?.productId ? String(raw.productId) : null, // legacy fallback
      productName: String(raw?.productName ?? ''),
      quantity: Number(raw?.quantity ?? 0),
      imei: raw?.imei ? String(raw.imei).trim() : null,
    }))
    if (requested.some(r => !r.quantity || r.quantity < 0)) throw new AppError('Invalid return quantity', 400)

    const saleItemsById = new Map((sale.items ?? []).map((si: any) => [si.id, si]))

    // Sum already-returned quantities from prior returns (prefer saleItemId when available)
    const priorReturns = await prisma.saleReturn.findMany({
      where: { saleId: sale.id },
      include: { items: true },
    })
    const alreadyReturnedBySaleItem: Record<string, number> = {}
    const alreadyReturnedByProductSku: Record<string, number> = {}
    for (const ret of priorReturns) {
      for (const ri of ret.items) {
        const saleItemId = (ri as any).saleItemId as string | null | undefined
        if (saleItemId) {
          alreadyReturnedBySaleItem[saleItemId] = (alreadyReturnedBySaleItem[saleItemId] ?? 0) + ri.quantity
          continue
        }
        if (ri.productId) {
          const key = `${ri.productId}::${(sale.items.find((si: any) => si.productId === ri.productId)?.sku ?? '')}`
          alreadyReturnedByProductSku[key] = (alreadyReturnedByProductSku[key] ?? 0) + ri.quantity
        }
      }
    }

    // Validate quantities + compute server-side refund lines from original sale items
    const resolved = requested.map((ri) => {
      let orig: any | undefined
      if (ri.saleItemId) orig = saleItemsById.get(ri.saleItemId) as any
      if (!orig && ri.productId) orig = (sale.items ?? []).find((si: any) => si.productId === ri.productId)
      if (!orig) throw new AppError(`Item "${ri.productName || 'Unknown'}" not found in original sale`, 400)

      const priorQty = ri.saleItemId
        ? (alreadyReturnedBySaleItem[orig.id] ?? 0)
        : (alreadyReturnedByProductSku[`${orig.productId}::${orig.sku ?? ''}`] ?? 0)
      const available = Number(orig.quantity) - priorQty
      if (available <= 0) throw new AppError(`"${orig.productName}" has already been fully returned`, 400)
      if (ri.quantity > available) throw new AppError(`Return qty for "${orig.productName}" exceeds available (${available} remaining)`, 400)

      const unitNet = Number(orig.quantity) > 0 ? Number(orig.total) / Number(orig.quantity) : Number(orig.unitPrice)
      const lineTotal = Math.round(unitNet * ri.quantity * 100) / 100
      return {
        saleItemId: orig.id,
        productId: orig.productId ?? null,
        productName: orig.productName,
        sku: orig.sku ?? '',
        imei: (ri.imei || orig.imei || null) as string | null,
        quantity: ri.quantity,
        unitPrice: Number(orig.unitPrice),
        total: lineTotal,
      }
    })

    // IMEI enforcement: if original line had IMEI, qty must be 1 and IMEI must be specific
    for (const r of resolved) {
      if (!r.imei && (saleItemsById.get(r.saleItemId) as any)?.imei) {
        throw new AppError(`IMEI required for "${r.productName}"`, 400)
      }
      if (((saleItemsById.get(r.saleItemId) as any)?.imei || r.imei) && r.quantity !== 1) {
        throw new AppError(`IMEI products must be returned one unit per line: "${r.productName}"`, 400)
      }
    }

    const returnNumber = await generateReturnNumber(req.tenantId!)
    const refundAmount = resolved.reduce((s: number, i: any) => s + Number(i.total), 0)
    const branchId = sale.branchId

    // Determine new sale status: RETURNED only when all units are fully returned
    const totalSoldQty    = sale.items.reduce((s: number, i: any) => s + i.quantity, 0)
    const totalNewQty     = resolved.reduce((s: number, i: any) => s + Number(i.quantity), 0)
    const totalPriorQty   = Object.values(alreadyReturnedBySaleItem).reduce((s: number, v) => s + (v as number), 0)
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
            create: resolved.map((i: any) => ({
              saleItemId:  i.saleItemId,
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
      for (const ri of resolved) {
        if (ri.productId) {
          const product = await tx.product.findUnique({
            where: { id: ri.productId },
            select: { storageVariations: true },
          })
          await tx.product.update({
            where: { id: ri.productId },
            data:  { stock: { increment: Number(ri.quantity) } },
          })

          // Restore variant stock (match by SKU, same logic as sales decrement)
          if (product?.storageVariations && ri.sku) {
            let updated = product.storageVariations as any[]
            if (Array.isArray(updated)) {
              let changed = false
              updated = updated.map((v: any) => {
                if (v?.sku && v.sku === ri.sku) {
                  changed = true
                  return { ...v, stock: Number(v.stock ?? 0) + Number(ri.quantity) }
                }
                return v
              })
              if (changed) {
                await tx.product.update({
                  where: { id: ri.productId },
                  data: { storageVariations: updated },
                })
              }
            }
          }

          await tx.stockMovement.create({
            data: {
              productId:   ri.productId,
              branchId:    sale.branchId,
              type:        'RETURN',
              quantity:    Number(ri.quantity),
              reference:   returnNumber,
              note:        `Return for ${sale.invoiceNumber} — ${reason}`,
              performedBy: req.user?.userId ?? 'system',
            },
          })
        }
        const imeiToReset = ri.imei
        if (imeiToReset) {
          await tx.imeiRecord.updateMany({
            where: { imei: imeiToReset, ...(ri.productId ? { productId: ri.productId } : {}) },
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
        .map((ri: any) => ri.imei)
        .filter(Boolean) as string[]
      await voidWarrantiesForSaleReturn(tx, req.tenantId!, sale.id, returnedImeis)

      return ret
    })

    void emitSaleReturnAccounting(req.tenantId!, saleReturn.id, branchId ?? sale.branchId, req.user?.email)
    sendSuccess(res, saleReturn, 'Return processed successfully', 201)
  } catch (e) { next(e) }
})

export default router
