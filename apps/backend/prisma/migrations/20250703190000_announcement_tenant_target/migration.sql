-- AlterTable
ALTER TABLE "PlatformAnnouncement" ADD COLUMN "targetTenants" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PlatformAnnouncement" ADD COLUMN "dismissible" BOOLEAN NOT NULL DEFAULT true;
