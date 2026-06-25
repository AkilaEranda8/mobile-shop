-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('BRAND_NEW', 'USED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "condition" "ProductCondition" NOT NULL DEFAULT 'BRAND_NEW';
