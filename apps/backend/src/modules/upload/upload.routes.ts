import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authenticate } from '../../middleware/auth.middleware'
import { sendSuccess } from '../../utils/response'
import { env } from '../../config/env'
import { prisma } from '../../config/database'
import { assertBranchRecordAccess } from '../../utils/active-branch'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'logos')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const REPAIR_DIR   = path.join(process.cwd(), 'uploads', 'repairs')
fs.mkdirSync(REPAIR_DIR, { recursive: true })

const PRODUCT_DIR = path.join(process.cwd(), 'uploads', 'products')
fs.mkdirSync(PRODUCT_DIR, { recursive: true })
const HP_DIR = path.join(process.cwd(), 'uploads', 'hire-purchase')
fs.mkdirSync(HP_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png'
    cb(null, `logo_${Date.now()}${ext}`)
  },
})

const repairStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, REPAIR_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `repair_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    cb(null, allowed.includes(file.mimetype))
  },
})

const repairUpload = multer({
  storage: repairStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
    cb(null, allowed.includes(file.mimetype))
  },
})

const productStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PRODUCT_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `product_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`)
  },
})

const productUpload = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    cb(null, allowed.includes(file.mimetype))
  },
})

const hpUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, HP_DIR),
    filename: (_req, file, cb) => cb(null, `hp_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'].includes(file.mimetype)),
})

const router = Router()
router.use(authenticate)

router.post('/logo', upload.single('logo'), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return }
    const url = `${env.BACKEND_URL.replace(/\/$/, '')}/uploads/logos/${req.file.filename}`
    sendSuccess(res, { url }, 'Logo uploaded', 201)
  } catch (e) { next(e) }
})

router.post('/repair-photo', repairUpload.single('photo'), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return }
    const url = `${env.BACKEND_URL.replace(/\/$/, '')}/uploads/repairs/${req.file.filename}`
    sendSuccess(res, { url }, 'Photo uploaded', 201)
  } catch (e) { next(e) }
})

router.post('/product-image', productUpload.single('image'), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return }
    const url = `${env.BACKEND_URL.replace(/\/$/, '')}/uploads/products/${req.file.filename}`
    sendSuccess(res, { url }, 'Image uploaded', 201)
  } catch (e) { next(e) }
})

router.post('/hire-purchase-document', hpUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return }
    const agreement = await prisma.hirePurchaseAgreement.findFirst({
      where: { id: String(req.body.agreementId ?? ''), tenantId: req.tenantId! },
      select: { id: true, branchId: true },
    })
    if (!agreement) { res.status(404).json({ message: 'Agreement not found' }); return }
    assertBranchRecordAccess(req, agreement.branchId)
    const allowed = new Set(['CUSTOMER_PHOTO', 'CUSTOMER_NIC_FRONT', 'CUSTOMER_NIC_BACK', 'PROOF_OF_ADDRESS', 'GUARANTOR_PHOTO', 'GUARANTOR_NIC_FRONT', 'GUARANTOR_NIC_BACK', 'CUSTOMER_SIGNATURE', 'AGREEMENT_PDF', 'OTHER'])
    const type = allowed.has(String(req.body.type)) ? String(req.body.type) : 'OTHER'
    const url = `${env.BACKEND_URL.replace(/\/$/, '')}/uploads/hire-purchase/${req.file.filename}`
    const document = await prisma.hirePurchaseDocument.create({
      data: {
        tenantId: req.tenantId!,
        branchId: agreement.branchId,
        agreementId: agreement.id,
        guarantorId: req.body.guarantorId || undefined,
        type: type as any,
        fileName: req.file.originalname,
        fileUrl: url,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedBy: req.user?.email ?? 'Staff',
      },
    })
    await prisma.hirePurchaseLog.create({
      data: { tenantId: req.tenantId!, branchId: agreement.branchId, agreementId: agreement.id, action: 'DOCUMENT_UPLOADED', actorId: req.user?.userId, actorEmail: req.user?.email, afterJson: document },
    })
    sendSuccess(res, document, 'Hire purchase document uploaded', 201)
  } catch (e) { next(e) }
})

export default router
