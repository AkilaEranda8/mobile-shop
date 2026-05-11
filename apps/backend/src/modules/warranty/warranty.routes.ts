import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateWarrantyCode } from '../../utils/counters'

const router = Router()
router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, limit, page, search } = getPagination(req)
    const status = req.query.status as string | undefined
    const where: any = { tenantId: req.tenantId!, ...(status && { status }), ...(search && { OR: [{ warrantyCode: { contains: search, mode: 'insensitive' } }, { customerName: { contains: search, mode: 'insensitive' } }, { productName: { contains: search, mode: 'insensitive' } }, { imei: { contains: search } }] }) }
    const [data, total] = await Promise.all([prisma.warranty.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { claims: true } }), prisma.warranty.count({ where })])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

router.get('/verify/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.warranty.findUnique({ where: { warrantyCode: req.params.code }, include: { claims: true } })
    if (!w) throw new AppError('Warranty not found', 404)
    sendSuccess(res, w)
  } catch (e) { next(e) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.warranty.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! }, include: { claims: true } })
    if (!w) throw new AppError('Warranty not found', 404)
    sendSuccess(res, w)
  } catch (e) { next(e) }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warrantyCode = generateWarrantyCode()
    const w = await prisma.warranty.create({ data: { ...req.body, tenantId: req.tenantId!, warrantyCode }, include: { claims: true } })
    sendSuccess(res, w, 'Warranty created', 201)
  } catch (e) { next(e) }
})

router.post('/:id/claims', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.warranty.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! } })
    if (!w) throw new AppError('Warranty not found', 404)
    const claim = await prisma.warrantyClaim.create({ data: { warrantyId: w.id, issue: req.body.issue } })
    sendSuccess(res, claim, 'Claim submitted', 201)
  } catch (e) { next(e) }
})

export default router
