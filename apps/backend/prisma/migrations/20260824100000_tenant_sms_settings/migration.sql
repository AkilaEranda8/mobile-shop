-- Tenant SMS gateway settings (provider + API keys)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "smsSettings" JSONB;
