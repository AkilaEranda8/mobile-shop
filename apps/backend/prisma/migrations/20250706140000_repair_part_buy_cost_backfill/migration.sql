-- Backfill buy cost from product for existing spare parts
UPDATE "RepairSparePart" AS p
SET "unitBuyCost" = pr."buyingPrice"
FROM "Product" AS pr
WHERE p."productId" = pr.id
  AND (p."unitBuyCost" IS NULL OR p."unitBuyCost" = 0)
  AND pr."buyingPrice" > 0;
