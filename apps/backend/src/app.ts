import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'

import { env } from './config/env'
import { prisma } from './config/database'
import { errorHandler, notFound } from './middleware/error.middleware'

import authRoutes from './modules/auth/auth.routes'
import usersRoutes from './modules/users/users.routes'
import tenantsRoutes from './modules/tenants/tenants.routes'
import branchesRoutes from './modules/tenants/branches.routes'
import productsRoutes from './modules/products/products.routes'
import imeiRoutes from './modules/products/imei.routes'
import customersRoutes from './modules/customers/customers.routes'
import salesRoutes from './modules/sales/sales.routes'
import repairsRoutes from './modules/repairs/repairs.routes'
import warrantyRoutes from './modules/warranty/warranty.routes'
import suppliersRoutes from './modules/suppliers/suppliers.routes'
import financeRoutes from './modules/finance/finance.routes'
import analyticsRoutes from './modules/analytics/analytics.routes'
import adminRoutes from './modules/admin/admin.routes'
import whatsappRoutes from './modules/whatsapp/whatsapp.routes'
import deliveryRoutes from './modules/delivery/delivery.routes'
import deviceCatalogRoutes from './modules/device-catalog/device-catalog.routes'
import uploadRoutes from './modules/upload/upload.routes'
import exchangesRoutes from './modules/exchanges/exchanges.routes'
import servicesRoutes from './modules/services/services.routes'
import dailyReloadRoutes from './modules/daily-reload/daily-reload.routes'

const app = express()

app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (env.NODE_ENV !== 'production') {
      const devPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
      if (devPattern.test(origin)) return callback(null, true)
    }
    const allowedOrigins = [
      env.FRONTEND_URL,
      'https://admin2.hexalyte.com',
      'https://app.hexalyte.com',
    ]
    if (allowedOrigins.includes(origin)) return callback(null, true)
    if (/^https:\/\/[^.]+\.app\.hexalyte\.com$/.test(origin)) return callback(null, true)
    if (/^https:\/\/[^.]+\.shop\.hexalyte\.com$/.test(origin)) return callback(null, true)
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(compression())
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

const uploadsDir = path.join(process.cwd(), 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
}, express.static(uploadsDir))

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false })
app.use(limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
})

const API = `/${env.API_PREFIX}`

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0', timestamp: new Date() }))

const PLANS = [
  {
    key: 'TRIAL', label: 'Trial', price: 'Free', period: '14 days',
    color: '#eab308', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.25)',
    features: ['1 Branch', '2 Users', 'POS & Sales', 'Basic Reports', 'Repairs'],
  },
  {
    key: 'STARTER', label: 'Starter', price: '$19', period: '/month',
    color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)',
    features: ['1 Branch', '5 Users', 'POS & Sales', 'Full Reports', 'Repairs', 'Warranty'],
  },
  {
    key: 'PRO', label: 'Pro', price: '$49', period: '/month', popular: true,
    color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.30)',
    features: ['3 Branches', '15 Users', 'Everything in Starter', 'P&L Reports', 'Cash Flow', 'Branch Filtering', 'CSV Exports'],
  },
  {
    key: 'ENTERPRISE', label: 'Enterprise', price: 'Custom', period: 'contact us',
    color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)',
    features: ['Unlimited Branches', 'Unlimited Users', 'Everything in Pro', 'Priority Support', 'Custom Integrations', 'SLA Guarantee'],
  },
]
app.get(`${API}/plans`, async (_req, res) => {
  try {
    const configs = await prisma.platformConfig.findMany({
      where: { key: { startsWith: 'plan_' } },
    })
    const cfgMap: Record<string, string> = {}
    for (const c of configs) cfgMap[c.key] = c.value

    const data = PLANS.map(p => {
      const mrrKey  = `plan_mrr_${p.key}`
      const featKey = `plan_features_${p.key}`
      const mrr     = cfgMap[mrrKey] ? parseInt(cfgMap[mrrKey]) : null
      const feats   = cfgMap[featKey] ? JSON.parse(cfgMap[featKey]) : p.features
      const price   = mrr != null ? `Rs.${mrr.toLocaleString()}` : p.price
      return { ...p, price, features: feats, mrr }
    })
    res.json({ success: true, data })
  } catch { res.json({ success: true, data: PLANS }) }
})

app.use(`${API}/auth/login`,      authLimiter)
app.use(`${API}/auth/kc-login`,   authLimiter)
app.use(`${API}/auth/register`,   authLimiter)
app.use(`${API}/auth/kc-refresh`, authLimiter)
app.use(`${API}/auth`, authRoutes)
app.use(`${API}/users`, usersRoutes)
app.use(`${API}/tenants`, tenantsRoutes)
app.use(`${API}/branches`, branchesRoutes)
app.use(`${API}/products`, productsRoutes)
app.use(`${API}/imei`, imeiRoutes)
app.use(`${API}/customers`, customersRoutes)
app.use(`${API}/sales`, salesRoutes)
app.use(`${API}/repairs`, repairsRoutes)
app.use(`${API}/warranties`, warrantyRoutes)
app.use(`${API}/suppliers`, suppliersRoutes)
app.use(`${API}/finance`, financeRoutes)
app.use(`${API}/analytics`, analyticsRoutes)
app.use(`${API}/whatsapp`, whatsappRoutes)
app.use(`${API}/services`, servicesRoutes)
app.use(`${API}/daily-reloads`, dailyReloadRoutes)
app.use(`${API}/delivery`, deliveryRoutes)
app.use(`${API}/device-catalog`, deviceCatalogRoutes)
app.use(`${API}/upload`, uploadRoutes)
app.use(`${API}/exchanges`, exchangesRoutes)
app.use('/admin/v1', adminRoutes)

app.use(notFound)
app.use(errorHandler)

export default app
