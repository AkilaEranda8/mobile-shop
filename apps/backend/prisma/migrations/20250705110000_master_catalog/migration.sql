-- Master Catalog (global, Super Admin managed)

DO $$ BEGIN
  CREATE TYPE "MasterCatalogBrandType" AS ENUM ('PHONE', 'ACCESSORY', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MasterCatalogCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MasterCatalogCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MasterCatalogCategory_name_key" ON "MasterCatalogCategory"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "MasterCatalogCategory_slug_key" ON "MasterCatalogCategory"("slug");

CREATE TABLE IF NOT EXISTS "MasterCatalogBrand" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "MasterCatalogBrandType" NOT NULL DEFAULT 'BOTH',
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MasterCatalogBrand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MasterCatalogBrand_name_key" ON "MasterCatalogBrand"("name");

CREATE TABLE IF NOT EXISTS "MasterCatalogPhoneModel" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "releaseYear" INTEGER,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "trackImei" BOOLEAN NOT NULL DEFAULT true,
  "defaultWarrantyMonths" INTEGER NOT NULL DEFAULT 12,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MasterCatalogPhoneModel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MasterCatalogPhoneModel_brandId_name_key" ON "MasterCatalogPhoneModel"("brandId", "name");

CREATE TABLE IF NOT EXISTS "MasterCatalogPhoneVariant" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "storage" TEXT NOT NULL,
  "colorName" TEXT NOT NULL,
  "colorHex" TEXT,
  "skuSuffix" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MasterCatalogPhoneVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MasterCatalogPhoneVariant_modelId_storage_colorName_key"
  ON "MasterCatalogPhoneVariant"("modelId", "storage", "colorName");

CREATE TABLE IF NOT EXISTS "MasterCatalogAccessory" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "brandId" TEXT,
  "name" TEXT NOT NULL,
  "modelOptional" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MasterCatalogAccessory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MasterCatalogAccessory_categoryId_name_brandId_key"
  ON "MasterCatalogAccessory"("categoryId", "name", "brandId");

DO $$ BEGIN
  ALTER TABLE "MasterCatalogPhoneModel"
    ADD CONSTRAINT "MasterCatalogPhoneModel_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "MasterCatalogBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MasterCatalogPhoneModel"
    ADD CONSTRAINT "MasterCatalogPhoneModel_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "MasterCatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MasterCatalogPhoneVariant"
    ADD CONSTRAINT "MasterCatalogPhoneVariant_modelId_fkey"
    FOREIGN KEY ("modelId") REFERENCES "MasterCatalogPhoneModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MasterCatalogAccessory"
    ADD CONSTRAINT "MasterCatalogAccessory_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "MasterCatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MasterCatalogAccessory"
    ADD CONSTRAINT "MasterCatalogAccessory_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "MasterCatalogBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
