-- Snapshot unit cost on each sale line so gross profit uses PO-received cost, not stale add-product price.
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Prefer variant costPrice matched by SKU (set on PO receive), else product buyingPrice.
UPDATE "SaleItem" si
SET "unitCost" = COALESCE(
  NULLIF((
    SELECT (elem->>'costPrice')::float
    FROM jsonb_array_elements(p."storageVariations"::jsonb) AS elem
    WHERE jsonb_typeof(p."storageVariations"::jsonb) = 'array'
      AND si.sku <> ''
      AND elem->>'sku' = si.sku
      AND NULLIF(elem->>'costPrice', '') IS NOT NULL
    LIMIT 1
  ), 0),
  p."buyingPrice",
  0
)
FROM "Product" p
WHERE si."productId" = p.id
  AND si."unitCost" = 0;
