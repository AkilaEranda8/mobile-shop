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
import { emitApPaymentAccounting, emitPurchaseAccounting } from '../accounting/integration/accounting-events.service'
import { applyPurchaseOrderReceive } from '../../utils/po-receive.util'
import { businessDayRange, normalizeBusinessDate, resolveQueryDateRange } from '../../utils/date-range'

const router = Router()
router.use(authenticate)

async function resolvePoItemProduct(
  tx: Prisma.TransactionClient,
  tenantId: string,
  poBranchId: string,
  item: { productId?: string | null; productName: string },
): Promise<{ productId: string; branchId: string } | null> {
  let productId = item.productId ?? undefined
  let branchId = poBranchId

  if (!productId && item.productName) {
    const found = await tx.product.findFirst({
      where: { tenantId, name: { equals: item.productName, mode: 'insensitive' }, isActive: true },
    })
    if (found) {
      productId = found.id
      branchId = found.branchId ?? poBranchId
    }
  }
  if (!productId) return null

  if (!branchId) {
    const branch = await tx.branch.findFirst({ where: { tenantId } })
    if (branch) branchId = branch.id
  }
  if (!branchId) throw new AppError('No branch found for stock update', 400)

  return { productId, branchId }
}

function mapPoItemsForReceive(items: Array<{
  id: string
  productId: string | null
  productName: string
  quantity: number
  receivedQuantity: number
  unitCost: number | Prisma.Decimal
  sku?: string | null
  storage?: string | null
  colorName?: string | null
}>) {
  return items.map(item => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    receivedQuantity: item.receivedQuantity ?? 0,
    unitCost: Number(item.unitCost) || 0,
    sku: item.sku,
    storage: item.storage,
    colorName: item.colorName,
  }))
}

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

/** Payment register — must be registered before `/:id` routes */
router.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const supplierId = req.query.supplierId as string | undefined
    const branchId = effectiveBranchId(req)
    const { start, end } = resolveQueryDateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      defaultFrom: 'month_start',
    })

    const where: any = {
      tenantId: req.tenantId!,
      type: 'EXPENSE',
      category: 'Supplier Payment',
      ...(supplierId && { supplierId }),
      ...(branchId && { branchId }),
      OR: [
        { occurredAt: { gte: start, lte: end } },
        { AND: [{ occurredAt: null }, { createdAt: { gte: start, lte: end } }] },
      ],
    }

    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          supplier: { select: { id: true, name: true, outstandingDues: true, phone: true } },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              total: true,
              paidAmount: true,
              dueAmount: true,
              status: true,
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ])

    const data = rows.map(tx => {
      const paymentDate = tx.occurredAt ?? tx.createdAt
      return {
        id: tx.id,
        supplierId: tx.supplierId,
        supplierName: tx.supplier?.name ?? null,
        purchaseOrderId: tx.purchaseOrderId,
        purchaseInvoice: tx.purchaseOrder?.poNumber ?? null,
        amountPaid: tx.amount,
        paymentMethod: tx.paymentMethod,
        paymentDate,
        reference: tx.reference,
        description: tx.description,
        balanceDue: tx.purchaseOrder?.dueAmount
          ?? tx.supplier?.outstandingDues
          ?? 0,
        supplierOutstanding: tx.supplier?.outstandingDues ?? 0,
        poTotal: tx.purchaseOrder?.total ?? null,
        poPaidAmount: tx.purchaseOrder?.paidAmount ?? null,
        branchId: tx.branchId,
        createdAt: tx.createdAt,
      }
    })

    sendPaginated(res, data, total, page, limit)
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

    if (po.status === 'RECEIVED') {
      await prisma.$transaction(async (tx) => {
        await applyPurchaseOrderReceive({
          tx,
          tenantId: req.tenantId!,
          poId: po.id,
          poNumber: po.poNumber,
          branchId: po.branchId,
          performedBy: req.user?.userId ?? 'system',
          items: mapPoItemsForReceive(po.items),
          resolveProduct: (item) => resolvePoItemProduct(tx, req.tenantId!, po.branchId, item),
        })
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { receivedAt: new Date() },
        })
      })
      void emitPurchaseAccounting(req.tenantId!, po.id, po.branchId, req.user?.email)
    }

    await recalcSupplierStats(supplierId, req.tenantId!)
    const result = po.status === 'RECEIVED'
      ? await prisma.purchaseOrder.findFirst({ where: { id: po.id }, include: { items: true } })
      : po
    sendSuccess(res, result, 'Purchase order created', 201)
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
        await applyPurchaseOrderReceive({
          tx,
          tenantId: req.tenantId!,
          poId: po.id,
          poNumber: po.poNumber,
          branchId: po.branchId,
          performedBy: req.user?.userId ?? 'system',
          items: mapPoItemsForReceive(po.items),
          resolveProduct: (item) => resolvePoItemProduct(tx, req.tenantId!, po.branchId, item),
        })

        for (const item of po.items) {
          const resolved = await resolvePoItemProduct(tx, req.tenantId!, po.branchId, item)
          if (!resolved) continue

          const p = await tx.product.findUnique({ where: { id: resolved.productId } })
          if (!p || p.trackImei) continue

          const barcode = (await ensureProductBarcode(tx, req.tenantId!, tenantSlug, {
            id: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            sellingPrice: Number(p.sellingPrice),
            trackImei: p.trackImei,
          })) ?? ''
          if (!barcode) continue

          labelsToPrint.push({
            productId: resolved.productId,
            poItemId: item.id,
            barcode,
            name: item.productName || p.name,
            sku: item.sku?.trim() || p.sku,
            price: Number(p.sellingPrice),
            qty: item.quantity,
            trackImei: false,
          })
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

    const { amount, method, reference, notes, poIds, bankAccountId, paymentDate } = req.body
    const payAmount = Number(amount)
    if (!payAmount || payAmount <= 0) throw new AppError('Invalid payment amount', 400)

    const userBranch = await prisma.userBranch.findFirst({ where: { userId: req.user!.userId } })
    const branchId = effectiveBranchId(req) ?? userBranch?.branchId
    if (!branchId) throw new AppError('No branch assigned to this user', 400)

    let occurredAt: Date | undefined
    if (paymentDate) {
      const key = normalizeBusinessDate(String(paymentDate))
      occurredAt = businessDayRange(key).start
    }

    // CHEQUE is UI-only — store as BANK_TRANSFER
    const rawMethod = String(method || 'CASH').toUpperCase()
    const paymentMethod = (rawMethod === 'CHEQUE' ? 'BANK_TRANSFER' : rawMethod) as
      'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'WALLET' | 'CREDIT'
    if (!['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET'].includes(paymentMethod)) {
      throw new AppError('Invalid payment method', 400)
    }

    let resolvedBankAccountId: string | undefined
    if (bankAccountId) {
      const bank = await prisma.bankAccount.findFirst({
        where: { id: String(bankAccountId), tenantId: req.tenantId!, isActive: true },
        select: { id: true, name: true },
      })
      if (!bank) throw new AppError('Bank account not found', 404)
      resolvedBankAccountId = bank.id
      if (paymentMethod !== 'BANK_TRANSFER') {
        throw new AppError('Bank account can only be used with Bank Transfer / Cheque', 400)
      }
    }

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

    const primaryPoId = updates[0]?.id ?? (Array.isArray(poIds) && poIds[0] ? String(poIds[0]) : undefined)

    // Create Transaction record (cash/AP settlement — not OpEx for P&L)
    const txn = await prisma.transaction.create({
      data: {
        tenantId:         req.tenantId!,
        branchId,
        type:             'EXPENSE',
        category:         'Supplier Payment',
        amount:           payAmount,
        description:      `Payment to ${supplier.name}${reference ? ' · Ref: ' + reference : ''}${notes ? ' · ' + notes : ''}`,
        paymentMethod,
        reference:        reference || undefined,
        bankAccountId:    resolvedBankAccountId,
        supplierId:       supplier.id,
        purchaseOrderId:  primaryPoId,
        occurredAt,
        performedBy:      req.user?.userId ?? 'system',
      },
    })

    await recalcSupplierStats(req.params.id, req.tenantId!)
    void emitApPaymentAccounting(req.tenantId!, txn.id, branchId, req.user?.email)
    sendSuccess(res, { transaction: txn, updatedPOs: updates.length }, 'Payment recorded', 201)
  } catch (e) { next(e) }
})

export default router
