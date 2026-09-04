import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authenticate, authorize } from '../../middleware/auth.middleware'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess } from '../../utils/response'
import { AppError } from '../../middleware/error.middleware'
import { env } from '../../config/env'
import { submitPaymentSchema, requestPlanUpgradeSchema } from './billing.schema'
import {
  getBillingOverview,
  getInvoiceForTenant,
  listTenantInvoices,
  requestPlanUpgrade,
  submitSubscriptionPayment,
} from './billing.service'
import { getBillingConfig } from './billing-config'
import { buildSubscriptionInvoicePdf } from '../../utils/subscription-invoice-pdf'
import {
  createHelaposQrSession,
  getHelaposPaymentStatus,
  getHelaposPublicConfig,
  handleHelaposWebhook,
  quoteHelaposFeeForInvoice,
  simulateHelaposPayment,
} from './helapos.service'

const SLIP_DIR = path.join(process.cwd(), 'uploads', 'payment-slips')
fs.mkdirSync(SLIP_DIR, { recursive: true })

const slipUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, SLIP_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
      cb(null, `slip_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`)
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
    cb(null, allowed.includes(file.mimetype))
  },
})

const router = Router()

// ── Public HelaPOS notify webhook alias (canonical: /payments/helapos/webhook) ──
router.post('/helapos/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawBody =
      typeof (req as any).rawBody === 'string' || Buffer.isBuffer((req as any).rawBody)
        ? (req as any).rawBody
        : undefined
    const result = await handleHelaposWebhook({
      body: req.body,
      rawBody,
      headers: req.headers as Record<string, string | string[] | undefined>,
      ip: req.ip || req.socket.remoteAddress || undefined,
    })
    sendSuccess(res, result, result.ok ? 'OK' : 'Ignored')
  } catch (e) { next(e) }
})

router.use(authenticate)

/** Billing dashboard overview (KPIs, current invoice, history, bank details) */
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getBillingOverview(req.tenantId!)
    sendSuccess(res, data)
  } catch (e) { next(e) }
})

router.get('/config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await getBillingConfig()
    sendSuccess(res, {
      bank: config.bank,
      graceDays: config.graceDays,
      dueDaysAfterIssue: config.dueDaysAfterIssue,
      helapos: getHelaposPublicConfig(),
    })
  } catch (e) { next(e) }
})

/** Self-serve plan upgrade → creates payable invoice (LankaQR / bank) */
router.post(
  '/upgrade',
  authorize('OWNER', 'MANAGER'),
  validate(requestPlanUpgradeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await requestPlanUpgrade({
        tenantId: req.tenantId!,
        targetPlan: (req.body as any).targetPlan,
        actor: {
          type: 'USER',
          name: req.user?.email || req.user?.userId || 'tenant-user',
          userId: req.user?.userId,
        },
      })
      sendSuccess(res, data, data.reused ? 'Existing upgrade invoice' : 'Upgrade invoice created', data.reused ? 200 : 201)
    } catch (e) { next(e) }
  },
)

/** Preview HelaPOS fee / customer payable for an invoice (no payment created) */
router.get(
  '/invoices/:id/helapos/quote',
  authorize('OWNER', 'MANAGER', 'CASHIER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await quoteHelaposFeeForInvoice({
        tenantId: req.tenantId!,
        invoiceId: req.params.id,
      })
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },
)

/** Start LankaQR (HelaPOS) session for an unpaid invoice */
router.post(
  '/invoices/:id/helapos/qr',
  authorize('OWNER', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await createHelaposQrSession({
        tenantId: req.tenantId!,
        invoiceId: req.params.id,
        submittedById: req.user?.userId,
      })
      sendSuccess(res, data, 'LankaQR ready', 201)
    } catch (e) { next(e) }
  },
)

/** Poll HelaPOS payment / invoice status */
router.get(
  '/helapos/payments/:paymentId',
  authorize('OWNER', 'MANAGER', 'CASHIER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getHelaposPaymentStatus({
        tenantId: req.tenantId!,
        paymentId: req.params.paymentId,
      })
      sendSuccess(res, data)
    } catch (e) { next(e) }
  },
)

/** Mock settle (only when HELAPOS_MOCK / no live credentials) */
router.post(
  '/helapos/payments/:paymentId/mock-pay',
  authorize('OWNER', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await simulateHelaposPayment({
        tenantId: req.tenantId!,
        paymentId: req.params.paymentId,
      })
      sendSuccess(res, data, 'Mock payment applied')
    } catch (e) { next(e) }
  },
)

router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search } = req.query as Record<string, string>
    const data = await listTenantInvoices(req.tenantId!, { status, search })
    sendSuccess(res, data)
  } catch (e) { next(e) }
})

router.get('/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await getInvoiceForTenant(req.tenantId!, req.params.id)
    sendSuccess(res, invoice)
  } catch (e) { next(e) }
})

router.get('/invoices/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await getInvoiceForTenant(req.tenantId!, req.params.id)
    const config = await getBillingConfig()
    const pdf = buildSubscriptionInvoicePdf({
      invoiceNo: invoice.invoiceNumber,
      shopName: invoice.tenant.name,
      ownerName: invoice.tenant.ownerName,
      ownerEmail: invoice.tenant.ownerEmail,
      plan: invoice.plan,
      months: invoice.months,
      mrr: invoice.mrrSnapshot,
      total: invoice.total,
      periodStart: invoice.billingPeriodStart,
      periodEnd: invoice.billingPeriodEnd,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      discount: invoice.discount,
      tax: invoice.tax,
      subtotal: invoice.subtotal,
      paidAt: invoice.paidAt,
      paidByName: (invoice as any).paidByName || null,
      bank: config.bank,
    })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`)
    res.send(pdf)
  } catch (e) { next(e) }
})

router.post(
  '/payments',
  authorize('OWNER', 'MANAGER'),
  validate(submitPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as any
      const payment = await submitSubscriptionPayment({
        tenantId: req.tenantId!,
        invoiceId: body.invoiceId,
        amount: body.amount,
        channel: body.channel,
        methodLabel: body.methodLabel,
        paymentDate: body.paymentDate,
        bankName: body.bankName,
        accountRef: body.accountRef,
        transactionRef: body.transactionRef,
        slipUrl: body.slipUrl || undefined,
        slipFilename: body.slipFilename,
        notes: body.notes,
        submittedById: req.user?.userId,
      })
      sendSuccess(res, payment, 'Payment submitted for review', 201)
    } catch (e) { next(e) }
  },
)

router.post(
  '/payments/slip',
  authorize('OWNER', 'MANAGER'),
  (req: Request, res: Response, next: NextFunction) => {
    slipUpload.single('slip')(req, res, (err: any) => {
      if (err) {
        next(new AppError(err.message || 'Upload failed', 400))
        return
      }
      next()
    })
  },
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('No file uploaded. Allowed: JPG, PNG, PDF (max 8MB)', 400)
      const url = `${env.BACKEND_URL.replace(/\/$/, '')}/uploads/payment-slips/${req.file.filename}`
      sendSuccess(res, { url, filename: req.file.originalname, size: req.file.size }, 'Slip uploaded', 201)
    } catch (e) { next(e) }
  },
)

export default router
