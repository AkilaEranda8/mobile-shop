-- CreateTable
CREATE TABLE "SupplierPaymentAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- Backfill legacy/new single-link supplier payments so every payment has at
-- least one durable allocation when a primary purchase order is known.
INSERT INTO "SupplierPaymentAllocation" (
    "id", "tenantId", "transactionId", "purchaseOrderId", "amount", "createdAt"
)
SELECT
    'spa-' || t.id,
    t."tenantId",
    t.id,
    t."purchaseOrderId",
    t.amount,
    t."createdAt"
FROM "Transaction" t
WHERE t.type = 'EXPENSE'
  AND t.category = 'Supplier Payment'
  AND t."purchaseOrderId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPaymentAllocation_transactionId_purchaseOrderId_key"
ON "SupplierPaymentAllocation"("transactionId", "purchaseOrderId");

CREATE INDEX "SupplierPaymentAllocation_tenantId_purchaseOrderId_idx"
ON "SupplierPaymentAllocation"("tenantId", "purchaseOrderId");

CREATE INDEX "SupplierPaymentAllocation_tenantId_transactionId_idx"
ON "SupplierPaymentAllocation"("tenantId", "transactionId");

-- AddForeignKey
ALTER TABLE "SupplierPaymentAllocation"
ADD CONSTRAINT "SupplierPaymentAllocation_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierPaymentAllocation"
ADD CONSTRAINT "SupplierPaymentAllocation_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
