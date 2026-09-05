-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "customerCreditSettings" JSONB;
