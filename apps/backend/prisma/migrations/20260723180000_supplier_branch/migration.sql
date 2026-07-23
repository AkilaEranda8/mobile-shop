-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Supplier_tenantId_branchId_idx" ON "Supplier"("tenantId", "branchId");

-- AddForeignKey (idempotent-ish: drop if exists then add)
DO $$ BEGIN
  ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Backfill from latest PO for that supplier
UPDATE "Supplier" s
SET "branchId" = sub."branchId"
FROM (
  SELECT DISTINCT ON (po."supplierId")
    po."supplierId",
    po."branchId"
  FROM "PurchaseOrder" po
  WHERE po."branchId" IS NOT NULL
  ORDER BY po."supplierId", po."createdAt" DESC
) sub
WHERE s.id = sub."supplierId"
  AND s."branchId" IS NULL;

-- Remaining → tenant default / HQ / first active branch
UPDATE "Supplier" s
SET "branchId" = b.id
FROM (
  SELECT DISTINCT ON (br."tenantId")
    br."tenantId",
    br.id
  FROM "Branch" br
  WHERE br."isActive" = true
  ORDER BY br."tenantId",
    br."isDefault" DESC,
    br."isHeadquarters" DESC,
    br."createdAt" ASC
) b
WHERE s."tenantId" = b."tenantId"
  AND s."branchId" IS NULL;
