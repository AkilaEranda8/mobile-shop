-- Platform subscription: mark invoice payment due without extending access
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paymentDue" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paymentDueAmount" DOUBLE PRECISION;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paymentDueInvoiceNo" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paymentDueMonths" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paymentDuePeriodStart" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paymentDuePeriodEnd" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paymentDueAt" TIMESTAMP(3);
