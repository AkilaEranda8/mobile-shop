import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generatePONumber } from '../../utils/counters'

const router = Router()
router.use(authenticate)

async function recalcSupplierStats(supplierId: string, tenantId: string) {
  const agg = await prisma.purchaseOrder.aggregate({
    where: { supplierId, tenantId },
    _count: { id: true },
    _sum:   { total: true, dueAmount: true },
  })
  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      totalOrders:        agg._count.id          ?? 0,
      totalPurchaseValue: agg._sum.total          ?? 0,
      outstandingDues:    agg._sum.dueAmount      ?? 0,
    },
  })
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page, search } = getPagination(req)
    const where: any = { tenantId: req.tenantId!, ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { contactName: { contains: search, mode: 'insensitive' } }] }) }
    const [data, total] = await Promise.all([prisma.supplier.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }), prisma.supplier.count({ where })])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

router.post('/', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await prisma.supplier.create({ data: { ...req.body, tenantId: req.tenantId! } }), 'Supplier created', 201) } catch (e) { next(e) }
})

router.put('/:id', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const s = await prisma.supplier.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! } })
    if (!s) throw new AppError('Supplier not found', 404)
    sendSuccess(res, await prisma.supplier.update({ where: { id: req.params.id }, data: req.body }))
  } catch (e) { next(e) }
})

router.get('/purchase-orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const status = req.query.status as string | undefined
    const id     = req.query.id     as string | undefined
    const where: any = { tenantId: req.tenantId!, ...(status && { status }), ...(id && { id }) }
    const [data, total] = await Promise.all([prisma.purchaseOrder.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { items: true } }), prisma.purchaseOrder.count({ where })])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

router.post('/purchase-orders', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierId, supplierName, subtotal, tax, total, paidAmount, dueAmount, expectedDelivery, notes, status, items } = req.body
    const poNumber = await generatePONumber(req.tenantId!)
    const userBranch = await prisma.userBranch.findFirst({ where: { userId: req.user!.userId } })
    let branchId = userBranch?.branchId
    if (!branchId) {
      const firstBranch = await prisma.branch.findFirst({ where: { tenantId: req.tenantId! } })
      branchId = firstBranch?.id
    }
    if (!branchId) throw new Error('No branch found for this tenant — contact admin')
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId: req.tenantId!,
        branchId,
        poNumber,
        supplierId,
        supplierName,
        subtotal:         Number(subtotal)   || 0,
        tax:              Number(tax)        || 0,
        total:            Number(total)      || 0,
        paidAmount:       Number(paidAmount) || 0,
        dueAmount:        Number(dueAmount)  || 0,
        expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : undefined,
        notes:            notes || undefined,
        status:           status || 'DRAFT',
        items: {
          create: await Promise.all((items ?? []).map(async (item: any) => {
            let productId = item.productId || undefined
            // Fallback: resolve by name if productId not supplied
            if (!productId && item.productName) {
              const p = await prisma.product.findFirst({
                where: { tenantId: req.tenantId!, name: { equals: item.productName, mode: 'insensitive' }, isActive: true },
              })
              if (p) productId = p.id
            }
            return {
              productId,
              productName:      item.productName,
              quantity:         Number(item.quantity)         || 1,
              unitCost:         Number(item.unitCost)         || 0,
              total:            Number(item.total)            || 0,
              receivedQuantity: Number(item.receivedQuantity) || 0,
            }
          })),
        },
      },
      include: { items: true },
    })
    await recalcSupplierStats(supplierId, req.tenantId!)
    sendSuccess(res, po, 'Purchase order created', 201)
  } catch (e) { next(e) }
})

router.put('/purchase-orders/:id', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      include: { items: true },
    })
    if (!po) throw new AppError('Purchase order not found', 404)

    const newStatus = req.body.status as string | undefined

    // ── Restock inventory when marking as RECEIVED ─────────────────────────
    // Guard: check StockMovement (not PO status) so retroactive restock works
    // for POs that were RECEIVED before this fix was deployed.
    // Use po.id as reference (unique). Also filter by productId so a SM belonging to a
    // different PO that happens to share the same poNumber doesn't block this restock.
    const poProductIds = po.items.map((i: any) => i.productId).filter(Boolean)
    const alreadyRestocked = newStatus === 'RECEIVED' && poProductIds.length > 0
      ? !!(await prisma.stockMovement.findFirst({
          where: {
            type: 'PURCHASE',
            productId: { in: poProductIds },
            OR: [{ reference: po.id }, { reference: po.poNumber }],
          },
        }))
      : false

    if (newStatus === 'RECEIVED' && !alreadyRestocked) {
      try {
        // Resolve productId for items where it wasn't linked at PO creation time
        const resolvedItems = await Promise.all(
          po.items.map(async (item: any) => {
            let productId = item.productId
            let branchId  = (item as any).branchId ?? po.branchId
            if (!productId && item.productName) {
              const p = await prisma.product.findFirst({
                where: { tenantId: req.tenantId!, name: { equals: item.productName, mode: 'insensitive' }, isActive: true },
              })
              if (p) { productId = p.id; branchId = p.branchId ?? po.branchId }
            }
            if (!productId) return null
            // Ensure branchId is resolved — fall back to first branch of tenant
            if (!branchId) {
              const branch = await prisma.branch.findFirst({ where: { tenantId: req.tenantId! } })
              branchId = branch?.id
            }
            return branchId ? { ...item, productId, branchId } : null
          })
        )
        const itemsWithProduct = resolvedItems.filter(Boolean) as any[]

        if (itemsWithProduct.length > 0) {
          await Promise.all(
            itemsWithProduct.map((item: any) =>
              prisma.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              })
            )
          )
          await prisma.stockMovement.createMany({
            data: itemsWithProduct.map((item: any) => ({
              productId:   item.productId,
              branchId:    item.branchId,
              type:        'PURCHASE' as const,
              quantity:    item.quantity,
              reference:   po.id,
              note:        `Received via PO ${po.poNumber}`,
              performedBy: req.user?.userId ?? 'system',
            })),
          })
        }
      } catch (stockErr) {
        // Stock update failed — log but don't block the PO status update
        console.error('[PO receive] stock update failed:', stockErr)
      }
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: {
        status:     (newStatus ?? po.status) as any,
        paidAmount: req.body.paidAmount    ?? po.paidAmount,
        receivedAt: newStatus === 'RECEIVED' ? new Date() : (req.body.receivedAt ?? po.receivedAt),
      },
      include: { items: true },
    })

    await recalcSupplierStats(po.supplierId, req.tenantId!)
    sendSuccess(res, updated)
  } catch (e) { next(e) }
})

router.post('/:id/payments', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplier = await prisma.supplier.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! } })
    if (!supplier) throw new AppError('Supplier not found', 404)

    const { amount, method, reference, notes, poIds } = req.body
    const payAmount = Number(amount)
    if (!payAmount || payAmount <= 0) throw new AppError('Invalid payment amount', 400)

    const userBranch = await prisma.userBranch.findFirst({ where: { userId: req.user!.userId } })
    const branchId = userBranch?.branchId
    if (!branchId) throw new AppError('No branch assigned to this user', 400)

    // Fetch target POs (specified or auto-select unpaid ones FIFO)
    const poWhere: any = {
      supplierId: req.params.id,
      tenantId:   req.tenantId!,
      dueAmount:  { gt: 0 },
      ...(poIds?.length && { id: { in: poIds } }),
    }
    const unpaidPOs = await prisma.purchaseOrder.findMany({
      where:   poWhere,
      orderBy: { createdAt: 'asc' },
    })

    // Allocate payment across POs
    let remaining = payAmount
    const updates: { id: string; paidAmount: number; dueAmount: number; status: string }[] = []

    for (const po of unpaidPOs) {
      if (remaining <= 0) break
      const allocate  = Math.min(remaining, po.dueAmount)
      const newPaid   = po.paidAmount + allocate
      const newDue    = Math.max(0, po.dueAmount - allocate)
      const newStatus = newDue === 0 ? 'CLOSED' : 'PARTIAL'
      updates.push({ id: po.id, paidAmount: newPaid, dueAmount: newDue, status: newStatus })
      remaining -= allocate
    }

    // Apply PO updates
    await Promise.all(
      updates.map(u =>
        prisma.purchaseOrder.update({
          where: { id: u.id },
          data:  { paidAmount: u.paidAmount, dueAmount: u.dueAmount, status: u.status as any },
        })
      )
    )

    // Create Transaction record
    const txn = await prisma.transaction.create({
      data: {
        tenantId:      req.tenantId!,
        branchId,
        type:          'EXPENSE',
        category:      'Supplier Payment',
        amount:        payAmount,
        description:   `Payment to ${supplier.name}${reference ? ' · Ref: ' + reference : ''}`,
        paymentMethod: method || 'CASH',
        reference:     reference || undefined,
        performedBy:   req.user?.userId ?? 'system',
      },
    })

    await recalcSupplierStats(req.params.id, req.tenantId!)
    sendSuccess(res, { transaction: txn, updatedPOs: updates.length }, 'Payment recorded', 201)
  } catch (e) { next(e) }
})

export default router
