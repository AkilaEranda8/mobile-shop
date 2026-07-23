import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/database'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'
import { enforceModuleAccess } from '../../middleware/module-access.middleware'
import { AppError } from '../../middleware/error.middleware'
import { getPagination } from '../../utils/pagination'
import { generateWarrantyCode } from '../../utils/counters'
import { sendMail, warrantyEmailHtml } from '../../utils/mailer'
import { effectiveBranchId, assertBranchRecordAccess, resolveMutationBranchId } from '../../utils/active-branch'
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
router.use(enforceModuleAccess('WARRANTY'))

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = effectiveBranchId(req)
    await prisma.warranty.updateMany({
      where: {
        tenantId: req.tenantId!,
        status: 'ACTIVE',
        endDate: { lt: new Date() },
        ...(branchId ? { branchId } : {}),
      },
      data:  { status: 'EXPIRED' },
    }).catch(() => {})
    const { skip, limit, page, search } = getPagination(req)
    const status = req.query.status as string | undefined
    const where: any = {
      tenantId: req.tenantId!,
      ...(branchId && { branchId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { warrantyCode: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { productName: { contains: search, mode: 'insensitive' } },
          { imei: { contains: search } },
        ],
      }),
    }
    const [data, total] = await Promise.all([
      prisma.warranty.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          claims: true,
          branch: { select: { id: true, name: true } },
        },
      }),
      prisma.warranty.count({ where }),
    ])
    sendPaginated(res, data, total, page, limit)
  } catch (e) { next(e) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.warranty.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      include: {
        claims: true,
        branch: { select: { id: true, name: true } },
      },
    })
    if (!w) throw new AppError('Warranty not found', 404)
    assertBranchRecordAccess(req, w.branchId)
    sendSuccess(res, w)
  } catch (e) { next(e) }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warrantyCode = generateWarrantyCode()
    const branchId = await resolveMutationBranchId(req, { preferred: req.body.branchId })
    const {
      customerName,
      customerPhone,
      customerId,
      productName,
      brandName,
      imei,
      quantity,
      monthsDuration,
      startDate,
      endDate,
      invoiceNumber,
      saleId,
      productId,
      status,
    } = req.body

    if (!String(customerName ?? '').trim()) throw new AppError('Customer name is required', 400)
    if (!String(productName ?? '').trim()) throw new AppError('Product name is required', 400)
    if (!startDate || !endDate) throw new AppError('Start and end dates are required', 400)

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new AppError('Invalid start or end date', 400)
    }

    const allowedStatus = new Set(['ACTIVE', 'EXPIRED', 'CLAIMED', 'VOID'])
    const nextStatus = status && allowedStatus.has(String(status)) ? String(status) : 'ACTIVE'

    const w = await prisma.warranty.create({
      data: {
        tenantId: req.tenantId!,
        branchId,
        warrantyCode,
        qrUrl: buildWarrantyQrUrl(warrantyCode),
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone ?? '').trim(),
        customerId: customerId || undefined,
        productName: String(productName).trim(),
        brandName: String(brandName ?? '').trim(),
        imei: imei ? String(imei).trim() : undefined,
        quantity: Math.max(1, Number(quantity) || 1),
        monthsDuration: Math.max(0, Number(monthsDuration) || 0),
        startDate: start,
        endDate: end,
        invoiceNumber: invoiceNumber || undefined,
        saleId: saleId || undefined,
        productId: productId || undefined,
        status: nextStatus as 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'VOID',
      },
      include: {
        claims: true,
        branch: { select: { id: true, name: true } },
      },
    })
    sendSuccess(res, w, 'Warranty created', 201)
  } catch (e) { next(e) }
})

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.warranty.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! } })
    if (!w) throw new AppError('Warranty not found', 404)
    assertBranchRecordAccess(req, w.branchId)
    const {
      customerName, customerPhone, productName, brandName, imei, quantity,
      startDate, endDate, monthsDuration, status, branchId: nextBranchRaw,
    } = req.body
    const data: any = {}
    if (customerName   !== undefined) data.customerName   = customerName
    if (customerPhone  !== undefined) data.customerPhone  = customerPhone
    if (productName    !== undefined) data.productName    = productName
    if (brandName      !== undefined) data.brandName      = brandName
    if (imei           !== undefined) data.imei           = imei
    if (quantity       !== undefined) data.quantity       = Math.max(1, Number(quantity) || 1)
    if (startDate      !== undefined) {
      const d = new Date(startDate)
      if (Number.isNaN(d.getTime())) throw new AppError('Invalid start date', 400)
      data.startDate = d
    }
    if (endDate        !== undefined) {
      const d = new Date(endDate)
      if (Number.isNaN(d.getTime())) throw new AppError('Invalid end date', 400)
      data.endDate = d
    }
    if (monthsDuration !== undefined) data.monthsDuration = Number(monthsDuration)
    if (status !== undefined) {
      const allowedStatus = new Set(['ACTIVE', 'EXPIRED', 'CLAIMED', 'VOID'])
      if (!allowedStatus.has(String(status))) throw new AppError('Invalid warranty status', 400)
      data.status = status
    }
    if (nextBranchRaw != null && String(nextBranchRaw).trim()) {
      // Destination must be assignable (any assigned branch), not only the active one
      data.branchId = await resolveMutationBranchId(req, { preferred: nextBranchRaw })
    }
    const updated = await prisma.warranty.update({
      where: { id: req.params.id },
      data,
      include: {
        claims: true,
        branch: { select: { id: true, name: true } },
      },
    })
    sendSuccess(res, updated, 'Warranty updated')
  } catch (e) { next(e) }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const w = await prisma.warranty.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! } })
    if (!w) throw new AppError('Warranty not found', 404)
    assertBranchRecordAccess(req, w.branchId)
    await prisma.warranty.delete({ where: { id: req.params.id } })
    sendSuccess(res, null, 'Warranty deleted')
  } catch (e) { next(e) }
})

router.post('/:id/claims', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warranty = await prisma.warranty.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      select: { branchId: true },
    })
    if (!warranty) throw new AppError('Warranty not found', 404)
    assertBranchRecordAccess(req, warranty.branchId)
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
    assertBranchRecordAccess(req, w.branchId)
    const claim = await prisma.warrantyClaim.findFirst({
      where: { id: req.params.claimId, warrantyId: w.id },
      select: { id: true },
    })
    if (!claim) throw new AppError('Warranty claim not found', 404)
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
    assertBranchRecordAccess(req, w.branchId)

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
