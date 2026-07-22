-- Allow same phone at different branches; uniqueness is per (tenant, branch, phone).
DROP INDEX IF EXISTS "Customer_tenantId_phone_key";

CREATE UNIQUE INDEX "Customer_tenantId_branchId_phone_key"
  ON "Customer"("tenantId", "branchId", "phone");
