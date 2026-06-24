import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateWarrantyCode } from '../../utils/counters'
import { sendMail, warrantyEmailHtml } from '../../utils/mailer'
import {
  buildWarrantyQrUrl,
  createClaim,
  verifyWarrantyByCode,
} from './warranty.service'

const router = Router()

// Public verification — no login required (warranty codes are globally unique)
router.get('/verify/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await verifyWarrantyByCode(req.params.code))
  } catch (e) { next(e) }
})

router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.warranty.updateMany({
      where: { tenantId: req.tenantId!, status: 'ACTIVE', endDate: { lt: new Date() } },
      data:  { status: 'EXPIRED' },
    }).catch(() => {})
    const { skip, limit, page, search } = getPagination(req)
    const status = req.query.status as string | undefined
    const where: any = { tenantId: req.tenantId!, ...(status && { status }), ...(search && { OR: [{ warrantyCode: { contains: search, mode: 'insensitive' } }, { customerName: { contains: search, mode: 'insensitive' } }, { productName: { contains: search, mode: 'insensitive' } }, { imei: { contains: search } }] }) }
    const [data, total] = await Promise.all([prisma.warranty.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { claims: true } }), prisma.warranty.count({ where })])
    sendPaginated(res, data, total, page, limit)
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
    const w = await prisma.warranty.create({
      data: {
        ...req.body,
        tenantId: req.tenantId!,
        warrantyCode,
        qrUrl: buildWarrantyQrUrl(warrantyCode),
      },
      include: { claims: true },
    })
    sendSuccess(res, w, 'Warranty created', 201)
  } catch (e) { next(e) }
})

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.warranty.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! } })
    if (!w) throw new AppError('Warranty not found', 404)
    const { customerName, customerPhone, productName, brandName, imei, startDate, endDate, monthsDuration, status } = req.body
    const data: any = {}
    if (customerName   !== undefined) data.customerName   = customerName
    if (customerPhone  !== undefined) data.customerPhone  = customerPhone
    if (productName    !== undefined) data.productName    = productName
    if (brandName      !== undefined) data.brandName      = brandName
    if (imei           !== undefined) data.imei           = imei
    if (startDate      !== undefined) data.startDate      = new Date(startDate)
    if (endDate        !== undefined) data.endDate        = new Date(endDate)
    if (monthsDuration !== undefined) data.monthsDuration = Number(monthsDuration)
    if (status         !== undefined) data.status         = status
    const updated = await prisma.warranty.update({ where: { id: req.params.id }, data, include: { claims: true } })
    sendSuccess(res, updated, 'Warranty updated')
  } catch (e) { next(e) }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.warranty.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! } })
    if (!w) throw new AppError('Warranty not found', 404)
    await prisma.warranty.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Warranty deleted')
  } catch (e) { next(e) }
})

router.post('/:id/claims', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const claim = await createClaim(req.tenantId!, req.params.id, {
      issue: req.body.issue,
      claimType: req.body.claimType,
    })
    sendSuccess(res, claim, 'Claim submitted', 201)
  } catch (e) { next(e) }
})

router.put('/:id/claims/:claimId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.warranty.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! } })
    if (!w) throw new AppError('Warranty not found', 404)
    const { status, resolution, assessedBy, repairTicketId } = req.body
    const data: any = {}
    if (status         !== undefined) data.status         = status
    if (resolution     !== undefined) data.resolution     = resolution
    if (assessedBy     !== undefined) data.assessedBy     = assessedBy
    if (repairTicketId !== undefined) data.repairTicketId = repairTicketId
    const updated = await prisma.warrantyClaim.update({ where: { id: req.params.claimId }, data })
    if (status === 'RESOLVED' && w.imei) {
      await prisma.imeiRecord.updateMany({
        where: { imei: w.imei },
        data: { status: 'SOLD' },
      }).catch(() => {})
    }
    sendSuccess(res, updated, 'Claim updated')
  } catch (e) { next(e) }
})

router.post('/:id/email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.warranty.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! }, include: { claims: true } })
    if (!w) throw new AppError('Warranty not found', 404)

    let to: string = req.body.email ?? ''
    if (!to && w.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: w.customerId } })
      to = customer?.email ?? ''
    }
    if (!to) throw new AppError('No email address found for this customer. Please provide one.', 400)

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId! } })
    const html   = warrantyEmailHtml(w, tenant?.name ?? 'Our Shop')
    await sendMail(to, `Your Warranty Certificate – ${w.warrantyCode}`, html)
    sendSuccess(res, { sentTo: to }, 'Warranty email sent')
  } catch (e) { next(e) }
})

export default router
