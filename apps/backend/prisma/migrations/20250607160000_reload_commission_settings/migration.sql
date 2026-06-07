-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "reloadSettings" JSONB;

-- AlterTable
ALTER TABLE "DailyReload" ADD COLUMN "provider" TEXT;
