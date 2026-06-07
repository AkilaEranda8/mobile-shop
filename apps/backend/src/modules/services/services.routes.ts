import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { sendSuccess, sendError } from '../../utils/response'
import { AppError } from '../../middleware/error.middleware'

const router = Router()
router.use(authenticate)

// ── List all services for this tenant ─────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenantId
    const { category, active } = req.query as Record<string, string>
    const where: Record<string, unknown> = { tenantId }
    if (category) where.category = category
    if (active !== undefined) where.isActive = active === 'true'
    const services = await prisma.service.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
    sendSuccess(res, services)
  } catch (e) { next(e) }
})

// ── List distinct categories ───────────────────────────────────────────────────
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenantId
    const rows = await prisma.service.findMany({
      where: { tenantId, isActive: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    })
    sendSuccess(res, rows.map((r: { category: string }) => r.category))
  } catch (e) { next(e) }
})

// ── Get single service ─────────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenantId
    const service = await prisma.service.findFirst({ where: { id: req.params.id, tenantId } })
    if (!service) throw new AppError('Service not found', 404)
    sendSuccess(res, service)
  } catch (e) { next(e) }
})

// ── Create service ─────────────────────────────────────────────────────────────
router.post('/', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenantId
    const { name, description, price, cost, category } = req.body
    if (!name || price === undefined) throw new AppError('name and price are required', 400)
    const service = await prisma.service.create({
      data: {
        tenantId,
        name,
        description,
        price: Number(price),
        cost: cost !== undefined ? Number(cost) : 0,
        category: category || 'General',
      },
    })
    sendSuccess(res, service, 'Service created')
  } catch (e) { next(e) }
})

// ── Update service ─────────────────────────────────────────────────────────────
router.put('/:id', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenantId
    const existing = await prisma.service.findFirst({ where: { id: req.params.id, tenantId } })
    if (!existing) throw new AppError('Service not found', 404)
    const { name, description, price, cost, category, isActive } = req.body
    const service = await prisma.service.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(cost !== undefined && { cost: Number(cost) }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive }),
      },
    })
    sendSuccess(res, service, 'Service updated')
  } catch (e) { next(e) }
})

// ── Delete service ─────────────────────────────────────────────────────────────
router.delete('/:id', authorize('OWNER', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenantId
    const existing = await prisma.service.findFirst({ where: { id: req.params.id, tenantId } })
    if (!existing) throw new AppError('Service not found', 404)
    await prisma.service.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Service deleted')
  } catch (e) { next(e) }
})

export default router
