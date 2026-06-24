import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { getPagination } from '../../utils/pagination'
import { AppError } from '../../middleware/error.middleware'

const router = Router()
router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page } = getPagination(req)
    const tenantId = req.tenantId!
    const status    = req.query.status as string | undefined
    const search    = req.query.search as string | undefined
    const productId = req.query.productId as string | undefined

    // ── 1. Registered ImeiRecords ──────────────────────────────────────────
    const imeiWhere: any = {
      product: { tenantId },
      ...(status && { status }),
      ...(productId && { productId }),
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
    let unregistered: any[] = []
    if (!status) {
      const registeredImeis = new Set(registered.map((r: any) => r.imei))
      const repairImeis = await prisma.repairTicket.findMany({
        where: {
          tenantId,
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

    // ── 3. Merge, paginate, respond ────────────────────────────────────────
    const all   = [...registered, ...unregistered]
    const total = registeredTotal + unregistered.length
    const paged = all.slice(skip, skip + limit)
    sendPaginated(res, paged, total, page, limit)
  } catch (e) { next(e) }
})

router.get('/lookup/:imei', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const imei = req.params.imei
    const tenantId = req.tenantId!

    const [record, repairs] = await Promise.all([
      prisma.imeiRecord.findFirst({
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
      }),
      prisma.repairTicket.findMany({
        where: { imei, tenantId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, ticketNumber: true, status: true,
          reportedIssue: true, technicianName: true,
          estimatedCost: true, actualCost: true,
          createdAt: true, updatedAt: true,
          customerName: true, customerPhone: true,
          deviceBrand: true, deviceModel: true,
        },
      }),
    ])

    if (!record && repairs.length === 0) throw new AppError('IMEI not found', 404)

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

    sendSuccess(res, { record, repairs, saleDetails, customerDetails })
  } catch (e) { next(e) }
})

router.post('/', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imei, productId, branchId, variation } = req.body
    if (!imei || !productId || !branchId) throw new AppError('imei, productId and branchId are required', 400)
    const existing = await prisma.imeiRecord.findUnique({ where: { imei } })
    if (existing) throw new AppError('IMEI already registered', 409)
    const product = await prisma.product.findFirst({ where: { id: productId, tenantId: req.tenantId! } })
    if (!product) throw new AppError('Product not found', 404)
    const record = await prisma.imeiRecord.create({
      data: { imei, productId, branchId, variation, status: 'IN_STOCK' },
      include: { product: { select: { name: true, brand: { select: { name: true } } } } },
    })
    sendSuccess(res, record, 'IMEI registered', 201)
  } catch (e) { next(e) }
})

router.patch('/:id/status', authorize('OWNER', 'MANAGER', 'TECHNICIAN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body
    const existing = await prisma.imeiRecord.findFirst({ where: { id: req.params.id, product: { tenantId: req.tenantId! } } })
    if (!existing) throw new AppError('IMEI record not found', 404)
    const record = await prisma.imeiRecord.update({ where: { id: req.params.id }, data: { status } })
    sendSuccess(res, record, 'Status updated')
  } catch (e) { next(e) }
})

export default router
