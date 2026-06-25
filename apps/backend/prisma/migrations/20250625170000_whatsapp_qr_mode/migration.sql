-- AlterTable: support QR (Baileys) connection mode alongside Meta Cloud API
ALTER TABLE "WhatsAppConfig" ADD COLUMN IF NOT EXISTS "connectionMode" TEXT NOT NULL DEFAULT 'qr';

ALTER TABLE "WhatsAppConfig" ALTER COLUMN "accessToken" SET DEFAULT '';
ALTER TABLE "WhatsAppConfig" ALTER COLUMN "phoneNumberId" SET DEFAULT '';
ALTER TABLE "WhatsAppConfig" ALTER COLUMN "wabaId" SET DEFAULT '';
ALTER TABLE "WhatsAppConfig" ALTER COLUMN "verifyToken" SET DEFAULT '';
