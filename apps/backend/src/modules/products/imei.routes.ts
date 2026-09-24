import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { enforceModuleAccess } from '../../middleware/module-access.middleware'
import { getPagination } from '../../utils/pagination'
import { AppError } from '../../middleware/error.middleware'
import { effectiveBranchId, assertBranchRecordAccess, resolveMutationBranchId } from '../../utils/active-branch'
import { isValidUnitSerial, normalizeSerial, serialValidationMessage } from '../../utils/serialNumber'
import { verifyTenantAdminPassword } from '../../utils/admin-password.util'

const router = Router()
router.use(authenticate)
router.use(enforceModuleAccess('IMEI'))

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const tenantId = req.tenantId!
    const status    = req.query.status as string | undefined
    const search    = req.query.search as string | undefined
    const productId = req.query.productId as string | undefined
    const branchId  = effectiveBranchId(req)
    const purchaseOrderId = req.query.purchaseOrderId as string | undefined
    // ISO timestamps from client (local day bounds) — inventory registrations for a day
    const fromRaw = typeof req.query.from === 'string' ? req.query.from.trim() : ''
    const toRaw   = typeof req.query.to === 'string' ? req.query.to.trim() : ''
    const fromAt  = fromRaw ? new Date(fromRaw) : null
    const toAt    = toRaw ? new Date(toRaw) : null
    const hasDateRange = Boolean(
      (fromAt && !Number.isNaN(fromAt.getTime())) ||
      (toAt && !Number.isNaN(toAt.getTime())),
    )
    const createdAtFilter: { gte?: Date; lte?: Date } | undefined = hasDateRange
      ? {
          ...(fromAt && !Number.isNaN(fromAt.getTime()) ? { gte: fromAt } : {}),
          ...(toAt && !Number.isNaN(toAt.getTime()) ? { lte: toAt } : {}),
        }
      : undefined

    // ── 1. Registered ImeiRecords ──────────────────────────────────────────
    const imeiWhere: any = {
      product: { tenantId },
      ...(status && { status }),
      ...(productId && { productId }),
      ...(branchId && { branchId }),
      ...(purchaseOrderId && { purchaseOrderId }),
      ...(createdAtFilter && { createdAt: createdAtFilter }),
      ...(search && { OR: [{ imei: { contains: search, mode: 'insensitive' } }] }),
    }
    const [registered, registeredTotal] = await Promise.all([
      prisma.imeiRecord.findMany({
        where: imeiWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true, brand: { select: { name: true } }, category: { select: { name: true } } } },
        },
      }),
      prisma.imeiRecord.count({ where: imeiWhere }),
    ])

    // ── 2. IMEIs from Repair Tickets not yet in ImeiRecord (unregistered) ──
    // Only show unregistered if no status filter (they have no status in ImeiRecord)
    // Skip when browsing a calendar day of inventory registrations — those are ImeiRecords only
    let unregistered: any[] = []
    if (!status && !hasDateRange) {
      const registeredImeis = new Set(registered.map((r: any) => r.imei))
      const repairImeis = await prisma.repairTicket.findMany({
        where: {
          tenantId,
          ...(branchId ? { branchId } : {}),
          imei: { not: null, ...(search ? { contains: search, mode: 'insensitive' } : {}) },
        },
        select: { imei: true, deviceBrand: true, deviceModel: true, createdAt: true, status: true },
        orderBy: { createdAt: 'desc' },
      })
      // Deduplicate — keep only first occurrence of each IMEI not in registered
      const seen = new Set<string>()
      for (const r of repairImeis) {
        if (r.imei && !registeredImeis.has(r.imei) && !seen.has(r.imei)) {
          seen.add(r.imei)
          unregistered.push({
            id:        `repair-${r.imei}`,
            imei:      r.imei,
            status:    'REPAIR_ONLY',
            createdAt: r.createdAt,
            product:   { name: `${r.deviceBrand ?? ''} ${r.deviceModel ?? ''}`.trim() || 'Unknown Device', brand: { name: r.deviceBrand ?? '—' }, category: { name: '—' } },
            _source:   'repair',
          })
        }
      }
    }

    // ── 3. Merge (newest first), paginate, respond ─────────────────────────
    const all = [...registered, ...unregistered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    const total = registeredTotal + unregistered.length
    const paged = all.slice(skip, skip + limit)
    sendPaginated(res, paged, total, page, limit)
  } catch (e) { next(e) }
})

router.get('/lookup/:imei', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const imei = req.params.imei
    const tenantId = req.tenantId!

    const record = await prisma.imeiRecord.findFirst({
      where: { imei, product: { tenantId } },
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            brand: { select: { name: true } },
            category: { select: { name: true } },
            warrantyMonths: true,
            sellingPrice: true,
          },
        },
      },
    })
    if (record) assertBranchRecordAccess(req, record.branchId)
    const branchId = record?.branchId ?? effectiveBranchId(req)

    const [repairs, exchanges, hirePurchaseAgreement] = await Promise.all([
      prisma.repairTicket.findMany({
        where: { imei, tenantId, ...(branchId && { branchId }) },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, ticketNumber: true, status: true,
          reportedIssue: true, technicianName: true,
          estimatedCost: true, actualCost: true,
          createdAt: true, updatedAt: true,
          customerName: true, customerPhone: true,
          deviceBrand: true, deviceModel: true,
          branchId: true,
        },
      }),
      prisma.deviceExchange.findMany({
        where: {
          tenantId,
          ...(branchId && { branchId }),
          OR: [{ oldImei: imei }, { newImei: imei }],
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, exchangeNumber: true, customerName: true,
          oldBrand: true, oldModel: true, newBrand: true, newModel: true,
          exchangeValue: true, newDevicePrice: true, balanceAmount: true,
          balanceDirection: true, invoiceNumber: true, createdAt: true,
          branchId: true,
        },
      }),
      prisma.hirePurchaseAgreement.findFirst({
        where: {
          tenantId,
          imei,
          ...(branchId && { branchId }),
          status: { in: ['PENDING', 'ACTIVE', 'DEFAULTED'] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          agreementNumber: true,
          status: true,
          totalPayable: true,
          paidAmount: true,
          outstandingBalance: true,
          monthlyInstallment: true,
          firstDueDate: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      }),
    ])

    if (!record && repairs.length === 0 && exchanges.length === 0) throw new AppError('IMEI not found', 404)
    if (!record && repairs.length > 0) assertBranchRecordAccess(req, repairs[0].branchId)
    if (!record && repairs.length === 0 && exchanges.length > 0) {
      assertBranchRecordAccess(req, exchanges[0].branchId)
    }

    let saleDetails: any = null
    let customerDetails: any = null
    if (record?.saleId) {
      saleDetails = await prisma.sale.findUnique({
        where: { id: record.saleId },
        select: {
          id: true, invoiceNumber: true, total: true, paidAmount: true,
          status: true, cashierName: true, createdAt: true,
          customerName: true, customerPhone: true,
        },
      }).catch(() => null)
    }
    if (record?.customerId) {
      customerDetails = await prisma.customer.findUnique({
        where: { id: record.customerId },
        select: { id: true, name: true, phone: true, email: true },
      }).catch(() => null)
    }

    sendSuccess(res, { record, repairs, saleDetails, customerDetails, exchanges, hirePurchaseAgreement })
  } catch (e) { next(e) }
})

router.post('/', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId, variation } = req.body
    const imei = typeof req.body.imei === 'string' ? normalizeSerial(req.body.imei) : ''
    const resolvedBranchId = await resolveMutationBranchId(req, { preferred: req.body.branchId })
    if (!imei || !productId) throw new AppError('serial/IMEI and productId are required', 400)
    const serialErr = serialValidationMessage(imei)
    if (serialErr) throw new AppError(serialErr, 400)
    if (!isValidUnitSerial(imei)) throw new AppError('Invalid serial / IMEI', 400)
    const existing = await prisma.imeiRecord.findUnique({ where: { imei } })
    if (existing) throw new AppError('Serial / IMEI already registered', 409)
    const product = await prisma.product.findFirst({ where: { id: productId, tenantId: req.tenantId! } })
    if (!product) throw new AppError('Product not found', 404)
    assertBranchRecordAccess(req, product.branchId)
    if (product.branchId && product.branchId !== resolvedBranchId) {
      throw new AppError('Product belongs to a different branch', 400)
    }
    const record = await prisma.imeiRecord.create({
      data: { imei, productId, branchId: resolvedBranchId, variation, status: 'IN_STOCK' },
      include: { product: { select: { name: true, brand: { select: { name: true } } } } },
    })
    sendSuccess(res, record, 'Serial / IMEI registered', 201)
  } catch (e) { next(e) }
})

router.patch('/:id/status', authorize('OWNER', 'MANAGER', 'TECHNICIAN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body
    const allowed = ['IN_STOCK', 'SOLD', 'UNDER_HIRE_PURCHASE', 'IN_REPAIR', 'UNDER_WARRANTY_CLAIM', 'SCRAPPED']
    if (!allowed.includes(status)) throw new AppError('Invalid IMEI status', 400)
    const existing = await prisma.imeiRecord.findFirst({ where: { id: req.params.id, product: { tenantId: req.tenantId! } } })
    if (!existing) throw new AppError('IMEI record not found', 404)
    assertBranchRecordAccess(req, existing.branchId)
    const activeAgreement = await prisma.hirePurchaseAgreement.findFirst({
      where: { imeiRecordId: existing.id, tenantId: req.tenantId!, status: { in: ['PENDING', 'ACTIVE', 'DEFAULTED'] } },
      select: { agreementNumber: true },
    })
    if (activeAgreement && status !== 'UNDER_HIRE_PURCHASE') {
      throw new AppError(`IMEI is locked by hire purchase agreement ${activeAgreement.agreementNumber}`, 409)
    }
    const record = await prisma.imeiRecord.update({ where: { id: req.params.id }, data: { status } })
    sendSuccess(res, record, 'Status updated')
  } catch (e) { next(e) }
})

/** Delete a serial/IMEI record — requires OWNER/MANAGER + owner admin password (same gate as sale void). */
router.post('/:id/delete', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    await verifyTenantAdminPassword(tenantId, req.body?.adminPassword)

    const existing = await prisma.imeiRecord.findFirst({
      where: { id: req.params.id, product: { tenantId } },
      include: { product: { select: { id: true, name: true, trackImei: true, stock: true } } },
    })
    if (!existing) throw new AppError('IMEI record not found', 404)
    assertBranchRecordAccess(req, existing.branchId)

    if (existing.softReservedUntil && existing.softReservedUntil.getTime() > Date.now()) {
      throw new AppError('Cannot delete — serial is soft-reserved for wholesale. Clear the reservation first.', 409)
    }

    const activeAgreement = await prisma.hirePurchaseAgreement.findFirst({
      where: {
        OR: [{ imeiRecordId: existing.id }, { imei: existing.imei }],
        tenantId,
        status: { in: ['PENDING', 'ACTIVE', 'DEFAULTED'] },
      },
      select: { agreementNumber: true },
    })
    if (activeAgreement) {
      throw new AppError(
        `Cannot delete — locked by hire purchase agreement ${activeAgreement.agreementNumber}`,
        409,
      )
    }

    const performedBy = req.user?.email || req.user?.userId || 'admin'

    await prisma.$transaction(async (tx) => {
      // Detach historical HP links (FK has no onDelete)
      await tx.hirePurchaseAgreement.updateMany({
        where: { imeiRecordId: existing.id },
        data: { imeiRecordId: null },
      })

      // If unit was counted in stock, reverse one unit
      if (existing.status === 'IN_STOCK' && existing.product.trackImei) {
        const dec = await tx.product.updateMany({
          where: { id: existing.productId, stock: { gte: 1 } },
          data: { stock: { decrement: 1 } },
        })
        if (dec.count > 0) {
          await tx.stockMovement.create({
            data: {
              productId: existing.productId,
              branchId: existing.branchId,
              type: 'ADJUSTMENT',
              quantity: -1,
              reference: existing.imei,
              note: `Serial deleted from Serial Tracker (${existing.imei})`,
              performedBy,
            },
          })
        }
      }

      await tx.imeiRecord.delete({ where: { id: existing.id } })
    })

    sendSuccess(res, { id: existing.id, imei: existing.imei }, 'Serial / IMEI deleted')
  } catch (e) { next(e) }
})

export default router
