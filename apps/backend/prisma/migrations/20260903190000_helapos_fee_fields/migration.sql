-- HelaPOS QR fee breakdown on subscription payments
ALTER TABLE "SubscriptionPayment" ADD COLUMN "subscriptionAmount" DOUBLE PRECISION;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "processingFee" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "customerPayableAmount" DOUBLE PRECISION;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "settlementAmount" DOUBLE PRECISION;
