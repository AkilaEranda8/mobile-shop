-- CreateTable
CREATE TABLE "RepairFaultOption" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RepairFaultOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepairFaultOption_tenantId_idx" ON "RepairFaultOption"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairFaultOption_tenantId_name_key" ON "RepairFaultOption"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "RepairFaultOption" ADD CONSTRAINT "RepairFaultOption_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

