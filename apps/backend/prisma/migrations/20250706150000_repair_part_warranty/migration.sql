-- Spare part warranty snapshot from product at add time
ALTER TABLE "RepairSparePart" ADD COLUMN "warrantyMonths" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RepairSparePart" ADD COLUMN "warrantyNote" TEXT;

UPDATE "RepairSparePart" AS p
SET
  "warrantyMonths" = pr."warrantyMonths",
  "warrantyNote" = pr."warrantyNote"
FROM "Product" AS pr
WHERE p."productId" = pr.id
  AND (p."warrantyMonths" IS NULL OR p."warrantyMonths" = 0);
