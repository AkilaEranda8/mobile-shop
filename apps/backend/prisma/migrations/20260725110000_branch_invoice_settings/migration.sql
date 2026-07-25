-- Per-branch invoice / bill detail overrides
ALTER TABLE "Branch" ADD COLUMN "invoiceSettings" JSONB;
