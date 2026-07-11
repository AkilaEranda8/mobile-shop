import { Router, Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generatePONumber } from '../../utils/counters'
import { buildLabelsFromPoItems, ensureProductBarcode } from '../../utils/po-labels.util'
import { effectiveBranchId } from '../../utils/active-branch'
import { emitPurchaseAccounting } from '../accounting/integration/accounting-events.service'
import {
  applyPoReceiveToVariations,
  hasVariants,
} from '../../utils/product-variants'

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
    const branchId = effectiveBranchId(req)
    const where: any = { tenantId: req.tenantId!, ...(status && { status }), ...(id && { id }), ...(branchId && { branchId }) }
    const [raw, total] = await Promise.all([
      prisma.purchaseOrder.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { items: true } }),
      prisma.purchaseOrder.count({ where }),
    ])
    const poIds = raw.map(p => p.id)
    const counts = poIds.length
      ? await prisma.imeiRecord.groupBy({
          by: ['purchaseOrderId'],
          where: { purchaseOrderId: { in: poIds } },
          _count: { _all: true },
        })
      : []
    const countMap = new Map(counts.map(c => [c.purchaseOrderId!, c._count._all]))
    const data = raw.map(po => ({ ...po, imeiRegisteredCount: countMap.get(po.id) ?? 0 }))
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

router.post('/purchase-orders', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierId, supplierName, subtotal, tax, total, paidAmount, dueAmount, expectedDelivery, notes, status, items, branchId: bodyBranchId } = req.body
    const poNumber = await generatePONumber(req.tenantId!)
    let branchId: string | undefined = bodyBranchId
    if (branchId) {
      const valid = await prisma.branch.findFirst({ where: { id: branchId, tenantId: req.tenantId! } })
      if (!valid) branchId = undefined
    }
    if (!branchId) {
      const userBranch = await prisma.userBranch.findFirst({ where: { userId: req.user!.userId } })
      branchId = userBranch?.branchId
    }
    if (!branchId) {
      const firstBranch = await prisma.branch.findFirst({ where: { tenantId: req.tenantId! } })
      branchId = firstBranch?.id
    }
    if (!branchId) throw new AppError('No branch found for this tenant — contact admin', 400)
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
              storage:          item.storage   || undefined,
              colorName:        item.colorName || undefined,
              sku:              item.sku       || undefined,
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

router.get('/purchase-orders/:id/labels', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, tenantId },
      include: { items: true },
    })
    if (!po) throw new AppError('Purchase order not found', 404)
    if (!['RECEIVED', 'CLOSED'].includes(po.status)) {
      throw new AppError('Receive this PO first, then print barcodes', 400)
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } })
    const tenantSlug = tenant?.slug ?? 'tenant'

    const resolved: Array<typeof po.items[0] & { productId: string }> = []
    for (const item of po.items) {
      let productId = item.productId as string | null
      if (!productId && item.productName) {
        const found = await prisma.product.findFirst({
          where: { tenantId, name: { equals: item.productName, mode: 'insensitive' }, isActive: true },
        })
        if (found) productId = found.id
      }
      if (productId) resolved.push({ ...item, productId })
    }

    const productIds = [...new Set(resolved.map(i => i.productId))]
    if (!productIds.length) throw new AppError('No products linked on this PO', 400)

    await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: productIds } } })
      for (const p of products) {
        if (!p.trackImei) {
          await ensureProductBarcode(tx, tenantId, tenantSlug, {
            id: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            sellingPrice: Number(p.sellingPrice),
            trackImei: p.trackImei,
          })
        }
      }
    })

    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
    const productMap = new Map(products.map(p => [p.id, {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      sellingPrice: Number(p.sellingPrice),
      trackImei: p.trackImei,
    }]))

    const labelsToPrint = buildLabelsFromPoItems(resolved, productMap)
    sendSuccess(res, { poNumber: po.poNumber, labelsToPrint })
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
    const isReceiving = newStatus === 'RECEIVED' && po.status !== 'RECEIVED'

    if (isReceiving) {
      const labelsToPrint: Array<{
        productId: string
        poItemId: string
        barcode: string
        name: string
        sku: string
        price: number
        qty: number
        trackImei: boolean
      }> = []

      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId! },
        select: { slug: true },
      })
      const tenantSlug = tenant?.slug ?? 'tenant'

      await prisma.$transaction(async (tx) => {
        const resolvedItems: { item: typeof po.items[0]; productId: string; branchId: string }[] = []
        for (const item of po.items) {
          let productId = (item.productId as string | null) || undefined
          let branchId  = po.branchId

          if (!productId && item.productName) {
            const found = await tx.product.findFirst({
              where: { tenantId: req.tenantId!, name: { equals: item.productName, mode: 'insensitive' }, isActive: true },
            })
            if (found) { productId = found.id; branchId = found.branchId ?? po.branchId }
          }
          if (!productId) throw new AppError(`Cannot receive PO: product not linked for "${item.productName}"`, 400)

          if (!branchId) {
            const branch = await tx.branch.findFirst({ where: { tenantId: req.tenantId! } })
            if (branch) branchId = branch.id
          }
          if (!branchId) throw new AppError('No branch found for stock update', 400)

          resolvedItems.push({ item, productId, branchId })
        }

        const byProduct = new Map<string, typeof resolvedItems>()
        for (const r of resolvedItems) {
          if (!byProduct.has(r.productId)) byProduct.set(r.productId, [])
          byProduct.get(r.productId)!.push(r)
        }

        for (const [productId, group] of byProduct) {
          const p = await tx.product.findUnique({ where: { id: productId } })
          if (!p) throw new AppError(`Product ${productId} not found during receive`, 404)

          const totalQty = group.reduce((s, r) => s + r.item.quantity, 0)
          let updatedVariations: Prisma.JsonValue = p.storageVariations

          if (hasVariants(updatedVariations)) {
            for (const { item } of group) {
              const result = applyPoReceiveToVariations(updatedVariations, {
                sku: item.sku,
                storage: item.storage,
                colorName: item.colorName,
              }, item.quantity)
              updatedVariations = result.variations as Prisma.JsonValue
            }
          }

          const productUpdate: Prisma.ProductUpdateInput = {
            stock: p.trackImei ? { increment: totalQty } : p.stock + totalQty,
          }

          if (hasVariants(updatedVariations)) {
            productUpdate.storageVariations = updatedVariations as Prisma.InputJsonValue
          }

          await tx.product.update({
            where: { id: productId },
            data: productUpdate,
          })

          const branchId = group[0].branchId
          await tx.stockMovement.createMany({
            data: group.map(({ item }) => ({
              productId,
              branchId,
              type:        'PURCHASE' as const,
              quantity:    item.quantity,
              reference:   `${po.id}:${item.id}`,
              note:        `Received via PO ${po.poNumber} (${item.sku ?? item.storage ?? item.productName})`,
              performedBy: req.user?.userId ?? 'system',
            })),
          })

          let barcode = ''
          if (!p.trackImei) {
            barcode = (await ensureProductBarcode(tx, req.tenantId!, tenantSlug, {
              id: p.id,
              name: p.name,
              sku: p.sku,
              barcode: p.barcode,
              sellingPrice: Number(p.sellingPrice),
              trackImei: p.trackImei,
            })) ?? ''
          }

          if (!p.trackImei && barcode) {
            for (const { item } of group) {
              labelsToPrint.push({
                productId,
                poItemId: item.id,
                barcode,
                name: item.productName || p.name,
                sku: item.sku?.trim() || p.sku,
                price: Number(p.sellingPrice),
                qty: item.quantity,
                trackImei: false,
              })
            }
          }

          for (const { item } of group) {
            await tx.pOItem.update({
              where: { id: item.id },
              data:  { receivedQuantity: item.quantity },
            })
          }
        }

        await tx.purchaseOrder.update({
          where: { id: req.params.id },
          data: {
            status:     'RECEIVED',
            receivedAt: new Date(),
            paidAmount: req.body.paidAmount ?? po.paidAmount,
          },
        })
      })

      await recalcSupplierStats(po.supplierId, req.tenantId!)
      const updated = await prisma.purchaseOrder.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
        include: { items: true },
      })
      void emitPurchaseAccounting(req.tenantId!, req.params.id, po.branchId, req.user?.email)
      return sendSuccess(res, { ...updated, labelsToPrint })
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

router.post('/purchase-orders/:id/register-imei', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, tenantId },
      include: { items: true },
    })
    if (!po) throw new AppError('Purchase order not found', 404)
    if (po.status !== 'RECEIVED' && po.status !== 'CLOSED') {
      throw new AppError('PO must be received before registering IMEIs', 400)
    }

    const entries: {
      productId?: string
      productName?: string
      branchId: string
      imei: string
      variation?: string | null
      poItemId?: string
    }[] = req.body.items ?? []
    if (!entries.length) throw new AppError('No IMEI entries provided', 400)

    const results = { created: 0, skipped: 0, errors: [] as string[] }

    const resolveProduct = async (entry: typeof entries[number]) => {
      if (entry.productId) {
        const p = await prisma.product.findFirst({ where: { id: entry.productId, tenantId } })
        if (p) return p
      }
      if (entry.productName) {
        return prisma.product.findFirst({
          where: { tenantId, name: { equals: entry.productName, mode: 'insensitive' }, isActive: true },
        })
      }
      const poItem = entry.poItemId ? po.items.find(i => i.id === entry.poItemId) : undefined
      if (poItem?.productName) {
        return prisma.product.findFirst({
          where: { tenantId, name: { equals: poItem.productName, mode: 'insensitive' }, isActive: true },
        })
      }
      return null
    }

    const matchPoItem = (productId: string, variation?: string | null, poItemId?: string) => {
      if (poItemId) {
        const byId = po.items.find(i => i.id === poItemId)
        if (byId) return byId
      }
      return po.items.find(i => {
        if (i.productId && i.productId !== productId) return false
        if (!i.productId) return true
        if (!variation) return true
        const label = i.sku || `${i.storage ?? ''}::${i.colorName ?? ''}`
        return !label || label === variation
      })
    }

    for (const entry of entries) {
      const { branchId, imei, variation, poItemId } = entry
      const trimmed = (imei ?? '').trim()
      if (!trimmed || !/^\d{15}$/.test(trimmed)) { results.errors.push(`Invalid IMEI: ${imei}`); continue }
      if (!branchId) { results.errors.push(`Missing branch for IMEI ${trimmed}`); continue }

      const product = await resolveProduct(entry)
      if (!product) { results.errors.push(`Product not found for IMEI ${trimmed}`); continue }
      if (!product.trackImei) { results.errors.push(`${product.name} does not track IMEI`); continue }

      const poItem = matchPoItem(product.id, variation, poItemId)
      if (poItem && !poItem.productId) {
        await prisma.pOItem.update({ where: { id: poItem.id }, data: { productId: product.id } })
      }

      const existing = await prisma.imeiRecord.findUnique({ where: { imei: trimmed } })
      if (existing) { results.skipped++; continue }

      await prisma.imeiRecord.create({
        data: {
          imei: trimmed,
          productId: product.id,
          branchId,
          variation: variation ?? undefined,
          purchaseOrderId: po.id,
          poItemId: poItem?.id,
          status: 'IN_STOCK',
        },
      })
      results.created++
    }

    const linkedIds = po.items.map(i => i.productId).filter(Boolean) as string[]
    const unlinkedNames = po.items.filter(i => !i.productId).map(i => i.productName)
    const [linkedProducts, unlinkedProducts] = await Promise.all([
      linkedIds.length
        ? prisma.product.findMany({ where: { tenantId, id: { in: linkedIds } }, select: { id: true, trackImei: true, name: true } })
        : Promise.resolve([]),
      unlinkedNames.length
        ? prisma.product.findMany({
            where: { tenantId, isActive: true, OR: unlinkedNames.map(n => ({ name: { equals: n, mode: 'insensitive' as const } })) },
            select: { id: true, trackImei: true, name: true },
          })
        : Promise.resolve([]),
    ])
    const productById = new Map(linkedProducts.map(p => [p.id, p]))
    const productByName = new Map(unlinkedProducts.map(p => [p.name.toLowerCase(), p]))

    let expected = 0
    for (const item of po.items) {
      const p = item.productId
        ? productById.get(item.productId)
        : productByName.get(item.productName.toLowerCase())
      if (p?.trackImei) expected += item.quantity
    }

    const registered = await prisma.imeiRecord.count({ where: { purchaseOrderId: po.id } })
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data:  { imeisRegisteredAt: expected > 0 && registered >= expected ? new Date() : null },
    })

    sendSuccess(res, { ...results, registered, expected }, `${results.created} IMEI(s) registered, ${results.skipped} skipped`)
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
