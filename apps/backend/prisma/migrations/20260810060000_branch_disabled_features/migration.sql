-- AlterTable
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "disabledFeatures" JSONB;
