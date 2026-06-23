-- Add subCategory and deviceModel fields to Product table
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "subCategory" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deviceModel" TEXT;
