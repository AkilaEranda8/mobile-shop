-- Demo data lifecycle for new tenant onboarding
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "demoDataInstalled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "demoDataManifest" JSONB;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "demoDataClearedAt" TIMESTAMP(3);
