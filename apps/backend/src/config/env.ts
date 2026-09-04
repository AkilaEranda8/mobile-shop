import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  BACKEND_URL:  z.string().default('http://localhost:3001'),
  API_PREFIX: z.string().default('api/v1'),
  // Meta/WhatsApp webhook secrets (optional; only needed for signature verification)
  WHATSAPP_APP_SECRET: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMS_PROVIDER: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  // Keycloak
  KEYCLOAK_URL: z.string().url().optional(),
  KC_REALM: z.string().default('hexalyte'),
  KC_CLIENT_ID: z.string().optional(),
  KC_CLIENT_SECRET: z.string().optional(),
  KEYCLOAK_AUTH_ENABLED: z.enum(['true', 'false']).optional(),
  /** HMAC pepper for POS Quick PIN digests (min 16 chars). Falls back to derived JWT_SECRET hash if unset. */
  POS_PIN_PEPPER: z.string().min(16).optional(),

  // HelaPOS LankaQR (subscription billing). Paths are configurable until HelaPay publish full OpenAPI.
  HELAPOS_ENABLED: z.enum(['true', 'false']).optional().default('false'),
  HELAPOS_MOCK: z.enum(['true', 'false']).optional().default('false'),
  HELAPOS_BASE_URL: z.string().default('https://helapos.lk/merchant-api'),
  HELAPOS_APP_ID: z.string().optional(),
  HELAPOS_APP_SECRET: z.string().optional(),
  HELAPOS_MERCHANT_ID: z.string().optional(),
  /** Relative to HELAPOS_BASE_URL — adjust when HelaPay share the real path */
  HELAPOS_CREATE_QR_PATH: z.string().default('/qr/create'),
  HELAPOS_AUTH_MODE: z.enum(['basic', 'headers', 'bearer']).optional().default('basic'),
  /** Optional shared secret for webhook HMAC / header verify (if HelaPay provide one) */
  HELAPOS_WEBHOOK_SECRET: z.string().optional(),
  /** Comma-separated CIDRs/IPs allowed to hit notify URL (empty = allow all) */
  HELAPOS_ALLOWED_IPS: z.string().optional(),
  /** Require HMAC signature even in non-production when secret is set (default true) */
  HELAPOS_REQUIRE_SIGNATURE: z.enum(['true', 'false']).optional().default('true'),
  /** QR session TTL minutes */
  HELAPOS_SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(60).optional().default(15),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format())
  process.exit(1)
}

export const env = parsed.data
