-- Generic payment fee & clearance (additive, safe defaults)
DO $$ BEGIN
  CREATE TYPE "PaymentClearanceStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'CLEARED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "customerFeeTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "SalePayment" ADD COLUMN IF NOT EXISTS "methodConfigId" TEXT;
ALTER TABLE "SalePayment" ADD COLUMN IF NOT EXISTS "methodLabel" TEXT;
ALTER TABLE "SalePayment" ADD COLUMN IF NOT EXISTS "customerFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SalePayment" ADD COLUMN IF NOT EXISTS "feeType" TEXT;
ALTER TABLE "SalePayment" ADD COLUMN IF NOT EXISTS "feeRate" DOUBLE PRECISION;
ALTER TABLE "SalePayment" ADD COLUMN IF NOT EXISTS "feeVersion" INTEGER;
ALTER TABLE "SalePayment" ADD COLUMN IF NOT EXISTS "clearanceStatus" "PaymentClearanceStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "SalePayment" ADD COLUMN IF NOT EXISTS "clearanceGlAccountId" TEXT;

CREATE TABLE IF NOT EXISTS "PaymentClearance" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT,
  "saleId" TEXT NOT NULL,
  "salePaymentId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "methodConfigId" TEXT,
  "methodLabel" TEXT,
  "grossAmount" DOUBLE PRECISION NOT NULL,
  "providerDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netAmount" DOUBLE PRECISION NOT NULL,
  "destinationType" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "clearedAt" TIMESTAMP(3) NOT NULL,
  "reference" TEXT,
  "journalEntryId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "reversedAt" TIMESTAMP(3),
  "reversedBy" TEXT,
  "reversalJournalId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentClearance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentClearance_tenantId_saleId_idx" ON "PaymentClearance"("tenantId", "saleId");
CREATE INDEX IF NOT EXISTS "PaymentClearance_tenantId_salePaymentId_idx" ON "PaymentClearance"("tenantId", "salePaymentId");
CREATE INDEX IF NOT EXISTS "PaymentClearance_tenantId_clearedAt_idx" ON "PaymentClearance"("tenantId", "clearedAt");
