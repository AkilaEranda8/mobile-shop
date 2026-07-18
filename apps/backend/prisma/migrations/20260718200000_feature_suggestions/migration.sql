-- CreateEnum
CREATE TYPE "FeatureSuggestionStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'RELEASED', 'DECLINED');

-- CreateEnum
CREATE TYPE "FeatureSuggestionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FeatureSuggestionHistoryAction" AS ENUM ('CREATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'RESPONSE_UPDATED', 'RELEASED', 'DECLINED');

-- CreateEnum
CREATE TYPE "UserNotificationType" AS ENUM ('FEATURE_SUGGESTION', 'SYSTEM', 'LICENSE', 'ANNOUNCEMENT', 'SUBSCRIPTION', 'BUG_REPORT');

-- CreateTable
CREATE TABLE "FeatureSuggestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "FeatureSuggestionStatus" NOT NULL DEFAULT 'NEW',
    "priority" "FeatureSuggestionPriority" NOT NULL DEFAULT 'MEDIUM',
    "publicResponse" TEXT,
    "internalNote" TEXT,
    "respondedByEmail" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureSuggestionHistory" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "action" "FeatureSuggestionHistoryAction" NOT NULL,
    "oldStatus" "FeatureSuggestionStatus",
    "newStatus" "FeatureSuggestionStatus",
    "oldPriority" "FeatureSuggestionPriority",
    "newPriority" "FeatureSuggestionPriority",
    "publicResponse" TEXT,
    "performedByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureSuggestionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "relatedId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureSuggestion_tenantId_idx" ON "FeatureSuggestion"("tenantId");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_submittedById_idx" ON "FeatureSuggestion"("submittedById");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_status_idx" ON "FeatureSuggestion"("status");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_priority_idx" ON "FeatureSuggestion"("priority");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_category_idx" ON "FeatureSuggestion"("category");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_createdAt_idx" ON "FeatureSuggestion"("createdAt");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_tenantId_submittedById_createdAt_idx" ON "FeatureSuggestion"("tenantId", "submittedById", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_status_priority_createdAt_idx" ON "FeatureSuggestion"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_tenantId_status_createdAt_idx" ON "FeatureSuggestion"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureSuggestionHistory_suggestionId_idx" ON "FeatureSuggestionHistory"("suggestionId");

-- CreateIndex
CREATE INDEX "FeatureSuggestionHistory_createdAt_idx" ON "FeatureSuggestionHistory"("createdAt");

-- CreateIndex
CREATE INDEX "FeatureSuggestionHistory_suggestionId_createdAt_idx" ON "FeatureSuggestionHistory"("suggestionId", "createdAt");

-- CreateIndex
CREATE INDEX "UserNotification_tenantId_userId_isRead_createdAt_idx" ON "UserNotification"("tenantId", "userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "UserNotification_userId_createdAt_idx" ON "UserNotification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserNotification_relatedId_idx" ON "UserNotification"("relatedId");

-- AddForeignKey
ALTER TABLE "FeatureSuggestion" ADD CONSTRAINT "FeatureSuggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureSuggestion" ADD CONSTRAINT "FeatureSuggestion_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureSuggestionHistory" ADD CONSTRAINT "FeatureSuggestionHistory_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "FeatureSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
