-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('CURRENT', 'SAVINGS');

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN "accountType" "BankAccountType" NOT NULL DEFAULT 'CURRENT';
