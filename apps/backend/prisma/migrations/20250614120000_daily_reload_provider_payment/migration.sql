-- CreateTable
CREATE TABLE "DailyReloadProviderPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "reloadTotal" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paidBy" TEXT NOT NULL,
    "financeTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReloadProviderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReloadProviderPayment_tenantId_businessDate_idx" ON "DailyReloadProviderPayment"("tenantId", "businessDate");

-- AddForeignKey
ALTER TABLE "DailyReloadProviderPayment" ADD CONSTRAINT "DailyReloadProviderPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReloadProviderPayment" ADD CONSTRAINT "DailyReloadProviderPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
