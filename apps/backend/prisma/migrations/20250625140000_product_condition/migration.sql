-- CreateEnum (idempotent — safe if type already exists from a prior partial run)
DO $$ BEGIN
    CREATE TYPE "ProductCondition" AS ENUM ('BRAND_NEW', 'USED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "condition" "ProductCondition" NOT NULL DEFAULT 'BRAND_NEW';
