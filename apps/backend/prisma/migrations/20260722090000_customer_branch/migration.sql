-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "branchId" TEXT;

-- CreateIndex
CREATE INDEX "Customer_tenantId_branchId_idx" ON "Customer"("tenantId", "branchId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill home branch from the customer's latest sale (prefer open due sales)
UPDATE "Customer" c
SET "branchId" = sub."branchId"
FROM (
  SELECT DISTINCT ON (s."customerId")
    s."customerId",
    s."branchId"
  FROM "Sale" s
  WHERE s."customerId" IS NOT NULL
    AND s."branchId" IS NOT NULL
  ORDER BY s."customerId",
    CASE WHEN s."dueAmount" > 0 THEN 0 ELSE 1 END,
    s."createdAt" DESC
) sub
WHERE c.id = sub."customerId"
  AND c."branchId" IS NULL;

-- Remaining customers → tenant default / HQ / first active branch
UPDATE "Customer" c
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
WHERE c."tenantId" = b."tenantId"
  AND c."branchId" IS NULL;
