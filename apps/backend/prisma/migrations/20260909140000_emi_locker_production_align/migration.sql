-- EMI Locker production alignment (status machine, dry-run, settings, rename timestamps)

-- Enum value additions (Postgres)
DO $$ BEGIN ALTER TYPE "ManagedDeviceStatus" ADD VALUE IF NOT EXISTS 'ENROLLED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ManagedDeviceStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_DUE'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ManagedDeviceStatus" ADD VALUE IF NOT EXISTS 'ENROLLMENT_FAILED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ManagedDeviceStatus" ADD VALUE IF NOT EXISTS 'MANAGEMENT_ERROR'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ManagedDeviceStatus" ADD VALUE IF NOT EXISTS 'RELEASE_FAILED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TYPE "DeviceCommandStatus" ADD VALUE IF NOT EXISTS 'DRY_RUN'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TYPE "DeviceCommandType" ADD VALUE IF NOT EXISTS 'RELEASE_DEVICE'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rename lock timestamps → restriction timestamps (if old columns exist)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ManagedDevice' AND column_name = 'lockedAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ManagedDevice' AND column_name = 'restrictedAt'
  ) THEN
    ALTER TABLE "ManagedDevice" RENAME COLUMN "lockedAt" TO "restrictedAt";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ManagedDevice' AND column_name = 'unlockedAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ManagedDevice' AND column_name = 'restoredAt'
  ) THEN
    ALTER TABLE "ManagedDevice" RENAME COLUMN "unlockedAt" TO "restoredAt";
  END IF;
END $$;

ALTER TABLE "ManagedDevice" ADD COLUMN IF NOT EXISTS "restrictedAt" TIMESTAMP(3);
ALTER TABLE "ManagedDevice" ADD COLUMN IF NOT EXISTS "restoredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ManagedDevice_tenantId_imeiRecordId_idx" ON "ManagedDevice"("tenantId", "imeiRecordId");

-- Settings expansions
ALTER TABLE "EmiLockerSettings" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EmiLockerSettings" ADD COLUMN IF NOT EXISTS "dryRunEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EmiLockerSettings" ADD COLUMN IF NOT EXISTS "gracePeriodDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmiLockerSettings" ADD COLUMN IF NOT EXISTS "warningDays" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "EmiLockerSettings" ADD COLUMN IF NOT EXISTS "autoRestoreEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EmiLockerSettings" ADD COLUMN IF NOT EXISTS "autoReleaseEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EmiLockerSettings" ADD COLUMN IF NOT EXISTS "restrictionPolicyHint" TEXT;

-- Backfill RELEASE → RELEASE_DEVICE if any rows used old enum (only when RELEASE exists)
DO $$ BEGIN
  UPDATE "DeviceCommand" SET "commandType" = 'RELEASE_DEVICE' WHERE "commandType"::text = 'RELEASE';
EXCEPTION WHEN others THEN NULL;
END $$;
