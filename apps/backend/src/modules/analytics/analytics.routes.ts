import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const branchId = req.query.branchId as string | undefined
    const branchFilter = branchId ? { branchId } : {}
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const [todaySales, activeRepairs, totalCustomers, lowStockCount, totalRevenue] = await Promise.all([
      prisma.sale.aggregate({ where: { tenantId, ...branchFilter, createdAt: { gte: today, lte: todayEnd } }, _sum: { total: true }, _count: true }),
      prisma.repairTicket.count({ where: { tenantId, ...branchFilter, status: { notIn: ['DELIVERED', 'CANCELLED'] } } }),
      prisma.customer.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId, isActive: true, stock: { lte: 5 } } }),
      prisma.sale.aggregate({ where: { tenantId, ...branchFilter }, _sum: { total: true } }),
    ])
    sendSuccess(res, { todayRevenue: todaySales._sum.total ?? 0, todaySalesCount: todaySales._count, activeRepairs, totalCustomers, lowStockCount, totalRevenue: totalRevenue._sum.total ?? 0 })
  } catch (e) { next(e) }
})

router.get('/revenue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const days = parseInt(req.query.days as string) || 30
    const from = new Date(); from.setDate(from.getDate() - days)
    const summaries = await prisma.dailySummary.findMany({ where: { tenantId, date: { gte: from } }, orderBy: { date: 'asc' } })
    sendSuccess(res, summaries)
  } catch (e) { next(e) }
})

router.get('/top-products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!
    const limit = parseInt(req.query.limit as string) || 10
    const items = await prisma.saleItem.groupBy({
      by: ['productId', 'productName'],
      where: { sale: { tenantId } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    })
    sendSuccess(res, items.map((i: (typeof items)[number]) => ({ productId: i.productId, productName: i.productName, quantitySold: i._sum.quantity ?? 0, revenue: i._sum.total ?? 0 })))
  } catch (e) { next(e) }
})

router.get('/repairs-by-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const counts = await prisma.repairTicket.groupBy({ by: ['status'], where: { tenantId: req.tenantId! }, _count: true })
    sendSuccess(res, counts)
  } catch (e) { next(e) }
})

export default router
