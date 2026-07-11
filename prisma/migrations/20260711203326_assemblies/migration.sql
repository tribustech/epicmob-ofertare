-- CreateTable
CREATE TABLE "Assembly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legHeightMm" REAL NOT NULL DEFAULT 100,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Assembly_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cabinet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "assemblyId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "inputJson" TEXT NOT NULL,
    "hardwareJson" TEXT,
    "extraPartsJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cabinet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Cabinet_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "Assembly" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Cabinet" ("extraPartsJson", "hardwareJson", "id", "inputJson", "projectId", "sortOrder", "updatedAt") SELECT "extraPartsJson", "hardwareJson", "id", "inputJson", "projectId", "sortOrder", "updatedAt" FROM "Cabinet";
DROP TABLE "Cabinet";
ALTER TABLE "new_Cabinet" RENAME TO "Cabinet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
