-- Add linkage from SaleReturnItem -> SaleItem for robust return validation/audit

ALTER TABLE "SaleReturnItem"
ADD COLUMN IF NOT EXISTS "saleItemId" TEXT;

CREATE INDEX IF NOT EXISTS "SaleReturnItem_saleItemId_idx"
ON "SaleReturnItem" ("saleItemId");

ALTER TABLE "SaleReturnItem"
ADD CONSTRAINT "SaleReturnItem_saleItemId_fkey"
FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

