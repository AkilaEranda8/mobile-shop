import { env } from './config/env'
import { connectDatabase, disconnectDatabase } from './config/database'
import { connectRedis, redis } from './config/redis'
import app from './app'

async function bootstrap() {
  try {
    await connectDatabase()
    await connectRedis()

    const server = app.listen(parseInt(env.PORT), () => {
      console.log(`🚀 Hexalyte API running on port ${env.PORT}`)
      console.log(`📍 Base URL: http://localhost:${env.PORT}/${env.API_PREFIX}`)
      console.log(`🌍 Environment: ${env.NODE_ENV}`)
    })

    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`)
      server.close(async () => {
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
