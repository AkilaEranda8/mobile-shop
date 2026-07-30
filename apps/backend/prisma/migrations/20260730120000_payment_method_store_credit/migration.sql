-- Redeem store credit (customer creditBalance) as a sale payment method
DO $$ BEGIN
  ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'STORE_CREDIT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
