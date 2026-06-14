-- Profit Allocation & Fund Management module (isolated tables)

CREATE TYPE "ProfitFundType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE', 'MANUAL');
CREATE TYPE "ProfitTxnType" AS ENUM ('ALLOCATION', 'WITHDRAW', 'DEPOSIT', 'ADJUSTMENT');

CREATE TABLE "ProfitFund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProfitFundType" NOT NULL,
    "fixedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitFund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfitAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "todaySales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "todayProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAllocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfitAllocationLine" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "todayAllocation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yesterdayBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ProfitAllocationLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfitTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "ProfitTxnType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfitWithdrawal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "type" "ProfitTxnType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitWithdrawal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfitFund_tenantId_branchId_name_key" ON "ProfitFund"("tenantId", "branchId", "name");
CREATE INDEX "ProfitFund_tenantId_branchId_idx" ON "ProfitFund"("tenantId", "branchId");

CREATE UNIQUE INDEX "ProfitAllocation_tenantId_branchId_date_key" ON "ProfitAllocation"("tenantId", "branchId", "date");
CREATE INDEX "ProfitAllocation_tenantId_date_idx" ON "ProfitAllocation"("tenantId", "date");

CREATE UNIQUE INDEX "ProfitAllocationLine_allocationId_fundId_key" ON "ProfitAllocationLine"("allocationId", "fundId");

CREATE INDEX "ProfitTransaction_tenantId_branchId_date_idx" ON "ProfitTransaction"("tenantId", "branchId", "date");
CREATE INDEX "ProfitTransaction_fundId_idx" ON "ProfitTransaction"("fundId");

CREATE INDEX "ProfitWithdrawal_tenantId_fundId_idx" ON "ProfitWithdrawal"("tenantId", "fundId");
CREATE INDEX "ProfitWithdrawal_tenantId_branchId_idx" ON "ProfitWithdrawal"("tenantId", "branchId");

ALTER TABLE "ProfitFund" ADD CONSTRAINT "ProfitFund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfitFund" ADD CONSTRAINT "ProfitFund_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProfitAllocation" ADD CONSTRAINT "ProfitAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfitAllocation" ADD CONSTRAINT "ProfitAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProfitAllocationLine" ADD CONSTRAINT "ProfitAllocationLine_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "ProfitAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfitAllocationLine" ADD CONSTRAINT "ProfitAllocationLine_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "ProfitFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfitTransaction" ADD CONSTRAINT "ProfitTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfitTransaction" ADD CONSTRAINT "ProfitTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfitTransaction" ADD CONSTRAINT "ProfitTransaction_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "ProfitFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfitWithdrawal" ADD CONSTRAINT "ProfitWithdrawal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfitWithdrawal" ADD CONSTRAINT "ProfitWithdrawal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfitWithdrawal" ADD CONSTRAINT "ProfitWithdrawal_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "ProfitFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
