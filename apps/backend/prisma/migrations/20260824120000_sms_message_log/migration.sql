CREATE TABLE IF NOT EXISTS "SmsMessage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT,
  "referenceId" TEXT,
  "to" TEXT NOT NULL,
  "customerName" TEXT,
  "eventType" TEXT NOT NULL,
  "preview" TEXT NOT NULL,
  "body" TEXT,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "provider" TEXT,
  "providerRef" TEXT,
  "errorMessage" TEXT,
  "amount" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmsMessage_tenantId_idx" ON "SmsMessage"("tenantId");
CREATE INDEX IF NOT EXISTS "SmsMessage_tenantId_branchId_idx" ON "SmsMessage"("tenantId", "branchId");
CREATE INDEX IF NOT EXISTS "SmsMessage_tenantId_eventType_idx" ON "SmsMessage"("tenantId", "eventType");
CREATE INDEX IF NOT EXISTS "SmsMessage_tenantId_createdAt_idx" ON "SmsMessage"("tenantId", "createdAt");

ALTER TABLE "SmsMessage"
  ADD CONSTRAINT "SmsMessage_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
