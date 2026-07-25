ALTER TYPE "ImeiStatus" ADD VALUE IF NOT EXISTS 'UNDER_HIRE_PURCHASE';

DO $$ BEGIN CREATE TYPE "HpInterestType" AS ENUM ('NONE', 'FLAT', 'REDUCING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "HpAgreementStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DEFAULTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "HpInstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "HpPaymentStatus" AS ENUM ('COMPLETED', 'REVERSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "HpDocumentType" AS ENUM ('CUSTOMER_PHOTO', 'CUSTOMER_NIC_FRONT', 'CUSTOMER_NIC_BACK', 'PROOF_OF_ADDRESS', 'GUARANTOR_PHOTO', 'GUARANTOR_NIC_FRONT', 'GUARANTOR_NIC_BACK', 'CUSTOMER_SIGNATURE', 'AGREEMENT_PDF', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "HirePurchaseAgreement" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "branchId" TEXT NOT NULL,
  "agreementNumber" TEXT NOT NULL, "customerId" TEXT NOT NULL, "saleId" TEXT,
  "productId" TEXT, "imeiRecordId" TEXT, "salesPersonId" TEXT,
  "productName" TEXT NOT NULL, "brandName" TEXT, "modelName" TEXT, "imei" TEXT NOT NULL,
  "color" TEXT, "storage" TEXT, "cashPrice" DOUBLE PRECISION NOT NULL,
  "downPayment" DOUBLE PRECISION NOT NULL DEFAULT 0, "financeAmount" DOUBLE PRECISION NOT NULL,
  "interestType" "HpInterestType" NOT NULL, "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "interestAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "processingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "insuranceFee" DOUBLE PRECISION NOT NULL DEFAULT 0, "documentFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "otherCharges" DOUBLE PRECISION NOT NULL DEFAULT 0, "installmentMonths" INTEGER NOT NULL,
  "monthlyInstallment" DOUBLE PRECISION NOT NULL, "totalPayable" DOUBLE PRECISION NOT NULL,
  "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "outstandingBalance" DOUBLE PRECISION NOT NULL,
  "gracePeriodDays" INTEGER NOT NULL DEFAULT 0, "lateFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dueDay" INTEGER NOT NULL, "firstDueDate" DATE NOT NULL, "customerNic" TEXT,
  "customerDob" DATE, "occupation" TEXT, "monthlyIncome" DOUBLE PRECISION, "employer" TEXT,
  "agreementPdfUrl" TEXT, "qrCode" TEXT, "barcode" TEXT, "customerSignatureUrl" TEXT,
  "status" "HpAgreementStatus" NOT NULL DEFAULT 'PENDING', "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HirePurchaseAgreement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HirePurchaseInstallment" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "agreementId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL, "dueDate" DATE NOT NULL, "principal" DOUBLE PRECISION NOT NULL,
  "interest" DOUBLE PRECISION NOT NULL, "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalDue" DOUBLE PRECISION NOT NULL, "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "outstanding" DOUBLE PRECISION NOT NULL, "status" "HpInstallmentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "HirePurchaseInstallment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HirePurchasePayment" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "agreementId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL, "amount" DOUBLE PRECISION NOT NULL,
  "principalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "interestAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "penaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "methods" JSONB NOT NULL, "allocationJson" JSONB NOT NULL,
  "reference" TEXT, "notes" TEXT, "status" "HpPaymentStatus" NOT NULL DEFAULT 'COMPLETED',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "performedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HirePurchasePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HirePurchaseGuarantor" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "agreementId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "nic" TEXT NOT NULL, "phone" TEXT NOT NULL, "address" TEXT, "relationship" TEXT,
  "photoUrl" TEXT, "nicFrontUrl" TEXT, "nicBackUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HirePurchaseGuarantor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HirePurchaseDocument" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "agreementId" TEXT NOT NULL,
  "guarantorId" TEXT, "type" "HpDocumentType" NOT NULL, "fileName" TEXT NOT NULL, "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT, "fileSize" INTEGER, "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HirePurchaseDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HirePurchasePenalty" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "agreementId" TEXT NOT NULL,
  "installmentId" TEXT, "amount" DOUBLE PRECISION NOT NULL, "reason" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "waivedAt" TIMESTAMP(3), "waivedBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "HirePurchasePenalty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HirePurchaseSettings" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "branchId" TEXT NOT NULL,
  "defaultInterestType" "HpInterestType" NOT NULL DEFAULT 'FLAT',
  "defaultInterestRate" DOUBLE PRECISION NOT NULL DEFAULT 0, "defaultLateFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "defaultGracePeriod" INTEGER NOT NULL DEFAULT 3, "defaultDueDay" INTEGER NOT NULL DEFAULT 1,
  "agreementTemplate" TEXT, "receiptTemplate" TEXT, "reminderSettings" JSONB, "penaltyRules" JSONB,
  "smsProviderSettings" JSONB, "whatsappSettings" JSONB,
  "rolePermissions" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HirePurchaseSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HirePurchaseLog" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "agreementId" TEXT,
  "action" TEXT NOT NULL, "actorId" TEXT, "actorEmail" TEXT, "beforeJson" JSONB, "afterJson" JSONB,
  "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HirePurchaseLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HirePurchaseAgreement_tenantId_agreementNumber_key" ON "HirePurchaseAgreement"("tenantId", "agreementNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "HirePurchaseAgreement_saleId_key" ON "HirePurchaseAgreement"("saleId");
CREATE INDEX IF NOT EXISTS "HirePurchaseAgreement_tenantId_branchId_status_idx" ON "HirePurchaseAgreement"("tenantId", "branchId", "status");
CREATE INDEX IF NOT EXISTS "HirePurchaseAgreement_tenantId_branchId_imei_idx" ON "HirePurchaseAgreement"("tenantId", "branchId", "imei");
CREATE INDEX IF NOT EXISTS "HirePurchaseAgreement_tenantId_customerId_idx" ON "HirePurchaseAgreement"("tenantId", "customerId");
CREATE UNIQUE INDEX IF NOT EXISTS "HirePurchaseInstallment_agreementId_sequence_key" ON "HirePurchaseInstallment"("agreementId", "sequence");
CREATE INDEX IF NOT EXISTS "HirePurchaseInstallment_tenantId_branchId_dueDate_status_idx" ON "HirePurchaseInstallment"("tenantId", "branchId", "dueDate", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "HirePurchasePayment_tenantId_receiptNumber_key" ON "HirePurchasePayment"("tenantId", "receiptNumber");
CREATE INDEX IF NOT EXISTS "HirePurchasePayment_tenantId_branchId_occurredAt_idx" ON "HirePurchasePayment"("tenantId", "branchId", "occurredAt");
CREATE INDEX IF NOT EXISTS "HirePurchasePayment_agreementId_occurredAt_idx" ON "HirePurchasePayment"("agreementId", "occurredAt");
CREATE INDEX IF NOT EXISTS "HirePurchaseGuarantor_tenantId_branchId_nic_idx" ON "HirePurchaseGuarantor"("tenantId", "branchId", "nic");
CREATE INDEX IF NOT EXISTS "HirePurchaseGuarantor_agreementId_idx" ON "HirePurchaseGuarantor"("agreementId");
CREATE INDEX IF NOT EXISTS "HirePurchaseDocument_tenantId_branchId_agreementId_idx" ON "HirePurchaseDocument"("tenantId", "branchId", "agreementId");
CREATE INDEX IF NOT EXISTS "HirePurchasePenalty_tenantId_branchId_appliedAt_idx" ON "HirePurchasePenalty"("tenantId", "branchId", "appliedAt");
CREATE INDEX IF NOT EXISTS "HirePurchasePenalty_agreementId_idx" ON "HirePurchasePenalty"("agreementId");
CREATE UNIQUE INDEX IF NOT EXISTS "HirePurchaseSettings_tenantId_branchId_key" ON "HirePurchaseSettings"("tenantId", "branchId");
CREATE INDEX IF NOT EXISTS "HirePurchaseLog_tenantId_branchId_createdAt_idx" ON "HirePurchaseLog"("tenantId", "branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "HirePurchaseLog_agreementId_createdAt_idx" ON "HirePurchaseLog"("agreementId", "createdAt");

ALTER TABLE "HirePurchaseAgreement" ADD CONSTRAINT "HirePurchaseAgreement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseAgreement" ADD CONSTRAINT "HirePurchaseAgreement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseAgreement" ADD CONSTRAINT "HirePurchaseAgreement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseAgreement" ADD CONSTRAINT "HirePurchaseAgreement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseAgreement" ADD CONSTRAINT "HirePurchaseAgreement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseAgreement" ADD CONSTRAINT "HirePurchaseAgreement_imeiRecordId_fkey" FOREIGN KEY ("imeiRecordId") REFERENCES "ImeiRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseAgreement" ADD CONSTRAINT "HirePurchaseAgreement_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HirePurchaseInstallment" ADD CONSTRAINT "HirePurchaseInstallment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseInstallment" ADD CONSTRAINT "HirePurchaseInstallment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseInstallment" ADD CONSTRAINT "HirePurchaseInstallment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "HirePurchaseAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchasePayment" ADD CONSTRAINT "HirePurchasePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchasePayment" ADD CONSTRAINT "HirePurchasePayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HirePurchasePayment" ADD CONSTRAINT "HirePurchasePayment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "HirePurchaseAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseGuarantor" ADD CONSTRAINT "HirePurchaseGuarantor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseGuarantor" ADD CONSTRAINT "HirePurchaseGuarantor_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseGuarantor" ADD CONSTRAINT "HirePurchaseGuarantor_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "HirePurchaseAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseDocument" ADD CONSTRAINT "HirePurchaseDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseDocument" ADD CONSTRAINT "HirePurchaseDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseDocument" ADD CONSTRAINT "HirePurchaseDocument_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "HirePurchaseAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseDocument" ADD CONSTRAINT "HirePurchaseDocument_guarantorId_fkey" FOREIGN KEY ("guarantorId") REFERENCES "HirePurchaseGuarantor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HirePurchasePenalty" ADD CONSTRAINT "HirePurchasePenalty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchasePenalty" ADD CONSTRAINT "HirePurchasePenalty_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HirePurchasePenalty" ADD CONSTRAINT "HirePurchasePenalty_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "HirePurchaseAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchasePenalty" ADD CONSTRAINT "HirePurchasePenalty_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "HirePurchaseInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseSettings" ADD CONSTRAINT "HirePurchaseSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseSettings" ADD CONSTRAINT "HirePurchaseSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseLog" ADD CONSTRAINT "HirePurchaseLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseLog" ADD CONSTRAINT "HirePurchaseLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HirePurchaseLog" ADD CONSTRAINT "HirePurchaseLog_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "HirePurchaseAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
