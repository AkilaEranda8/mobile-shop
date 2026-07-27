-- Track auto WhatsApp renewal reminders (day before expiry)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paymentDueReminderSentAt" TIMESTAMP(3);
