-- CreateTable
CREATE TABLE "SupportAgentPresence" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Support Specialist',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportAgentPresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportAgentPresence_adminUserId_key" ON "SupportAgentPresence"("adminUserId");
CREATE UNIQUE INDEX "SupportAgentPresence_email_key" ON "SupportAgentPresence"("email");
CREATE INDEX "SupportAgentPresence_isOnline_lastSeenAt_idx" ON "SupportAgentPresence"("isOnline", "lastSeenAt");
