-- Backfill isDefault from HQ where tenant has no default branch yet
UPDATE "Branch" b
SET "isDefault" = true
WHERE b."isHeadquarters" = true
  AND b."isActive" = true
  AND NOT EXISTS (
    SELECT 1 FROM "Branch" b2
    WHERE b2."tenantId" = b."tenantId" AND b2."isDefault" = true
  );
