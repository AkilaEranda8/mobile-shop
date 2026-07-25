import { Router, type Request, type Response, type NextFunction } from 'express'
import { Prisma, type PaymentMethod } from '@prisma/client'
import { prisma } from '../../config/database'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { enforceModuleAccess, requireModuleAccess } from '../../middleware/module-access.middleware'
import { AppError } from '../../middleware/error.middleware'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { effectiveBranchId, resolveMutationBranchId, assertBranchRecordAccess } from '../../utils/active-branch'
import { isTenantFeatureEnabled } from '../../utils/tenant-feature.util'
import { getPagination } from '../../utils/pagination'
import { generateInvoiceNumber } from '../../utils/counters'
import { assertBusinessDayOpenIfEnabled } from '../daily-closing/day-lock.util'
import { calculateEarlySettlement, calculateHirePurchase } from './hp-calc.util'
import { whatsappService } from '../whatsapp/whatsapp.service'
import { sendMail } from '../../utils/mailer'
import {
  emitHirePurchaseAgreementAccounting,
  emitHirePurchasePaymentAccounting,
} from '../accounting/integration/accounting-events.service'

const router = Router()
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const ACTIVE_STATUSES = ['PENDING', 'ACTIVE', 'DEFAULTED'] as const
const PAYMENT_METHODS = new Set(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'CHEQUE'])
const HP_ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'RECEIVE_PAYMENT', 'CANCEL', 'EXPORT_REPORTS', 'EDIT_SETTINGS'] as const
type HpAction = (typeof HP_ACTIONS)[number]
const DEFAULT_ACTIONS: Record<string, HpAction[]> = {
  OWNER: [...HP_ACTIONS],
  MANAGER: [...HP_ACTIONS],
  CASHIER: ['VIEW', 'CREATE', 'RECEIVE_PAYMENT'],
  TECHNICIAN: ['VIEW'],
}

async function requireFeature(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!(await isTenantFeatureEnabled(req.tenantId!, 'HIRE_PURCHASE'))) {
      throw new AppError('Hire Purchase is not enabled for this tenant', 403)
    }
    next()
  } catch (error) {
    next(error)
  }
}

async function assertHpAction(req: Request, action: HpAction, preferredBranchId?: string) {
  const role = req.user?.role ?? ''
  if (role === 'PLATFORM_ADMIN' || role === 'OWNER') return
  const branchId = preferredBranchId ?? effectiveBranchId(req)
  const settings = await prisma.hirePurchaseSettings.findFirst({
    where: { tenantId: req.tenantId!, ...(branchId ? { branchId } : {}) },
    select: { rolePermissions: true },
  })
  const matrix = (settings?.rolePermissions ?? {}) as Record<string, Record<string, boolean>>
  const configured = matrix[role]?.[action]
  const allowed = typeof configured === 'boolean' ? configured : (DEFAULT_ACTIONS[role] ?? []).includes(action)
  if (!allowed) throw new AppError(`Your role cannot perform Hire Purchase action: ${action}`, 403)
}

function requireHpAction(action: HpAction) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try { await assertHpAction(req, action); next() } catch (error) { next(error) }
  }
}

function actor(req: Request) {
  return { id: req.user?.userId, email: req.user?.email }
}

async function writeLog(
  tx: Prisma.TransactionClient,
  req: Request,
  branchId: string,
  action: string,
  agreementId?: string,
  beforeJson?: unknown,
  afterJson?: unknown,
  metadata?: unknown,
) {
  const user = actor(req)
  await tx.hirePurchaseLog.create({
    data: {
      tenantId: req.tenantId!,
      branchId,
      agreementId,
      action,
      actorId: user.id,
      actorEmail: user.email,
      beforeJson: beforeJson as Prisma.InputJsonValue | undefined,
      afterJson: afterJson as Prisma.InputJsonValue | undefined,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  })
}

function agreementNumber() {
  const now = new Date()
  const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`
  return `HP-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

function receiptNumber() {
  return `HPR-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function parseDate(value: unknown, label: string): Date {
  const date = new Date(String(value ?? ''))
  if (Number.isNaN(date.getTime())) throw new AppError(`${label} is invalid`, 400)
  return date
}

async function loadAgreement(req: Request, id: string) {
  const agreement = await prisma.hirePurchaseAgreement.findFirst({
    where: { id, tenantId: req.tenantId! },
    include: {
      customer: true,
      installments: { orderBy: { sequence: 'asc' } },
      payments: { orderBy: { occurredAt: 'desc' } },
      guarantors: true,
      documents: true,
      penalties: true,
      branch: { select: { id: true, name: true } },
      salesPerson: { select: { id: true, name: true } },
    },
  })
  if (!agreement) throw new AppError('Hire purchase agreement not found', 404)
  assertBranchRecordAccess(req, agreement.branchId)
  return agreement
}

router.use(authenticate)
router.use(enforceModuleAccess('HIRE_PURCHASE'))
router.use(requireFeature)

router.post('/calculate', async (req, res, next) => {
  try {
    sendSuccess(res, calculateHirePurchase({
      cashPrice: req.body.cashPrice,
      downPayment: req.body.downPayment,
      interestType: req.body.interestType || 'FLAT',
      interestRate: req.body.interestRate,
      processingFee: req.body.processingFee,
      insuranceFee: req.body.insuranceFee,
      documentFee: req.body.documentFee,
      otherCharges: req.body.otherCharges,
      installmentMonths: req.body.installmentMonths,
      firstDueDate: req.body.firstDueDate,
    }))
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(error instanceof Error ? error.message : 'Calculation failed', 400))
  }
})

router.get('/dashboard', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!
    const branchId = effectiveBranchId(req)
    const branchWhere = branchId ? { branchId } : {}
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const week = new Date(today); week.setUTCDate(week.getUTCDate() + 7)
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))

    const [agreements, todayCollections, monthlyCollections, dueToday, dueTomorrow, dueWeek, overdue, recentPayments] = await Promise.all([
      prisma.hirePurchaseAgreement.groupBy({
        by: ['status'],
        where: { tenantId, ...branchWhere },
        _count: { id: true },
        _sum: { outstandingBalance: true },
      }),
      prisma.hirePurchasePayment.aggregate({ where: { tenantId, ...branchWhere, status: 'COMPLETED', occurredAt: { gte: today, lt: tomorrow } }, _sum: { amount: true } }),
      prisma.hirePurchasePayment.aggregate({ where: { tenantId, ...branchWhere, status: 'COMPLETED', occurredAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.hirePurchaseInstallment.aggregate({ where: { tenantId, ...branchWhere, dueDate: today, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }, _sum: { outstanding: true }, _count: { id: true } }),
      prisma.hirePurchaseInstallment.aggregate({ where: { tenantId, ...branchWhere, dueDate: tomorrow, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }, _sum: { outstanding: true }, _count: { id: true } }),
      prisma.hirePurchaseInstallment.aggregate({ where: { tenantId, ...branchWhere, dueDate: { gte: today, lt: week }, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }, _sum: { outstanding: true }, _count: { id: true } }),
      prisma.hirePurchaseInstallment.aggregate({ where: { tenantId, ...branchWhere, dueDate: { lt: today }, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }, _sum: { outstanding: true }, _count: { id: true } }),
      prisma.hirePurchasePayment.findMany({ where: { tenantId, ...branchWhere, status: 'COMPLETED', occurredAt: { gte: trendStart } }, select: { amount: true, occurredAt: true } }),
    ])
    const byStatus = Object.fromEntries(agreements.map(row => [row.status, row._count.id]))
    const collectionTrend = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1))
      const amount = recentPayments
        .filter(payment => payment.occurredAt.getUTCFullYear() === date.getUTCFullYear() && payment.occurredAt.getUTCMonth() === date.getUTCMonth())
        .reduce((sum, payment) => sum + payment.amount, 0)
      return { month: date.toLocaleString('en', { month: 'short' }), amount: round2(amount) }
    })
    sendSuccess(res, {
      totalAgreements: agreements.reduce((sum, row) => sum + row._count.id, 0),
      activeAgreements: byStatus.ACTIVE ?? 0,
      completedAgreements: byStatus.COMPLETED ?? 0,
      defaultedAgreements: byStatus.DEFAULTED ?? 0,
      outstandingAmount: round2(agreements.reduce((sum, row) => sum + Number(row._sum.outstandingBalance ?? 0), 0)),
      todayCollections: round2(Number(todayCollections._sum.amount ?? 0)),
      monthlyCollections: round2(Number(monthlyCollections._sum.amount ?? 0)),
      dueToday: { count: dueToday._count.id, amount: round2(Number(dueToday._sum.outstanding ?? 0)) },
      dueTomorrow: { count: dueTomorrow._count.id, amount: round2(Number(dueTomorrow._sum.outstanding ?? 0)) },
      dueThisWeek: { count: dueWeek._count.id, amount: round2(Number(dueWeek._sum.outstanding ?? 0)) },
      overdue: { count: overdue._count.id, amount: round2(Number(overdue._sum.outstanding ?? 0)) },
      collectionTrend,
    })
  } catch (error) { next(error) }
})

router.get('/agreements', async (req, res, next) => {
  try {
    const { skip, limit, page, search } = getPagination(req)
    const branchId = effectiveBranchId(req)
    const status = req.query.status as any
    const where: Prisma.HirePurchaseAgreementWhereInput = {
      tenantId: req.tenantId!,
      ...(branchId ? { branchId } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { agreementNumber: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { customer: { phone: { contains: search } } },
          { customerNic: { contains: search, mode: 'insensitive' } },
          { imei: { contains: search } },
        ],
      } : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.hirePurchaseAgreement.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { customer: { select: { id: true, name: true, phone: true } }, branch: { select: { id: true, name: true } }, _count: { select: { installments: true, payments: true } } },
      }),
      prisma.hirePurchaseAgreement.count({ where }),
    ])
    sendPaginated(res, rows, total, page, limit)
  } catch (error) { next(error) }
})

router.get('/agreements/:id', async (req, res, next) => {
  try { sendSuccess(res, await loadAgreement(req, req.params.id)) } catch (error) { next(error) }
})

router.post('/agreements', requireModuleAccess('HIRE_PURCHASE', 'edit'), requireHpAction('CREATE'), async (req, res, next) => {
  try {
    const branchId = await resolveMutationBranchId(req, { preferred: req.body.branchId })
    const customer = await prisma.customer.findFirst({ where: { id: req.body.customerId, tenantId: req.tenantId!, branchId } })
    if (!customer) throw new AppError('Customer not found on this branch', 404)
    const duplicate = await prisma.hirePurchaseAgreement.findFirst({ where: { tenantId: req.tenantId!, branchId, imei: String(req.body.imei), status: { in: [...ACTIVE_STATUSES] } } })
    if (duplicate) throw new AppError(`IMEI is already linked to ${duplicate.agreementNumber}`, 409)
    if (req.body.saleId) {
      const sale = await prisma.sale.findFirst({ where: { id: req.body.saleId, tenantId: req.tenantId!, branchId } })
      if (!sale) throw new AppError('Linked sale not found on this branch', 404)
    }
    if (req.body.productId) {
      const product = await prisma.product.findFirst({ where: { id: req.body.productId, tenantId: req.tenantId!, branchId } })
      if (!product) throw new AppError('Product not found on this branch', 404)
    }
    const calc = calculateHirePurchase({ ...req.body, firstDueDate: req.body.firstDueDate })
    const number = agreementNumber()
    const created = await prisma.$transaction(async tx => {
      if (req.body.imeiRecordId) {
        const lock = await tx.imeiRecord.updateMany({ where: { id: req.body.imeiRecordId, branchId, status: 'IN_STOCK' }, data: { status: 'UNDER_HIRE_PURCHASE', customerId: customer.id } })
        if (lock.count !== 1) throw new AppError('IMEI is unavailable or already reserved', 409)
      }
      const agreement = await tx.hirePurchaseAgreement.create({
        data: {
          tenantId: req.tenantId!, branchId, agreementNumber: number, customerId: customer.id,
          saleId: req.body.saleId || undefined, productId: req.body.productId || undefined,
          imeiRecordId: req.body.imeiRecordId || undefined, salesPersonId: req.body.salesPersonId || req.user?.userId,
          productName: String(req.body.productName), brandName: req.body.brandName, modelName: req.body.modelName,
          imei: String(req.body.imei), color: req.body.color, storage: req.body.storage,
          cashPrice: calc.cashPrice, downPayment: calc.downPayment, financeAmount: calc.financeAmount,
          interestType: req.body.interestType || 'FLAT', interestRate: Number(req.body.interestRate) || 0,
          interestAmount: calc.interestAmount, processingFee: Number(req.body.processingFee) || 0,
          insuranceFee: Number(req.body.insuranceFee) || 0, documentFee: Number(req.body.documentFee) || 0,
          otherCharges: Number(req.body.otherCharges) || 0, installmentMonths: Number(req.body.installmentMonths),
          monthlyInstallment: calc.monthlyInstallment, totalPayable: calc.totalPayable,
          outstandingBalance: calc.totalPayable, gracePeriodDays: Number(req.body.gracePeriodDays) || 0,
          lateFee: Number(req.body.lateFee) || 0, dueDay: Number(req.body.dueDay) || new Date(req.body.firstDueDate).getUTCDate(),
          firstDueDate: parseDate(req.body.firstDueDate, 'First due date'), customerNic: req.body.customerNic,
          customerDob: req.body.customerDob ? parseDate(req.body.customerDob, 'Customer date of birth') : undefined,
          occupation: req.body.occupation, monthlyIncome: req.body.monthlyIncome ? Number(req.body.monthlyIncome) : undefined,
          employer: req.body.employer, status: req.body.status || 'PENDING',
          qrCode: `/hire-purchase/agreements/${number}`, barcode: number,
          installments: { create: calc.schedule.map(line => ({ tenantId: req.tenantId!, branchId, ...line })) },
          guarantors: Array.isArray(req.body.guarantors) ? { create: req.body.guarantors.map((g: any) => ({ tenantId: req.tenantId!, branchId, name: g.name, nic: g.nic, phone: g.phone, address: g.address, relationship: g.relationship, photoUrl: g.photoUrl, nicFrontUrl: g.nicFrontUrl, nicBackUrl: g.nicBackUrl })) } : undefined,
        },
        include: { installments: true, guarantors: true },
      })
      await writeLog(tx, req, branchId, 'AGREEMENT_CREATED', agreement.id, undefined, agreement)
      return agreement
    })
    sendSuccess(res, created, 'Hire purchase agreement created', 201)
  } catch (error) { next(error instanceof AppError ? error : new AppError(error instanceof Error ? error.message : 'Agreement creation failed', 400)) }
})

router.post('/from-pos', requireModuleAccess('HIRE_PURCHASE', 'edit'), requireHpAction('CREATE'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!
    const branchId = await resolveMutationBranchId(req, { preferred: req.body.branchId })
    await assertBusinessDayOpenIfEnabled(tenantId, branchId, new Date())
    const device = req.body.device ?? {}
    const imei = String(device.imei ?? '').trim()
    if (!imei) throw new AppError('IMEI is required for hire purchase', 400)
    const imeiRecord = await prisma.imeiRecord.findFirst({
      where: { imei, branchId, status: 'IN_STOCK', product: { tenantId } },
      include: { product: { include: { brand: true } } },
    })
    if (!imeiRecord) throw new AppError('IMEI is unavailable or already sold/reserved', 409)

    let customerId = String(req.body.customerId ?? '')
    if (!customerId) {
      const customerInput = req.body.customer ?? {}
      if (!customerInput.name || !customerInput.phone) throw new AppError('Customer name and phone are required', 400)
      const created = await prisma.customer.create({
        data: { tenantId, branchId, name: customerInput.name, phone: customerInput.phone, email: customerInput.email, address: customerInput.address, city: customerInput.city },
      })
      customerId = created.id
    }
    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId, branchId } })
    if (!customer) throw new AppError('Customer not found on this branch', 404)

    const calc = calculateHirePurchase({ ...req.body.finance, firstDueDate: req.body.finance?.firstDueDate })
    const invoiceNumber = await generateInvoiceNumber(tenantId)
    const number = agreementNumber()
    const downMethod = String(req.body.downPaymentMethod || 'CASH').toUpperCase()
    if (!PAYMENT_METHODS.has(downMethod)) throw new AppError('Invalid down payment method', 400)

    const result = await prisma.$transaction(async tx => {
      const locked = await tx.imeiRecord.updateMany({ where: { id: imeiRecord.id, status: 'IN_STOCK' }, data: { status: 'UNDER_HIRE_PURCHASE', customerId } })
      if (locked.count !== 1) throw new AppError('IMEI was reserved by another transaction', 409)
      const sale = await tx.sale.create({
        data: {
          tenantId, branchId, invoiceNumber, customerId, customerName: customer.name, customerPhone: customer.phone,
          subtotal: calc.cashPrice, total: calc.cashPrice, paidAmount: calc.downPayment, dueAmount: 0, status: 'PAID',
          cashierId: req.user?.userId, cashierName: req.user?.email ?? 'Staff', source: 'HIRE_PURCHASE',
          notes: `Hire Purchase ${number}; down payment ${calc.downPayment.toFixed(2)}`,
          items: { create: [{ productId: imeiRecord.productId, productName: imeiRecord.product.name, sku: imeiRecord.product.sku, imei, quantity: 1, unitPrice: calc.cashPrice, unitCost: imeiRecord.product.buyingPrice, total: calc.cashPrice }] },
          payments: calc.downPayment > 0 ? { create: [{ method: downMethod as PaymentMethod, amount: calc.downPayment, reference: `HP down payment ${number}`, paidAt: new Date() }] } : undefined,
        },
      })
      await tx.imeiRecord.update({ where: { id: imeiRecord.id }, data: { saleId: sale.id } })
      const stock = await tx.product.updateMany({ where: { id: imeiRecord.productId, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } })
      if (stock.count !== 1) throw new AppError('Product is out of stock', 409)
      await tx.stockMovement.create({ data: { productId: imeiRecord.productId, branchId, type: 'SALE', quantity: -1, reference: invoiceNumber, note: `Hire Purchase ${number}`, performedBy: req.user?.email ?? 'Staff' } })
      const finance = req.body.finance ?? {}
      const agreement = await tx.hirePurchaseAgreement.create({
        data: {
          tenantId, branchId, agreementNumber: number, customerId, saleId: sale.id, productId: imeiRecord.productId,
          imeiRecordId: imeiRecord.id, salesPersonId: req.user?.userId, productName: imeiRecord.product.name,
          brandName: imeiRecord.product.brand?.name, modelName: imeiRecord.product.deviceModel, imei,
          color: device.color, storage: device.storage, cashPrice: calc.cashPrice, downPayment: calc.downPayment,
          financeAmount: calc.financeAmount, interestType: finance.interestType || 'FLAT',
          interestRate: Number(finance.interestRate) || 0, interestAmount: calc.interestAmount,
          processingFee: Number(finance.processingFee) || 0, insuranceFee: Number(finance.insuranceFee) || 0,
          documentFee: Number(finance.documentFee) || 0, otherCharges: Number(finance.otherCharges) || 0,
          installmentMonths: Number(finance.installmentMonths), monthlyInstallment: calc.monthlyInstallment,
          totalPayable: calc.totalPayable, outstandingBalance: calc.totalPayable,
          gracePeriodDays: Number(finance.gracePeriodDays) || 0, lateFee: Number(finance.lateFee) || 0,
          dueDay: Number(finance.dueDay) || new Date(finance.firstDueDate).getUTCDate(),
          firstDueDate: parseDate(finance.firstDueDate, 'First due date'), customerNic: req.body.customer?.nic,
          customerDob: req.body.customer?.dateOfBirth ? parseDate(req.body.customer.dateOfBirth, 'Date of birth') : undefined,
          occupation: req.body.customer?.occupation, monthlyIncome: req.body.customer?.monthlyIncome ? Number(req.body.customer.monthlyIncome) : undefined,
          employer: req.body.customer?.employer, status: 'ACTIVE', approvedAt: new Date(),
          qrCode: `/hire-purchase/agreements/${number}`, barcode: number,
          installments: { create: calc.schedule.map(line => ({ tenantId, branchId, ...line })) },
          guarantors: req.body.guarantor?.name ? { create: [{ tenantId, branchId, ...req.body.guarantor }] } : undefined,
        },
        include: { installments: true, customer: true },
      })
      if (calc.downPayment > 0) {
        await tx.transaction.create({
          data: { tenantId, branchId, type: 'INCOME', category: 'Hire Purchase Down Payment', amount: calc.downPayment, description: `${number} — ${customer.name}`, paymentMethod: downMethod as PaymentMethod, reference: invoiceNumber, performedBy: req.user?.email ?? 'Staff' },
        })
      }
      await writeLog(tx, req, branchId, 'POS_AGREEMENT_CREATED', agreement.id, undefined, agreement, { saleId: sale.id, imei })
      return { agreement, sale }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    await emitHirePurchaseAgreementAccounting(tenantId, result.agreement.id, result.sale.id, branchId, req.user?.email)
    sendSuccess(res, result, 'Hire purchase sale and agreement created', 201)
  } catch (error) { next(error instanceof AppError ? error : new AppError(error instanceof Error ? error.message : 'Hire purchase checkout failed', 400)) }
})

router.patch('/agreements/:id/status', requireModuleAccess('HIRE_PURCHASE', 'edit'), async (req, res, next) => {
  try {
    const agreement = await loadAgreement(req, req.params.id)
    const status = String(req.body.status)
    if (status === 'ACTIVE') await assertHpAction(req, 'APPROVE', agreement.branchId)
    if (status === 'CANCELLED') await assertHpAction(req, 'CANCEL', agreement.branchId)
    if (status !== 'ACTIVE' && status !== 'CANCELLED') await assertHpAction(req, 'EDIT', agreement.branchId)
    if (!['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DEFAULTED'].includes(status)) throw new AppError('Invalid agreement status', 400)
    if (status === 'COMPLETED' && agreement.outstandingBalance > 0.001) throw new AppError('Agreement has an outstanding balance', 400)
    const updated = await prisma.$transaction(async tx => {
      const row = await tx.hirePurchaseAgreement.update({
        where: { id: agreement.id },
        data: {
          status: status as any,
          approvedAt: status === 'ACTIVE' ? new Date() : agreement.approvedAt,
          completedAt: status === 'COMPLETED' ? new Date() : agreement.completedAt,
          cancelledAt: status === 'CANCELLED' ? new Date() : agreement.cancelledAt,
          cancellationReason: status === 'CANCELLED' ? String(req.body.reason || '') : agreement.cancellationReason,
        },
      })
      if ((status === 'CANCELLED' || status === 'COMPLETED') && agreement.imeiRecordId) {
        await tx.imeiRecord.update({
          where: { id: agreement.imeiRecordId },
          data: { status: status === 'CANCELLED' && !agreement.saleId ? 'IN_STOCK' : 'SOLD' },
        })
      }
      await writeLog(tx, req, agreement.branchId, `AGREEMENT_${status}`, agreement.id, agreement, row, { reason: req.body.reason })
      return row
    })
    sendSuccess(res, updated, 'Agreement status updated')
  } catch (error) { next(error) }
})

router.patch('/agreements/:id', requireModuleAccess('HIRE_PURCHASE', 'edit'), requireHpAction('EDIT'), async (req, res, next) => {
  try {
    const agreement = await loadAgreement(req, req.params.id)
    const allowed = ['customerNic', 'customerDob', 'occupation', 'monthlyIncome', 'employer', 'customerSignatureUrl', 'agreementPdfUrl']
    const data = Object.fromEntries(allowed.filter(key => req.body[key] !== undefined).map(key => [
      key,
      key === 'customerDob' && req.body[key] ? parseDate(req.body[key], 'Customer date of birth')
        : key === 'monthlyIncome' ? Number(req.body[key])
        : req.body[key],
    ]))
    const updated = await prisma.$transaction(async tx => {
      const row = await tx.hirePurchaseAgreement.update({ where: { id: agreement.id }, data })
      await writeLog(tx, req, agreement.branchId, 'AGREEMENT_UPDATED', agreement.id, agreement, row)
      return row
    })
    sendSuccess(res, updated, 'Agreement updated')
  } catch (error) { next(error) }
})

router.delete('/agreements/:id', requireModuleAccess('HIRE_PURCHASE', 'edit'), requireHpAction('DELETE'), async (req, res, next) => {
  try {
    const agreement = await loadAgreement(req, req.params.id)
    if (!['PENDING', 'CANCELLED'].includes(agreement.status) || agreement.payments.length) {
      throw new AppError('Only pending/cancelled agreements without collections can be deleted', 400)
    }
    await prisma.$transaction(async tx => {
      await writeLog(tx, req, agreement.branchId, 'AGREEMENT_DELETED', undefined, agreement, undefined, { agreementNumber: agreement.agreementNumber })
      if (agreement.imeiRecordId && !agreement.saleId) {
        await tx.imeiRecord.update({ where: { id: agreement.imeiRecordId }, data: { status: 'IN_STOCK', customerId: null } })
      }
      await tx.hirePurchaseAgreement.delete({ where: { id: agreement.id } })
    })
    sendSuccess(res, { id: agreement.id }, 'Agreement deleted')
  } catch (error) { next(error) }
})

router.post('/agreements/:id/installments/regenerate', requireModuleAccess('HIRE_PURCHASE', 'edit'), async (req, res, next) => {
  try {
    const agreement = await loadAgreement(req, req.params.id)
    if (agreement.status !== 'PENDING' || agreement.payments.length) throw new AppError('Only unpaid pending schedules can be regenerated', 400)
    const calc = calculateHirePurchase({
      cashPrice: req.body.cashPrice ?? agreement.cashPrice,
      downPayment: req.body.downPayment ?? agreement.downPayment,
      interestType: req.body.interestType ?? agreement.interestType,
      interestRate: req.body.interestRate ?? agreement.interestRate,
      processingFee: req.body.processingFee ?? agreement.processingFee,
      insuranceFee: req.body.insuranceFee ?? agreement.insuranceFee,
      documentFee: req.body.documentFee ?? agreement.documentFee,
      otherCharges: req.body.otherCharges ?? agreement.otherCharges,
      installmentMonths: req.body.installmentMonths ?? agreement.installmentMonths,
      firstDueDate: req.body.firstDueDate ?? agreement.firstDueDate,
    })
    const updated = await prisma.$transaction(async tx => {
      await tx.hirePurchaseInstallment.deleteMany({ where: { agreementId: agreement.id } })
      const row = await tx.hirePurchaseAgreement.update({
        where: { id: agreement.id },
        data: {
          financeAmount: calc.financeAmount, interestAmount: calc.interestAmount,
          totalPayable: calc.totalPayable, outstandingBalance: calc.totalPayable,
          monthlyInstallment: calc.monthlyInstallment, installmentMonths: calc.schedule.length,
          installments: { create: calc.schedule.map(line => ({ tenantId: req.tenantId!, branchId: agreement.branchId, ...line })) },
        },
        include: { installments: { orderBy: { sequence: 'asc' } } },
      })
      await writeLog(tx, req, agreement.branchId, 'SCHEDULE_REGENERATED', agreement.id, agreement.installments, row.installments)
      return row
    })
    sendSuccess(res, updated, 'Installment schedule regenerated')
  } catch (error) { next(error) }
})

router.post('/agreements/:id/guarantors', requireModuleAccess('HIRE_PURCHASE', 'edit'), async (req, res, next) => {
  try {
    const agreement = await loadAgreement(req, req.params.id)
    if (!req.body.name || !req.body.nic || !req.body.phone) throw new AppError('Guarantor name, NIC and phone are required', 400)
    const guarantor = await prisma.hirePurchaseGuarantor.create({ data: { tenantId: req.tenantId!, branchId: agreement.branchId, agreementId: agreement.id, name: req.body.name, nic: req.body.nic, phone: req.body.phone, address: req.body.address, relationship: req.body.relationship } })
    await prisma.hirePurchaseLog.create({ data: { tenantId: req.tenantId!, branchId: agreement.branchId, agreementId: agreement.id, action: 'GUARANTOR_ADDED', actorId: req.user?.userId, actorEmail: req.user?.email, afterJson: guarantor } })
    sendSuccess(res, guarantor, 'Guarantor added', 201)
  } catch (error) { next(error) }
})

router.patch('/guarantors/:id', requireModuleAccess('HIRE_PURCHASE', 'edit'), async (req, res, next) => {
  try {
    const guarantor = await prisma.hirePurchaseGuarantor.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! } })
    if (!guarantor) throw new AppError('Guarantor not found', 404)
    assertBranchRecordAccess(req, guarantor.branchId)
    const updated = await prisma.hirePurchaseGuarantor.update({ where: { id: guarantor.id }, data: { name: req.body.name, nic: req.body.nic, phone: req.body.phone, address: req.body.address, relationship: req.body.relationship } })
    await prisma.hirePurchaseLog.create({ data: { tenantId: req.tenantId!, branchId: guarantor.branchId, agreementId: guarantor.agreementId, action: 'GUARANTOR_UPDATED', actorId: req.user?.userId, actorEmail: req.user?.email, beforeJson: guarantor, afterJson: updated } })
    sendSuccess(res, updated, 'Guarantor updated')
  } catch (error) { next(error) }
})

router.delete('/guarantors/:id', requireModuleAccess('HIRE_PURCHASE', 'edit'), async (req, res, next) => {
  try {
    const guarantor = await prisma.hirePurchaseGuarantor.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! } })
    if (!guarantor) throw new AppError('Guarantor not found', 404)
    assertBranchRecordAccess(req, guarantor.branchId)
    await prisma.hirePurchaseGuarantor.delete({ where: { id: guarantor.id } })
    await prisma.hirePurchaseLog.create({ data: { tenantId: req.tenantId!, branchId: guarantor.branchId, agreementId: guarantor.agreementId, action: 'GUARANTOR_DELETED', actorId: req.user?.userId, actorEmail: req.user?.email, beforeJson: guarantor } })
    sendSuccess(res, { id: guarantor.id }, 'Guarantor deleted')
  } catch (error) { next(error) }
})

router.post('/agreements/:id/payments', requireModuleAccess('HIRE_PURCHASE', 'edit'), requireHpAction('RECEIVE_PAYMENT'), async (req, res, next) => {
  try {
    const agreement = await loadAgreement(req, req.params.id)
    if (!['ACTIVE', 'DEFAULTED'].includes(agreement.status)) throw new AppError('Agreement is not open for payments', 400)
    const amount = round2(Number(req.body.amount))
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Payment amount must be greater than zero', 400)
    if (amount > agreement.outstandingBalance + 0.001) throw new AppError('Payment exceeds outstanding balance', 400)
    const methods = Array.isArray(req.body.methods) && req.body.methods.length
      ? req.body.methods
      : [{ method: req.body.method || 'CASH', amount }]
    const methodTotal = round2(methods.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0))
    if (Math.abs(methodTotal - amount) > 0.001) throw new AppError('Split payment methods must equal payment amount', 400)
    for (const entry of methods) {
      if (!PAYMENT_METHODS.has(String(entry.method).toUpperCase())) throw new AppError('Invalid payment method', 400)
      if (!Number.isFinite(Number(entry.amount)) || Number(entry.amount) <= 0) throw new AppError('Each split payment amount must be greater than zero', 400)
    }
    const occurredAt = req.body.occurredAt ? parseDate(req.body.occurredAt, 'Payment date') : new Date()
    if (occurredAt.getTime() > Date.now() + 60_000) throw new AppError('Future payment dates are not allowed', 400)
    await assertBusinessDayOpenIfEnabled(req.tenantId!, agreement.branchId, occurredAt)

    const result = await prisma.$transaction(async tx => {
      let remaining = amount
      let penaltyAmount = 0
      const penaltyAllocations: Array<{ penaltyId: string; amount: number }> = []
      const openPenalties = await tx.hirePurchasePenalty.findMany({
        where: { agreementId: agreement.id, waivedAt: null },
        orderBy: { appliedAt: 'asc' },
      })
      for (const penalty of openPenalties) {
        if (remaining <= 0.001) break
        const penaltyBalance = round2(Math.max(0, penalty.amount - penalty.paidAmount))
        const applied = round2(Math.min(remaining, penaltyBalance))
        if (applied <= 0) continue
        await tx.hirePurchasePenalty.update({ where: { id: penalty.id }, data: { paidAmount: { increment: applied } } })
        penaltyAllocations.push({ penaltyId: penalty.id, amount: applied })
        penaltyAmount = round2(penaltyAmount + applied)
        remaining = round2(remaining - applied)
      }
      const installments = await tx.hirePurchaseInstallment.findMany({
        where: { agreementId: agreement.id, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
        orderBy: { sequence: 'asc' },
      })
      let principalAmount = 0
      let interestAmount = 0
      const allocations: Array<{ installmentId: string; sequence: number; amount: number }> = []
      for (const installment of installments) {
        if (remaining <= 0.001) break
        const applied = round2(Math.min(remaining, installment.outstanding))
        const ratio = installment.totalDue > 0 ? applied / installment.totalDue : 0
        principalAmount = round2(principalAmount + installment.principal * ratio)
        interestAmount = round2(interestAmount + installment.interest * ratio)
        const nextOutstanding = round2(installment.outstanding - applied)
        await tx.hirePurchaseInstallment.update({
          where: { id: installment.id },
          data: {
            paidAmount: { increment: applied },
            outstanding: nextOutstanding,
            status: nextOutstanding <= 0.001 ? 'PAID' : 'PARTIAL',
            paidAt: nextOutstanding <= 0.001 ? occurredAt : null,
          },
        })
        allocations.push({ installmentId: installment.id, sequence: installment.sequence, amount: applied })
        remaining = round2(remaining - applied)
      }
      if (remaining > 0.001) throw new AppError('No installments or penalties are available for this payment', 400)
      const nextOutstanding = round2(agreement.outstandingBalance - amount)
      const payment = await tx.hirePurchasePayment.create({
        data: {
          tenantId: req.tenantId!, branchId: agreement.branchId, agreementId: agreement.id,
          receiptNumber: receiptNumber(), amount, principalAmount, interestAmount, penaltyAmount,
          methods, allocationJson: { installments: allocations, penalties: penaltyAllocations }, reference: req.body.reference, notes: req.body.notes,
          occurredAt, performedBy: req.user?.email ?? 'Staff',
        },
      })
      const updated = await tx.hirePurchaseAgreement.update({
        where: { id: agreement.id },
        data: {
          paidAmount: { increment: amount },
          outstandingBalance: nextOutstanding,
          status: nextOutstanding <= 0.001 ? 'COMPLETED' : agreement.status === 'DEFAULTED' ? 'ACTIVE' : agreement.status,
          completedAt: nextOutstanding <= 0.001 ? occurredAt : null,
        },
      })
      const transactionIds: string[] = []
      for (const entry of methods) {
        const methodAmount = round2(Number(entry.amount))
        if (methodAmount <= 0) continue
        const transaction = await tx.transaction.create({
          data: {
            tenantId: req.tenantId!, branchId: agreement.branchId, type: 'INCOME',
            category: 'Hire Purchase Collection', amount: methodAmount,
            description: `${agreement.agreementNumber} — ${agreement.customer.name}`,
            paymentMethod: String(entry.method).toUpperCase() as PaymentMethod,
            reference: payment.receiptNumber, occurredAt,
            performedBy: req.user?.email ?? 'Staff',
          },
        })
        transactionIds.push(transaction.id)
      }
      if (nextOutstanding <= 0.001 && agreement.imeiRecordId) {
        await tx.imeiRecord.update({ where: { id: agreement.imeiRecordId }, data: { status: 'SOLD' } })
      }
      await writeLog(tx, req, agreement.branchId, 'PAYMENT_RECEIVED', agreement.id, agreement, updated, { paymentId: payment.id, amount, allocations, penaltyAllocations })
      return { payment, agreement: updated, allocations, penaltyAllocations, transactionIds }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    await Promise.all(result.transactionIds.map(id =>
      emitHirePurchasePaymentAccounting(req.tenantId!, id, agreement.branchId, req.user?.email),
    ))
    sendSuccess(res, result, 'Hire purchase payment recorded', 201)
  } catch (error) { next(error) }
})

router.post('/payments/:id/reverse', authorize('OWNER', 'MANAGER'), requireModuleAccess('HIRE_PURCHASE', 'edit'), async (req, res, next) => {
  try {
    const payment = await prisma.hirePurchasePayment.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      include: { agreement: true },
    })
    if (!payment) throw new AppError('Payment not found', 404)
    if (payment.status === 'REVERSED') throw new AppError('Payment is already reversed', 400)
    assertBranchRecordAccess(req, payment.branchId)
    const allocation = payment.allocationJson as any
    const installments = Array.isArray(allocation) ? allocation : allocation?.installments ?? []
    const penalties = allocation?.penalties ?? []
    const updated = await prisma.$transaction(async tx => {
      for (const item of installments) {
        const installment = await tx.hirePurchaseInstallment.findUnique({ where: { id: item.installmentId } })
        if (!installment) continue
        const paidAmount = round2(Math.max(0, installment.paidAmount - Number(item.amount)))
        const outstanding = round2(installment.outstanding + Number(item.amount))
        await tx.hirePurchaseInstallment.update({ where: { id: installment.id }, data: { paidAmount, outstanding, status: paidAmount > 0 ? 'PARTIAL' : installment.dueDate < new Date() ? 'OVERDUE' : 'PENDING', paidAt: null } })
      }
      for (const item of penalties) {
        await tx.hirePurchasePenalty.update({ where: { id: item.penaltyId }, data: { paidAmount: { decrement: Number(item.amount) } } }).catch(() => null)
      }
      await tx.hirePurchasePayment.update({ where: { id: payment.id }, data: { status: 'REVERSED', notes: `${payment.notes ?? ''}\nReversed: ${String(req.body.reason || 'Administrative reversal')}`.trim() } })
      const agreement = await tx.hirePurchaseAgreement.update({
        where: { id: payment.agreementId },
        data: { paidAmount: { decrement: payment.amount }, outstandingBalance: { increment: payment.amount }, status: 'ACTIVE', completedAt: null },
      })
      if (payment.agreement.imeiRecordId) await tx.imeiRecord.update({ where: { id: payment.agreement.imeiRecordId }, data: { status: 'UNDER_HIRE_PURCHASE' } })
      await writeLog(tx, req, payment.branchId, 'PAYMENT_REVERSED', payment.agreementId, payment, agreement, { reason: req.body.reason })
      return agreement
    })
    sendSuccess(res, updated, 'Payment reversed')
  } catch (error) { next(error) }
})

router.post('/agreements/:id/early-settlement', requireModuleAccess('HIRE_PURCHASE', 'edit'), async (req, res, next) => {
  try {
    const agreement = await loadAgreement(req, req.params.id)
    const open = agreement.installments.filter(row => row.status !== 'PAID' && row.status !== 'WAIVED')
    const principal = open.reduce((sum, row) => sum + Math.max(0, row.principal - row.paidAmount), 0)
    const accrued = open.filter(row => row.dueDate <= new Date()).reduce((sum, row) => sum + row.interest, 0)
    sendSuccess(res, {
      agreementId: agreement.id,
      settlementAmount: calculateEarlySettlement(principal, accrued, agreement.interestType),
      interestRebate: agreement.interestType === 'FLAT' ? round2(open.reduce((sum, row) => sum + row.interest, 0)) : 0,
      validUntil: new Date().toISOString(),
    })
  } catch (error) { next(error) }
})

router.get('/dues', async (req, res, next) => {
  try {
    const branchId = effectiveBranchId(req)
    const scope = String(req.query.scope || 'today')
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const week = new Date(today); week.setUTCDate(week.getUTCDate() + 7)
    let dueDate: Prisma.DateTimeFilter
    if (scope === 'overdue') dueDate = { lt: today }
    else if (scope === 'tomorrow') dueDate = { gte: tomorrow, lt: new Date(tomorrow.getTime() + 86_400_000) }
    else if (scope === 'upcoming') dueDate = { gte: tomorrow, lt: week }
    else dueDate = { gte: today, lt: tomorrow }
    const rows = await prisma.hirePurchaseInstallment.findMany({
      where: { tenantId: req.tenantId!, ...(branchId ? { branchId } : {}), dueDate, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' },
      include: { agreement: { include: { customer: { select: { id: true, name: true, phone: true } } } } },
    })
    sendSuccess(res, rows)
  } catch (error) { next(error) }
})

router.get('/guarantors', async (req, res, next) => {
  try {
    const branchId = effectiveBranchId(req)
    sendSuccess(res, await prisma.hirePurchaseGuarantor.findMany({
      where: { tenantId: req.tenantId!, ...(branchId ? { branchId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { agreement: { select: { id: true, agreementNumber: true, status: true } } },
    }))
  } catch (error) { next(error) }
})

router.get('/settings', async (req, res, next) => {
  try {
    const branchId = effectiveBranchId(req) || await resolveMutationBranchId(req)
    const settings = await prisma.hirePurchaseSettings.upsert({
      where: { tenantId_branchId: { tenantId: req.tenantId!, branchId } },
      update: {},
      create: { tenantId: req.tenantId!, branchId },
    })
    sendSuccess(res, settings)
  } catch (error) { next(error) }
})

router.patch('/settings', requireModuleAccess('HIRE_PURCHASE', 'edit'), requireHpAction('EDIT_SETTINGS'), async (req, res, next) => {
  try {
    const branchId = await resolveMutationBranchId(req, { preferred: req.body.branchId })
    const allowed = ['defaultInterestType', 'defaultInterestRate', 'defaultLateFee', 'defaultGracePeriod', 'defaultDueDay', 'agreementTemplate', 'receiptTemplate', 'reminderSettings', 'penaltyRules', 'smsProviderSettings', 'whatsappSettings', 'rolePermissions']
    const data = Object.fromEntries(allowed.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]))
    const settings = await prisma.hirePurchaseSettings.upsert({
      where: { tenantId_branchId: { tenantId: req.tenantId!, branchId } },
      update: data,
      create: { tenantId: req.tenantId!, branchId, ...data },
    })
    await prisma.hirePurchaseLog.create({ data: { tenantId: req.tenantId!, branchId, action: 'SETTINGS_UPDATED', actorId: req.user?.userId, actorEmail: req.user?.email, afterJson: settings } })
    sendSuccess(res, settings, 'Hire purchase settings updated')
  } catch (error) { next(error) }
})

router.post('/maintenance/apply-penalties', requireModuleAccess('HIRE_PURCHASE', 'edit'), async (req, res, next) => {
  try {
    const branchId = effectiveBranchId(req)
    const now = new Date()
    const rows = await prisma.hirePurchaseInstallment.findMany({
      where: { tenantId: req.tenantId!, ...(branchId ? { branchId } : {}), dueDate: { lt: now }, status: { in: ['PENDING', 'PARTIAL'] } },
      include: { agreement: true },
    })
    let applied = 0
    for (const row of rows) {
      const graceEnd = new Date(row.dueDate); graceEnd.setUTCDate(graceEnd.getUTCDate() + row.agreement.gracePeriodDays)
      if (graceEnd >= now) continue
      await prisma.$transaction(async tx => {
        await tx.hirePurchaseInstallment.update({ where: { id: row.id }, data: { status: 'OVERDUE' } })
        await tx.hirePurchaseAgreement.update({ where: { id: row.agreementId }, data: { status: 'DEFAULTED' } })
        const exists = await tx.hirePurchasePenalty.findFirst({ where: { installmentId: row.id, waivedAt: null } })
        if (!exists && row.agreement.lateFee > 0) {
          await tx.hirePurchasePenalty.create({ data: { tenantId: row.tenantId, branchId: row.branchId, agreementId: row.agreementId, installmentId: row.id, amount: row.agreement.lateFee, reason: `Late fee for installment ${row.sequence}` } })
          await tx.hirePurchaseAgreement.update({ where: { id: row.agreementId }, data: { outstandingBalance: { increment: row.agreement.lateFee } } })
          applied += 1
        }
      })
    }
    sendSuccess(res, { scanned: rows.length, penaltiesApplied: applied })
  } catch (error) { next(error) }
})

router.post('/reminders/send', requireModuleAccess('HIRE_PURCHASE', 'edit'), async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.agreementIds) ? req.body.agreementIds.map(String) : []
    if (!ids.length) throw new AppError('Select at least one agreement', 400)
    const branchId = effectiveBranchId(req)
    const agreements = await prisma.hirePurchaseAgreement.findMany({
      where: { id: { in: ids }, tenantId: req.tenantId!, ...(branchId ? { branchId } : {}) },
      include: { customer: true, installments: { where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }, orderBy: { dueDate: 'asc' }, take: 1 } },
    })
    const channel = String(req.body.channel || 'WHATSAPP').toUpperCase()
    const results: Array<{ agreementId: string; sent: boolean; error?: string }> = []
    for (const agreement of agreements) {
      const nextDue = agreement.installments[0]
      const text = String(req.body.message || `Payment reminder: ${agreement.agreementNumber} has ${agreement.outstandingBalance.toFixed(2)} outstanding${nextDue ? `; next due ${nextDue.dueDate.toISOString().slice(0, 10)}` : ''}.`)
      try {
        if (channel === 'EMAIL') {
          if (!agreement.customer.email) throw new Error('Customer email is missing')
          await sendMail(agreement.customer.email, `Payment reminder — ${agreement.agreementNumber}`, `<p>${text}</p>`)
        } else if (channel === 'WHATSAPP') {
          await whatsappService.sendTextMessage(req.tenantId!, agreement.customer.phone, text)
        } else {
          throw new Error('SMS provider is not configured')
        }
        await prisma.hirePurchaseLog.create({ data: { tenantId: req.tenantId!, branchId: agreement.branchId, agreementId: agreement.id, action: 'REMINDER_SENT', actorId: req.user?.userId, actorEmail: req.user?.email, metadata: { channel, recipient: channel === 'EMAIL' ? agreement.customer.email : agreement.customer.phone } } })
        results.push({ agreementId: agreement.id, sent: true })
      } catch (error) {
        results.push({ agreementId: agreement.id, sent: false, error: error instanceof Error ? error.message : 'Reminder failed' })
      }
    }
    sendSuccess(res, { results, sent: results.filter(row => row.sent).length, failed: results.filter(row => !row.sent).length })
  } catch (error) { next(error) }
})

router.get('/reports/:type', requireHpAction('EXPORT_REPORTS'), async (req, res, next) => {
  try {
    const type = String(req.params.type)
    const allowed = new Set(['collections', 'outstanding', 'dues', 'defaulters', 'agreements', 'customer-statement', 'profit', 'late-fees', 'cash-flow'])
    if (!allowed.has(type)) throw new AppError('Unknown hire purchase report', 404)
    const branchId = effectiveBranchId(req)
    const base = { tenantId: req.tenantId!, ...(branchId ? { branchId } : {}) }
    const from = req.query.from ? parseDate(req.query.from, 'Report from date') : undefined
    const to = req.query.to ? parseDate(req.query.to, 'Report to date') : undefined
    if (to) to.setUTCHours(23, 59, 59, 999)
    const dateRange = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined
    let rows: unknown[] = []
    if (type === 'collections' || type === 'cash-flow') rows = await prisma.hirePurchasePayment.findMany({ where: { ...base, ...(dateRange ? { occurredAt: dateRange } : {}) }, orderBy: { occurredAt: 'desc' }, include: { agreement: { select: { agreementNumber: true } } } })
    else if (type === 'dues') rows = await prisma.hirePurchaseInstallment.findMany({ where: { ...base, ...(dateRange ? { dueDate: dateRange } : {}), status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }, orderBy: { dueDate: 'asc' }, include: { agreement: { select: { agreementNumber: true } } } })
    else if (type === 'late-fees') rows = await prisma.hirePurchasePenalty.findMany({ where: { ...base, ...(dateRange ? { appliedAt: dateRange } : {}) }, orderBy: { appliedAt: 'desc' } })
    else rows = await prisma.hirePurchaseAgreement.findMany({ where: { ...base, ...(dateRange ? { createdAt: dateRange } : {}), ...(type === 'defaulters' ? { status: 'DEFAULTED' as const } : type === 'outstanding' ? { outstandingBalance: { gt: 0 } } : {}) }, orderBy: { createdAt: 'desc' }, include: { customer: { select: { name: true, phone: true } } } })
    sendSuccess(res, { type, rows })
  } catch (error) { next(error) }
})

router.get('/logs', async (req, res, next) => {
  try {
    const branchId = effectiveBranchId(req)
    sendSuccess(res, await prisma.hirePurchaseLog.findMany({ where: { tenantId: req.tenantId!, ...(branchId ? { branchId } : {}) }, orderBy: { createdAt: 'desc' }, take: 500 }))
  } catch (error) { next(error) }
})

export default router

