ALTER TABLE "Warranty" ADD COLUMN "branchId" TEXT;

UPDATE "Warranty" AS w
SET "branchId" = s."branchId"
FROM "Sale" AS s
WHERE w."branchId" IS NULL
  AND w."saleId" = s."id"
  AND s."branchId" IS NOT NULL;

UPDATE "Warranty" AS w
SET "branchId" = p."branchId"
FROM "Product" AS p
WHERE w."branchId" IS NULL
  AND w."productId" = p."id"
  AND p."branchId" IS NOT NULL;

UPDATE "Warranty" AS w
SET "branchId" = b."id"
FROM "Branch" AS b
WHERE w."branchId" IS NULL
  AND b."tenantId" = w."tenantId"
  AND b."isDefault" = TRUE;

CREATE INDEX "Warranty_tenantId_branchId_idx" ON "Warranty"("tenantId", "branchId");

ALTER TABLE "Warranty"
ADD CONSTRAINT "Warranty_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
