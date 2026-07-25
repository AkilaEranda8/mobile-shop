-- Track when an outstanding/credit settlement was actually collected
ALTER TABLE "SalePayment" ADD COLUMN "paidAt" TIMESTAMP(3);
