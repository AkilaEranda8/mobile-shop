-- Branch isDefault + Release targetBranches
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Release" ADD COLUMN IF NOT EXISTS "targetBranches" TEXT[] DEFAULT ARRAY[]::TEXT[];
