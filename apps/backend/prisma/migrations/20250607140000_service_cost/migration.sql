-- Add cost field to services (internal cost / COGS for POS margin display)
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "cost" DOUBLE PRECISION NOT NULL DEFAULT 0;
