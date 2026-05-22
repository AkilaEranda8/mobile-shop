import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authenticate } from '../../middleware/auth.middleware'
import { sendSuccess } from '../../utils/response'
import { env } from '../../config/env'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'logos')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const REPAIR_DIR = path.join(process.cwd(), 'uploads', 'repairs')
fs.mkdirSync(REPAIR_DIR, { recursive: true })

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

export default router
