ALTER TABLE "WhatsAppMessage" ADD COLUMN "branchId" TEXT;

UPDATE "WhatsAppMessage" AS m
SET "branchId" = d."branchId"
FROM "DeliveryOrder" AS d
WHERE m."branchId" IS NULL
  AND m."orderId" = d."id"
  AND d."branchId" IS NOT NULL;

UPDATE "WhatsAppMessage" AS m
SET "branchId" = s."branchId"
FROM "Sale" AS s
WHERE m."branchId" IS NULL
  AND m."orderId" = s."id"
  AND s."branchId" IS NOT NULL;

CREATE INDEX "WhatsAppMessage_tenantId_branchId_idx"
ON "WhatsAppMessage"("tenantId", "branchId");
