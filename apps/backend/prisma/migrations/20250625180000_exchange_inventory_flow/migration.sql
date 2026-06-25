-- AlterEnum (idempotent — safe if label already exists from a prior partial deploy)
DO $$ BEGIN
  ALTER TYPE "StockMovementType" ADD VALUE 'EXCHANGE_IN';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable (idempotent)
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "oldProductName" TEXT;
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "oldColor" TEXT;
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "oldStorage" TEXT;
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "oldProductId" TEXT;
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "tradeInImeiRecordId" TEXT;
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "newColor" TEXT;
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "newStorage" TEXT;
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "soldProductId" TEXT;
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "soldVariation" TEXT;
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "balanceAmount" DOUBLE PRECISION;
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "balanceDirection" TEXT;
ALTER TABLE "DeviceExchange" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
