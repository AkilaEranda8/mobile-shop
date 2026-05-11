import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'

import { env } from './config/env'
import { errorHandler, notFound } from './middleware/error.middleware'

import authRoutes from './modules/auth/auth.routes'
import usersRoutes from './modules/users/users.routes'
import tenantsRoutes from './modules/tenants/tenants.routes'
import branchesRoutes from './modules/tenants/branches.routes'
import productsRoutes from './modules/products/products.routes'
import customersRoutes from './modules/customers/customers.routes'
import salesRoutes from './modules/sales/sales.routes'
import repairsRoutes from './modules/repairs/repairs.routes'
import warrantyRoutes from './modules/warranty/warranty.routes'
import suppliersRoutes from './modules/suppliers/suppliers.routes'
import financeRoutes from './modules/finance/finance.routes'
import analyticsRoutes from './modules/analytics/analytics.routes'
import adminRoutes from './modules/admin/admin.routes'

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
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(compression())
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false })
app.use(limiter)

const API = `/${env.API_PREFIX}`

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0', timestamp: new Date() }))

app.use(`${API}/auth`, authRoutes)
app.use(`${API}/users`, usersRoutes)
app.use(`${API}/tenants`, tenantsRoutes)
app.use(`${API}/branches`, branchesRoutes)
app.use(`${API}/products`, productsRoutes)
app.use(`${API}/customers`, customersRoutes)
app.use(`${API}/sales`, salesRoutes)
app.use(`${API}/repairs`, repairsRoutes)
app.use(`${API}/warranties`, warrantyRoutes)
app.use(`${API}/suppliers`, suppliersRoutes)
app.use(`${API}/finance`, financeRoutes)
app.use(`${API}/analytics`, analyticsRoutes)
app.use('/admin/v1', adminRoutes)

app.use(notFound)
app.use(errorHandler)

export default app
