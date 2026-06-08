-- CreateEnum
CREATE TYPE "DailyClosingStatus" AS ENUM ('DRAFT', 'CLOSED');

-- CreateTable
CREATE TABLE "DailyClosing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "DailyClosingStatus" NOT NULL DEFAULT 'DRAFT',
    "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mobileSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accessorySales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serviceIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "repairIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billPaymentIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reloadSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cogs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reloadCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankDeposits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qrPayments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cardPayments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashVariance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashInBank" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mobilesSold" INTEGER NOT NULL DEFAULT 0,
    "imeisRegistered" INTEGER NOT NULL DEFAULT 0,
    "pendingImeis" INTEGER NOT NULL DEFAULT 0,
    "warrantiesActivated" INTEGER NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "newCustomers" INTEGER NOT NULL DEFAULT 0,
    "repairsCompleted" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" JSONB,
    "expenseBreakdown" JSONB,
    "reloadBreakdown" JSONB,
    "insightsJson" JSONB,
    "notes" TEXT,
    "closedBy" TEXT,
    "closedByName" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyClosingCashCount" (
    "id" TEXT NOT NULL,
    "closingId" TEXT NOT NULL,
    "d5000" INTEGER NOT NULL DEFAULT 0,
    "d2000" INTEGER NOT NULL DEFAULT 0,
    "d1000" INTEGER NOT NULL DEFAULT 0,
    "d500" INTEGER NOT NULL DEFAULT 0,
    "d100" INTEGER NOT NULL DEFAULT 0,
    "d50" INTEGER NOT NULL DEFAULT 0,
    "d20" INTEGER NOT NULL DEFAULT 0,
    "d10" INTEGER NOT NULL DEFAULT 0,
    "coins" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "DailyClosingCashCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyClosingReport" (
    "id" TEXT NOT NULL,
    "closingId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'PDF',
    "generatedBy" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyClosingReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyClosing_tenantId_branchId_date_key" ON "DailyClosing"("tenantId", "branchId", "date");

-- CreateIndex
CREATE INDEX "DailyClosing_tenantId_date_idx" ON "DailyClosing"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClosingCashCount_closingId_key" ON "DailyClosingCashCount"("closingId");

-- CreateIndex
CREATE INDEX "DailyClosingReport_closingId_idx" ON "DailyClosingReport"("closingId");

-- AddForeignKey
ALTER TABLE "DailyClosing" ADD CONSTRAINT "DailyClosing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyClosing" ADD CONSTRAINT "DailyClosing_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyClosingCashCount" ADD CONSTRAINT "DailyClosingCashCount_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "DailyClosing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyClosingReport" ADD CONSTRAINT "DailyClosingReport_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "DailyClosing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
