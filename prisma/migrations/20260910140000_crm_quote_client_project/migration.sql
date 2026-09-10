-- CRM C1: Project → Quote (redenumire, fără pierdere de date) + Client, Project (CRM), Event, LeadSource

-- 1. Redenumire tabel + constrângeri
ALTER TABLE "Assembly" DROP CONSTRAINT "Assembly_projectId_fkey";
ALTER TABLE "Cabinet" DROP CONSTRAINT "Cabinet_projectId_fkey";
ALTER TABLE "Project" RENAME TO "Quote";
ALTER TABLE "Quote" RENAME CONSTRAINT "Project_pkey" TO "Quote_pkey";

-- 2. Coloanele FK din Assembly / Cabinet
ALTER TABLE "Assembly" RENAME COLUMN "projectId" TO "quoteId";
ALTER TABLE "Cabinet" RENAME COLUMN "projectId" TO "quoteId";
ALTER TABLE "Assembly" ADD CONSTRAINT "Assembly_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cabinet" ADD CONSTRAINT "Cabinet_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Câmpuri noi pe Quote
ALTER TABLE "Quote"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "label" TEXT,
  ADD COLUMN "acceptedPrice" DECIMAL(12,2),
  ADD COLUMN "acceptedAt" TIMESTAMP(3);

-- 4. Tabele CRM noi
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PERSOANA',
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "cui" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'LEAD',
    "source" TEXT,
    "wants" TEXT,
    "budgetEstimate" DECIMAL(12,2),
    "firstContactAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextActionAt" TIMESTAMP(3),
    "nextActionNote" TEXT,
    "lostReason" TEXT,
    "lostNote" TEXT,
    "remarketing" BOOLEAN NOT NULL DEFAULT false,
    "remarketingNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFERTARE',
    "deadlineAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "mountedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "lostNote" TEXT,
    "hoursWorked" DOUBLE PRECISION,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LeadSource_pkey" PRIMARY KEY ("id")
);

-- 5. Indexuri
CREATE INDEX "Quote_projectId_idx" ON "Quote"("projectId");
CREATE INDEX "Client_stage_idx" ON "Client"("stage");
CREATE INDEX "Client_phone_idx" ON "Client"("phone");
CREATE INDEX "Event_clientId_createdAt_idx" ON "Event"("clientId", "createdAt");
CREATE INDEX "Event_projectId_createdAt_idx" ON "Event"("projectId", "createdAt");
CREATE UNIQUE INDEX "LeadSource_name_key" ON "LeadSource"("name");
CREATE INDEX "Project_status_deadlineAt_idx" ON "Project"("status", "deadlineAt");
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- 6. Chei străine
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
