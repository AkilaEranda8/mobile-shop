-- Platform admin sub-role: SUPER_ADMIN (full) | SUPPORT_ADMIN (no finance) | BILLING_ADMIN (finance only ops)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "platformAdminRole" TEXT;

-- Existing platform admins keep full access
UPDATE "User"
SET "platformAdminRole" = 'SUPER_ADMIN'
WHERE role = 'PLATFORM_ADMIN'
  AND ("platformAdminRole" IS NULL OR "platformAdminRole" = '');
