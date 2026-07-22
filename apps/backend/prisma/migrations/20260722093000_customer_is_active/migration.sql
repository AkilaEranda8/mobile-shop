-- Soft-deactivate support for customers (history preserved when inactive)
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "Customer_tenantId_isActive_idx" ON "Customer"("tenantId", "isActive");
