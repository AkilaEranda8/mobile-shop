-- Link IMEI records to purchase orders for PO-based device registration
ALTER TABLE "ImeiRecord" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT;
ALTER TABLE "ImeiRecord" ADD COLUMN IF NOT EXISTS "poItemId" TEXT;

DO $$ BEGIN
  ALTER TABLE "ImeiRecord"
    ADD CONSTRAINT "ImeiRecord_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
