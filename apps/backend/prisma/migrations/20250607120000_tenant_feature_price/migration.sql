-- Add optional monthly price for priced tenant features (POS, Services)
ALTER TABLE "TenantFeature" ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION;
