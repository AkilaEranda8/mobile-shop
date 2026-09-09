-- EMI Device Locker / Android Management (Phase 1)

-- AlterTable
ALTER TABLE "HirePurchaseAgreement" ADD COLUMN IF NOT EXISTS "deviceMgmtConsentVersion" TEXT;
ALTER TABLE "HirePurchaseAgreement" ADD COLUMN IF NOT EXISTS "deviceMgmtConsentedAt" TIMESTAMP(3);
ALTER TABLE "HirePurchaseAgreement" ADD COLUMN IF NOT EXISTS "deviceMgmtEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ManagedDeviceStatus" AS ENUM ('PENDING_ENROLLMENT', 'ENROLLED', 'ACTIVE', 'PAYMENT_DUE', 'WARNING', 'GRACE_PERIOD', 'OVERDUE', 'RESTRICTED', 'SUSPENDED', 'RELEASED', 'ENROLLMENT_FAILED', 'MANAGEMENT_ERROR', 'RELEASE_FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ManagedEnrollmentStatus" AS ENUM ('CREATED', 'ENROLLMENT_PENDING', 'QR_GENERATED', 'DEVICE_SCANNED', 'ENROLLMENT_IN_PROGRESS', 'ENROLLED', 'ACTIVE', 'ENROLLMENT_FAILED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ManagedDeviceOnlineStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DeviceCommandType" AS ENUM ('APPLY_RESTRICTION', 'REMOVE_RESTRICTION', 'SYNC_POLICY', 'REFRESH_STATUS', 'RELEASE_DEVICE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DeviceCommandStatus" AS ENUM ('PENDING', 'APPROVED', 'SENT', 'EXECUTED', 'FAILED', 'CANCELLED', 'SUPERSEDED', 'DRY_RUN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DevicePolicyKind" AS ENUM ('ACTIVE', 'WARNING', 'RESTRICTED', 'RELEASED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "DevicePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "kind" "DevicePolicyKind" NOT NULL,
    "amapiPolicyName" TEXT,
    "policyJson" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DevicePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ManagedDevice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "imeiRecordId" TEXT,
    "androidDeviceName" TEXT,
    "imei1" TEXT NOT NULL,
    "imei2" TEXT,
    "serialNumber" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "androidVersion" TEXT,
    "enrollmentStatus" "ManagedEnrollmentStatus" NOT NULL DEFAULT 'CREATED',
    "managementStatus" TEXT,
    "deviceStatus" "ManagedDeviceStatus" NOT NULL DEFAULT 'PENDING_ENROLLMENT',
    "onlineStatus" "ManagedDeviceOnlineStatus" NOT NULL DEFAULT 'UNKNOWN',
    "policyStatus" TEXT,
    "activePolicyId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3),
    "restrictedAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "pendingRestriction" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManagedDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DeviceEnrollment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "deviceId" TEXT,
    "agreementId" TEXT NOT NULL,
    "enrollmentCode" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPreview" TEXT,
    "amapiEnrollmentToken" TEXT,
    "qrPayloadJson" JSONB,
    "status" "ManagedEnrollmentStatus" NOT NULL DEFAULT 'CREATED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "consentVersion" TEXT,
    "consentedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeviceEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DeviceCommand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "commandType" "DeviceCommandType" NOT NULL,
    "reason" TEXT,
    "status" "DeviceCommandStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "amapiRequestId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DeviceEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "deviceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'system',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmiLockerSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "dryRunEnabled" BOOLEAN NOT NULL DEFAULT true,
    "automaticRestriction" BOOLEAN NOT NULL DEFAULT true,
    "manualApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "warningDays" INTEGER NOT NULL DEFAULT 3,
    "restrictionExtraGraceDays" INTEGER NOT NULL DEFAULT 0,
    "offlineThresholdHours" INTEGER NOT NULL DEFAULT 24,
    "restoreWithRemainingOverdue" BOOLEAN NOT NULL DEFAULT false,
    "autoRestoreEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoReleaseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "consentTextVersion" TEXT NOT NULL DEFAULT 'v1',
    "consentText" TEXT,
    "supportPhone" TEXT,
    "supportEmail" TEXT,
    "paymentInfoText" TEXT,
    "restrictionPolicyHint" TEXT,
    "amapiEnterpriseName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmiLockerSettings_pkey" PRIMARY KEY ("id")
);

-- Indexes / uniques (IF NOT EXISTS via exception-safe pattern)
CREATE UNIQUE INDEX IF NOT EXISTS "DevicePolicy_tenantId_name_key" ON "DevicePolicy"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "DevicePolicy_tenantId_kind_isActive_idx" ON "DevicePolicy"("tenantId", "kind", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "ManagedDevice_tenantId_imei1_key" ON "ManagedDevice"("tenantId", "imei1");
CREATE INDEX IF NOT EXISTS "ManagedDevice_tenantId_branchId_deviceStatus_idx" ON "ManagedDevice"("tenantId", "branchId", "deviceStatus");
CREATE INDEX IF NOT EXISTS "ManagedDevice_tenantId_agreementId_idx" ON "ManagedDevice"("tenantId", "agreementId");
CREATE INDEX IF NOT EXISTS "ManagedDevice_tenantId_customerId_idx" ON "ManagedDevice"("tenantId", "customerId");
CREATE INDEX IF NOT EXISTS "ManagedDevice_tenantId_lastSeenAt_idx" ON "ManagedDevice"("tenantId", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "ManagedDevice_androidDeviceName_idx" ON "ManagedDevice"("androidDeviceName");

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceEnrollment_tenantId_enrollmentCode_key" ON "DeviceEnrollment"("tenantId", "enrollmentCode");
CREATE INDEX IF NOT EXISTS "DeviceEnrollment_tenantId_status_expiresAt_idx" ON "DeviceEnrollment"("tenantId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "DeviceEnrollment_deviceId_idx" ON "DeviceEnrollment"("deviceId");
CREATE INDEX IF NOT EXISTS "DeviceEnrollment_agreementId_idx" ON "DeviceEnrollment"("agreementId");
CREATE INDEX IF NOT EXISTS "DeviceEnrollment_tokenHash_idx" ON "DeviceEnrollment"("tokenHash");

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceCommand_tenantId_idempotencyKey_key" ON "DeviceCommand"("tenantId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "DeviceCommand_tenantId_deviceId_createdAt_idx" ON "DeviceCommand"("tenantId", "deviceId", "createdAt");
CREATE INDEX IF NOT EXISTS "DeviceCommand_tenantId_status_commandType_idx" ON "DeviceCommand"("tenantId", "status", "commandType");
CREATE INDEX IF NOT EXISTS "DeviceCommand_deviceId_status_idx" ON "DeviceCommand"("deviceId", "status");

CREATE INDEX IF NOT EXISTS "DeviceEvent_tenantId_deviceId_createdAt_idx" ON "DeviceEvent"("tenantId", "deviceId", "createdAt");
CREATE INDEX IF NOT EXISTS "DeviceEvent_tenantId_eventType_createdAt_idx" ON "DeviceEvent"("tenantId", "eventType", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "EmiLockerSettings_tenantId_branchId_key" ON "EmiLockerSettings"("tenantId", "branchId");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "DevicePolicy" ADD CONSTRAINT "DevicePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DevicePolicy" ADD CONSTRAINT "DevicePolicy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ManagedDevice" ADD CONSTRAINT "ManagedDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ManagedDevice" ADD CONSTRAINT "ManagedDevice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ManagedDevice" ADD CONSTRAINT "ManagedDevice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ManagedDevice" ADD CONSTRAINT "ManagedDevice_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "HirePurchaseAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ManagedDevice" ADD CONSTRAINT "ManagedDevice_imeiRecordId_fkey" FOREIGN KEY ("imeiRecordId") REFERENCES "ImeiRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ManagedDevice" ADD CONSTRAINT "ManagedDevice_activePolicyId_fkey" FOREIGN KEY ("activePolicyId") REFERENCES "DevicePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeviceEnrollment" ADD CONSTRAINT "DeviceEnrollment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DeviceEnrollment" ADD CONSTRAINT "DeviceEnrollment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DeviceEnrollment" ADD CONSTRAINT "DeviceEnrollment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ManagedDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DeviceEnrollment" ADD CONSTRAINT "DeviceEnrollment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "HirePurchaseAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ManagedDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ManagedDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EmiLockerSettings" ADD CONSTRAINT "EmiLockerSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EmiLockerSettings" ADD CONSTRAINT "EmiLockerSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
