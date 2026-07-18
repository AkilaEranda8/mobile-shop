-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_tenantId_category_createdAt_idx" ON "Transaction"("tenantId", "category", "createdAt");
CREATE INDEX IF NOT EXISTS "Transaction_tenantId_supplierId_idx" ON "Transaction"("tenantId", "supplierId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: link legacy supplier-payment transactions to their supplier by description
-- (descriptions were written as "Payment to <supplier name>...").
-- Longest supplier name wins when one name is a prefix of another.
UPDATE "Transaction" t
SET "supplierId" = m."supplierId"
FROM (
  SELECT DISTINCT ON (t2.id) t2.id AS "txId", s.id AS "supplierId"
  FROM "Transaction" t2
  JOIN "Supplier" s
    ON s."tenantId" = t2."tenantId"
   AND t2."description" LIKE 'Payment to ' || s."name" || '%'
  WHERE t2."supplierId" IS NULL
    AND t2."type" = 'EXPENSE'
    AND t2."category" = 'Supplier Payment'
  ORDER BY t2.id, LENGTH(s."name") DESC
) m
WHERE t.id = m."txId";
