-- AlterEnum: add WHOLESALE to JournalSourceModule (additive)
ALTER TYPE "JournalSourceModule" ADD VALUE IF NOT EXISTS 'WHOLESALE';
