-- CreateEnum
CREATE TYPE "GlAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');
CREATE TYPE "GlAccountSubtype" AS ENUM ('CASH', 'BANK', 'AR', 'AP', 'INVENTORY', 'TAX_INPUT', 'TAX_OUTPUT', 'PAYROLL', 'REVENUE', 'COGS', 'OPEX', 'CASH_VARIANCE', 'CONTRA_REVENUE', 'EQUITY', 'RETAINED', 'OTHER');
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'REVERSED');
CREATE TYPE "JournalSourceModule" AS ENUM ('MANUAL', 'SALES', 'PURCHASE', 'REPAIR', 'EXPENSE', 'AR', 'AP', 'CASH_BANK', 'PETTY_CASH', 'PAYROLL', 'TAX', 'PERIOD_CLOSE', 'DAILY_CLOSING');
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'SOFT_CLOSED', 'HARD_CLOSED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "TaxCodeType" AS ENUM ('OUTPUT', 'INPUT');

-- CreateTable
CREATE TABLE "AccountingSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'LKR',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "autoPostEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requireApprovalAbove" DOUBLE PRECISION,
    "initializedAt" TIMESTAMP(3),
    "defaultAccounts" JSONB NOT NULL DEFAULT '{}',
    "expenseCategoryMap" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GlAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GlAccountType" NOT NULL,
    "subtype" "GlAccountSubtype" NOT NULL DEFAULT 'OTHER',
    "parentAccountId" TEXT,
    "isControlAccount" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "periodId" TEXT NOT NULL,
    "entryNo" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "sourceModule" "JournalSourceModule" NOT NULL DEFAULT 'MANUAL',
    "sourceRefType" TEXT,
    "sourceRefId" TEXT,
    "sourceEvent" TEXT,
    "memo" TEXT,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "totalDebit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reversalOfId" TEXT,
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "lineNo" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxCodeId" TEXT,
    "customerId" TEXT,
    "supplierId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountingOutbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutoJournalRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "sourceModule" "JournalSourceModule" NOT NULL,
    "eventType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "conditionsJson" JSONB,
    "linesTemplateJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoJournalRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CashAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "accountNo" TEXT,
    "bankName" TEXT,
    "glAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxCode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "type" "TaxCodeType" NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TaxCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "actorUserId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "requestedBy" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- Indexes & uniques
CREATE UNIQUE INDEX "AccountingSettings_tenantId_key" ON "AccountingSettings"("tenantId");
CREATE UNIQUE INDEX "AccountingPeriod_tenantId_name_key" ON "AccountingPeriod"("tenantId", "name");
CREATE INDEX "AccountingPeriod_tenantId_status_idx" ON "AccountingPeriod"("tenantId", "status");
CREATE UNIQUE INDEX "GlAccount_tenantId_code_key" ON "GlAccount"("tenantId", "code");
CREATE INDEX "GlAccount_tenantId_type_idx" ON "GlAccount"("tenantId", "type");
CREATE INDEX "GlAccount_tenantId_branchId_idx" ON "GlAccount"("tenantId", "branchId");
CREATE UNIQUE INDEX "JournalEntry_tenantId_entryNo_key" ON "JournalEntry"("tenantId", "entryNo");
CREATE UNIQUE INDEX "JournalEntry_tenantId_sourceRefType_sourceRefId_sourceEvent_key" ON "JournalEntry"("tenantId", "sourceRefType", "sourceRefId", "sourceEvent");
CREATE INDEX "JournalEntry_tenantId_entryDate_status_idx" ON "JournalEntry"("tenantId", "entryDate", "status");
CREATE INDEX "JournalEntry_tenantId_branchId_entryDate_idx" ON "JournalEntry"("tenantId", "branchId", "entryDate");
CREATE INDEX "JournalLine_tenantId_accountId_idx" ON "JournalLine"("tenantId", "accountId");
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");
CREATE UNIQUE INDEX "AccountingOutbox_tenantId_sourceType_sourceId_eventType_key" ON "AccountingOutbox"("tenantId", "sourceType", "sourceId", "eventType");
CREATE INDEX "AccountingOutbox_status_createdAt_idx" ON "AccountingOutbox"("status", "createdAt");
CREATE UNIQUE INDEX "IntegrationLink_tenantId_sourceType_sourceId_eventType_key" ON "IntegrationLink"("tenantId", "sourceType", "sourceId", "eventType");
CREATE INDEX "IntegrationLink_journalEntryId_idx" ON "IntegrationLink"("journalEntryId");
CREATE INDEX "AutoJournalRule_tenantId_eventType_enabled_idx" ON "AutoJournalRule"("tenantId", "eventType", "enabled");
CREATE UNIQUE INDEX "CashAccount_tenantId_branchId_name_key" ON "CashAccount"("tenantId", "branchId", "name");
CREATE UNIQUE INDEX "BankAccount_tenantId_name_key" ON "BankAccount"("tenantId", "name");
CREATE UNIQUE INDEX "TaxCode_tenantId_code_key" ON "TaxCode"("tenantId", "code");
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");
CREATE INDEX "AuditEvent_tenantId_entityType_entityId_idx" ON "AuditEvent"("tenantId", "entityType", "entityId");
CREATE INDEX "ApprovalRequest_tenantId_status_idx" ON "ApprovalRequest"("tenantId", "status");

-- Foreign keys
ALTER TABLE "AccountingSettings" ADD CONSTRAINT "AccountingSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GlAccount" ADD CONSTRAINT "GlAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GlAccount" ADD CONSTRAINT "GlAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GlAccount" ADD CONSTRAINT "GlAccount_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "GlAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GlAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingOutbox" ADD CONSTRAINT "AccountingOutbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingOutbox" ADD CONSTRAINT "AccountingOutbox_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntegrationLink" ADD CONSTRAINT "IntegrationLink_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutoJournalRule" ADD CONSTRAINT "AutoJournalRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutoJournalRule" ADD CONSTRAINT "AutoJournalRule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "GlAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "GlAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxCode" ADD CONSTRAINT "TaxCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxCode" ADD CONSTRAINT "TaxCode_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "GlAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
