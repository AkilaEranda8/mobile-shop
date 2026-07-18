-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "bankAccountId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_tenantId_bankAccountId_idx" ON "Transaction"("tenantId", "bankAccountId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
