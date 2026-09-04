-- AlterTable
ALTER TABLE "SupportAgentPresence" ADD COLUMN "visibleOnTeam" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "SupportAgentPresence_visibleOnTeam_isOnline_idx" ON "SupportAgentPresence"("visibleOnTeam", "isOnline");
