-- CreateTable
CREATE TABLE "PlatformActivityLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "actorType" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT '—',
    "details" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '—',
    "tenantId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformActivityLog_createdAt_idx" ON "PlatformActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformActivityLog_eventType_idx" ON "PlatformActivityLog"("eventType");
