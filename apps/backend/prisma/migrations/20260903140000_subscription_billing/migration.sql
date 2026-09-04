-- Platform SaaS subscription billing ledger (permanent monthly invoices + payments)

CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "SubscriptionPaymentChannel" AS ENUM (
  'MANUAL_BANK_TRANSFER',
  'CASH',
  'OTHER',
  'PAYHERE',
  'WEBXPAY',
  'OTHER_GATEWAY'
);

CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 1,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "mrrSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "channel" "SubscriptionPaymentChannel" NOT NULL DEFAULT 'MANUAL_BANK_TRANSFER',
    "methodLabel" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "bankName" TEXT,
    "accountRef" TEXT,
    "transactionRef" TEXT,
    "slipUrl" TEXT,
    "slipFilename" TEXT,
    "notes" TEXT,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedByEmail" TEXT,
    "submittedById" TEXT,
    "gatewayPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice"("invoiceNumber");
CREATE UNIQUE INDEX "SubscriptionInvoice_tenantId_billingPeriodStart_billingPeriodEnd_key"
  ON "SubscriptionInvoice"("tenantId", "billingPeriodStart", "billingPeriodEnd");
CREATE INDEX "SubscriptionInvoice_tenantId_status_idx" ON "SubscriptionInvoice"("tenantId", "status");
CREATE INDEX "SubscriptionInvoice_tenantId_dueDate_idx" ON "SubscriptionInvoice"("tenantId", "dueDate");
CREATE INDEX "SubscriptionInvoice_status_dueDate_idx" ON "SubscriptionInvoice"("status", "dueDate");
CREATE INDEX "SubscriptionInvoice_issueDate_idx" ON "SubscriptionInvoice"("issueDate");

CREATE INDEX "SubscriptionPayment_tenantId_status_idx" ON "SubscriptionPayment"("tenantId", "status");
CREATE INDEX "SubscriptionPayment_invoiceId_status_idx" ON "SubscriptionPayment"("invoiceId", "status");
CREATE INDEX "SubscriptionPayment_status_createdAt_idx" ON "SubscriptionPayment"("status", "createdAt");
CREATE INDEX "SubscriptionPayment_transactionRef_idx" ON "SubscriptionPayment"("transactionRef");

ALTER TABLE "SubscriptionInvoice"
  ADD CONSTRAINT "SubscriptionInvoice_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionPayment"
  ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionPayment"
  ADD CONSTRAINT "SubscriptionPayment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
