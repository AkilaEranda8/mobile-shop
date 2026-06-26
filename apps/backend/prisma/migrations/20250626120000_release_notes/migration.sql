-- Release Notes
CREATE TABLE IF NOT EXISTS "Release" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "popupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "targetType" TEXT NOT NULL DEFAULT 'ALL',
    "targetPlans" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetTenants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "docUrl" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReleaseItem" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "module" TEXT,
    "featureName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "badge" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "docUrl" TEXT,

    CONSTRAINT "ReleaseItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TenantReleaseRead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "TenantReleaseRead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Release_status_releaseDate_idx" ON "Release"("status", "releaseDate");
CREATE INDEX IF NOT EXISTS "Release_version_idx" ON "Release"("version");
CREATE INDEX IF NOT EXISTS "ReleaseItem_releaseId_displayOrder_idx" ON "ReleaseItem"("releaseId", "displayOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "TenantReleaseRead_tenantId_releaseId_key" ON "TenantReleaseRead"("tenantId", "releaseId");
CREATE INDEX IF NOT EXISTS "TenantReleaseRead_tenantId_idx" ON "TenantReleaseRead"("tenantId");
CREATE INDEX IF NOT EXISTS "TenantReleaseRead_releaseId_idx" ON "TenantReleaseRead"("releaseId");

DO $$ BEGIN
  ALTER TABLE "ReleaseItem" ADD CONSTRAINT "ReleaseItem_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TenantReleaseRead" ADD CONSTRAINT "TenantReleaseRead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TenantReleaseRead" ADD CONSTRAINT "TenantReleaseRead_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
