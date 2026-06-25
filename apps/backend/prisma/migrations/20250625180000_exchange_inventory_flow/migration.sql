-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'EXCHANGE_IN';

-- AlterTable
ALTER TABLE "DeviceExchange" ADD COLUMN "customerAddress" TEXT,
ADD COLUMN "oldProductName" TEXT,
ADD COLUMN "oldColor" TEXT,
ADD COLUMN "oldStorage" TEXT,
ADD COLUMN "oldProductId" TEXT,
ADD COLUMN "tradeInImeiRecordId" TEXT,
ADD COLUMN "newColor" TEXT,
ADD COLUMN "newStorage" TEXT,
ADD COLUMN "soldProductId" TEXT,
ADD COLUMN "soldVariation" TEXT,
ADD COLUMN "balanceAmount" DOUBLE PRECISION,
ADD COLUMN "balanceDirection" TEXT,
ADD COLUMN "invoiceNumber" TEXT;
