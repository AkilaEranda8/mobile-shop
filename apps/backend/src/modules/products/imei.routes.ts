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
    const status = req.query.status as string | undefined
    const search = req.query.search as string | undefined
    const where: any = {
      product: { tenantId: req.tenantId! },
      ...(status && { status }),
      ...(search && {
        OR: [
          { imei: { contains: search, mode: 'insensitive' } },
        ],
      }),
    }
    const [data, total] = await Promise.all([
      prisma.imeiRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true, brand: { select: { name: true } }, category: { select: { name: true } } } },
        },
      }),
      prisma.imeiRecord.count({ where }),
    ])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

router.get('/lookup/:imei', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.imeiRecord.findUnique({
      where: { imei: req.params.imei },
      include: { product: { select: { name: true, brand: { select: { name: true } }, warrantyMonths: true } } },
    })
    if (!record) throw new AppError('IMEI not found', 404)
    sendSuccess(res, record)
  } catch (e) { next(e) }
})

router.post('/', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imei, productId, branchId } = req.body
    if (!imei || !productId || !branchId) throw new AppError('imei, productId and branchId are required', 400)
    const existing = await prisma.imeiRecord.findUnique({ where: { imei } })
    if (existing) throw new AppError('IMEI already registered', 409)
    const product = await prisma.product.findFirst({ where: { id: productId, tenantId: req.tenantId! } })
    if (!product) throw new AppError('Product not found', 404)
    const record = await prisma.imeiRecord.create({
      data: { imei, productId, branchId, status: 'IN_STOCK' },
      include: { product: { select: { name: true, brand: { select: { name: true } } } } },
    })
    sendSuccess(res, record, 'IMEI registered', 201)
  } catch (e) { next(e) }
})

router.patch('/:id/status', authorize('OWNER', 'MANAGER', 'TECHNICIAN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body
    const record = await prisma.imeiRecord.update({ where: { id: req.params.id }, data: { status } })
    sendSuccess(res, record, 'Status updated')
  } catch (e) { next(e) }
})

export default router
