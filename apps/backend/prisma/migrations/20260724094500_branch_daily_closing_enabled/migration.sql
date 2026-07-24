-- AlterTable
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "dailyClosingEnabled" BOOLEAN NOT NULL DEFAULT true;
