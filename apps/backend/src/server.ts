import { env } from './config/env'
import { connectDatabase, disconnectDatabase } from './config/database'
import { connectRedis, redis } from './config/redis'
import { refreshRateLimitSettings } from './config/rate-limit-settings'
import { restoreQrSessions } from './modules/whatsapp/whatsapp.service'
import { startTrialExpiryJob, stopTrialExpiryJob } from './jobs/trial-expiry.job'
import { ensurePlatformAdmin } from './utils/ensure-platform-admin'
import app from './app'

async function bootstrap() {
  try {
    await connectDatabase()
    await ensurePlatformAdmin()
    await connectRedis()
    await refreshRateLimitSettings()
    restoreQrSessions().catch(err => {
      console.warn('[whatsapp] session restore skipped:', err?.message)
    })
    startTrialExpiryJob()

    const server = app.listen(parseInt(env.PORT), () => {
      console.log(`🚀 Hexalyte API running on port ${env.PORT}`)
      console.log(`📍 Base URL: http://localhost:${env.PORT}/${env.API_PREFIX}`)
      console.log(`🌍 Environment: ${env.NODE_ENV}`)
    })

    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`)
      server.close(async () => {
        stopTrialExpiryJob()
        await disconnectDatabase()
        await redis.quit()
        console.log('✅ Graceful shutdown complete')
        process.exit(0)
      })
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

bootstrap()
