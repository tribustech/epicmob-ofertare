-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assembly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legHeightMm" REAL NOT NULL DEFAULT 100,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'FARA_BLAT',
    "baseHeightMm" REAL,
    "blatMaterialId" TEXT,
    "blatDepthMm" REAL,
    "upperHeightMm" REAL,
    "roomWidthMm" REAL,
    "roomDepthMm" REAL,
    "roomHeightMm" REAL,
    "fixedElementsJson" TEXT NOT NULL DEFAULT '[]',
    "roomWallsJson" TEXT,
    CONSTRAINT "Assembly_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Assembly" ("fixedElementsJson", "id", "legHeightMm", "name", "projectId", "roomDepthMm", "roomHeightMm", "roomWallsJson", "roomWidthMm", "sortOrder") SELECT "fixedElementsJson", "id", "legHeightMm", "name", "projectId", "roomDepthMm", "roomHeightMm", "roomWallsJson", "roomWidthMm", "sortOrder" FROM "Assembly";
DROP TABLE "Assembly";
ALTER TABLE "new_Assembly" RENAME TO "Assembly";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
