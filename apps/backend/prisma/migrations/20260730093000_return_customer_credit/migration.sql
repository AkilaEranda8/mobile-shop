-- Customer store credit (shop owes customer) + return settlement split
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "creditBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "SaleReturn" ADD COLUMN IF NOT EXISTS "outstandingApplied" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SaleReturn" ADD COLUMN IF NOT EXISTS "customerCreditCreated" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- GL subtype for Customer Credits Payable
DO $$ BEGIN
  ALTER TYPE "GlAccountSubtype" ADD VALUE IF NOT EXISTS 'CUSTOMER_CREDIT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
