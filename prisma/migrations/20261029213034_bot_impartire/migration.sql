-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "items" JSONB,
ADD COLUMN     "splitMode" TEXT;

-- CreateTable
CREATE TABLE "SubmissionAllocation" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amount" DECIMAL(12,2),

    CONSTRAINT "SubmissionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionAllocation_submissionId_projectId_key" ON "SubmissionAllocation"("submissionId", "projectId");

-- AddForeignKey
ALTER TABLE "SubmissionAllocation" ADD CONSTRAINT "SubmissionAllocation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAllocation" ADD CONSTRAINT "SubmissionAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
