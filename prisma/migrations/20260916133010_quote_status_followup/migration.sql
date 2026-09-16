-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "followUpAt" TIMESTAMP(3),
ADD COLUMN     "followUpNote" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Quote_followUpAt_idx" ON "Quote"("followUpAt");
