-- AlterEnum
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_CHAT';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'CUSTOMER_SERVICE_TICKET';

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "SupportTicketCategory" AS ENUM ('BUG', 'BILLING', 'HOW_TO', 'ACCOUNT', 'FEATURE', 'OTHER');
CREATE TYPE "SupportTicketEventAction" AS ENUM ('CREATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ASSIGNEE_CHANGED', 'MESSAGE', 'ATTACHMENT', 'CLOSED', 'REOPENED');
CREATE TYPE "SupportMessageAuthorType" AS ENUM ('TENANT_USER', 'PLATFORM_ADMIN', 'SYSTEM');
CREATE TYPE "SupportChatSessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'ENDED');
CREATE TYPE "CustomerServiceTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- Chat session first (ticket may FK to it)
CREATE TABLE "SupportChatSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "assigneeAdminEmail" TEXT,
    "status" "SupportChatSessionStatus" NOT NULL DEFAULT 'WAITING',
    "subject" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportChatSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assigneeAdminEmail" TEXT,
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "slaDueAt" TIMESTAMP(3) NOT NULL,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "sourceChatSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "authorType" "SupportMessageAuthorType" NOT NULL,
    "authorUserId" TEXT,
    "authorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messageId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTicketEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "action" "SupportTicketEventAction" NOT NULL,
    "oldStatus" "SupportTicketStatus",
    "newStatus" "SupportTicketStatus",
    "oldPriority" "SupportTicketPriority",
    "newPriority" "SupportTicketPriority",
    "oldAssigneeAdminEmail" TEXT,
    "newAssigneeAdminEmail" TEXT,
    "note" TEXT,
    "performedByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicketEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorType" "SupportMessageAuthorType" NOT NULL,
    "authorUserId" TEXT,
    "authorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportChatAttachment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportChatAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerServiceTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "customerId" TEXT,
    "createdById" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "CustomerServiceTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "CustomerServiceTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerServiceTicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorType" "SupportMessageAuthorType" NOT NULL DEFAULT 'TENANT_USER',
    "authorUserId" TEXT,
    "authorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerServiceTicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportTicket_sourceChatSessionId_key" ON "SupportTicket"("sourceChatSessionId");
CREATE UNIQUE INDEX "SupportTicket_tenantId_ticketNumber_key" ON "SupportTicket"("tenantId", "ticketNumber");
CREATE INDEX "SupportTicket_tenantId_status_createdAt_idx" ON "SupportTicket"("tenantId", "status", "createdAt");
CREATE INDEX "SupportTicket_status_priority_slaDueAt_idx" ON "SupportTicket"("status", "priority", "slaDueAt");
CREATE INDEX "SupportTicket_assigneeAdminEmail_idx" ON "SupportTicket"("assigneeAdminEmail");
CREATE INDEX "SupportTicket_createdById_idx" ON "SupportTicket"("createdById");
CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId", "createdAt");
CREATE INDEX "SupportTicketAttachment_ticketId_idx" ON "SupportTicketAttachment"("ticketId");
CREATE INDEX "SupportTicketAttachment_messageId_idx" ON "SupportTicketAttachment"("messageId");
CREATE INDEX "SupportTicketEvent_ticketId_createdAt_idx" ON "SupportTicketEvent"("ticketId", "createdAt");
CREATE INDEX "SupportChatSession_tenantId_status_lastMessageAt_idx" ON "SupportChatSession"("tenantId", "status", "lastMessageAt");
CREATE INDEX "SupportChatSession_status_lastMessageAt_idx" ON "SupportChatSession"("status", "lastMessageAt");
CREATE INDEX "SupportChatSession_startedById_idx" ON "SupportChatSession"("startedById");
CREATE INDEX "SupportChatSession_assigneeAdminEmail_idx" ON "SupportChatSession"("assigneeAdminEmail");
CREATE INDEX "SupportChatMessage_sessionId_createdAt_idx" ON "SupportChatMessage"("sessionId", "createdAt");
CREATE INDEX "SupportChatAttachment_sessionId_idx" ON "SupportChatAttachment"("sessionId");
CREATE INDEX "SupportChatAttachment_messageId_idx" ON "SupportChatAttachment"("messageId");
CREATE UNIQUE INDEX "CustomerServiceTicket_tenantId_ticketNumber_key" ON "CustomerServiceTicket"("tenantId", "ticketNumber");
CREATE INDEX "CustomerServiceTicket_tenantId_status_createdAt_idx" ON "CustomerServiceTicket"("tenantId", "status", "createdAt");
CREATE INDEX "CustomerServiceTicket_tenantId_customerId_idx" ON "CustomerServiceTicket"("tenantId", "customerId");
CREATE INDEX "CustomerServiceTicket_branchId_idx" ON "CustomerServiceTicket"("branchId");
CREATE INDEX "CustomerServiceTicketMessage_ticketId_createdAt_idx" ON "CustomerServiceTicketMessage"("ticketId", "createdAt");

ALTER TABLE "SupportChatSession" ADD CONSTRAINT "SupportChatSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportChatSession" ADD CONSTRAINT "SupportChatSession_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_sourceChatSessionId_fkey" FOREIGN KEY ("sourceChatSessionId") REFERENCES "SupportChatSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicketAttachment" ADD CONSTRAINT "SupportTicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicketAttachment" ADD CONSTRAINT "SupportTicketAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SupportTicketMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicketEvent" ADD CONSTRAINT "SupportTicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportChatMessage" ADD CONSTRAINT "SupportChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SupportChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportChatAttachment" ADD CONSTRAINT "SupportChatAttachment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SupportChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportChatAttachment" ADD CONSTRAINT "SupportChatAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SupportChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerServiceTicket" ADD CONSTRAINT "CustomerServiceTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerServiceTicket" ADD CONSTRAINT "CustomerServiceTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerServiceTicketMessage" ADD CONSTRAINT "CustomerServiceTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CustomerServiceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
