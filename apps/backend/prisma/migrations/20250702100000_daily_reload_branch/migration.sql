-- Add branch scoping to daily reload records (POS + imports)
ALTER TABLE "DailyReload" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

CREATE INDEX IF NOT EXISTS "DailyReload_tenantId_branchId_reloadDate_idx"
  ON "DailyReload"("tenantId", "branchId", "reloadDate");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DailyReload_branchId_fkey'
  ) THEN
    ALTER TABLE "DailyReload"
      ADD CONSTRAINT "DailyReload_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill branch from POS sale invoice numbers
UPDATE "DailyReload" dr
SET "branchId" = s."branchId"
FROM "Sale" s
WHERE dr."transactionId" = s."invoiceNumber"
  AND dr."tenantId" = s."tenantId"
  AND dr."branchId" IS NULL;
