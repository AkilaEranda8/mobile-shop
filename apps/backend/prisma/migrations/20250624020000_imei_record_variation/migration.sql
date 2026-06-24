-- Add variation to ImeiRecord
ALTER TABLE "ImeiRecord" ADD COLUMN IF NOT EXISTS "variation" TEXT;
