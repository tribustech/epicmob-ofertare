-- AlterTable
ALTER TABLE "HardwareItem" ADD COLUMN "boxHeightMm" REAL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "laborPct" REAL NOT NULL,
    "profilJPerFront" REAL NOT NULL DEFAULT 0,
    "golaPricePerMl" REAL NOT NULL DEFAULT 0,
    "sheetYieldFactor" REAL NOT NULL,
    "cutKerfMm" REAL NOT NULL DEFAULT 4,
    "cutTrimMm" REAL NOT NULL DEFAULT 10,
    "constructionJson" TEXT NOT NULL,
    "defaultHingeId" TEXT,
    "defaultHandleId" TEXT,
    "defaultLegId" TEXT,
    "defaultRailId" TEXT
);
INSERT INTO "new_AppSettings" ("constructionJson", "cutKerfMm", "cutTrimMm", "defaultHandleId", "defaultHingeId", "defaultLegId", "defaultRailId", "id", "laborPct", "sheetYieldFactor") SELECT "constructionJson", "cutKerfMm", "cutTrimMm", "defaultHandleId", "defaultHingeId", "defaultLegId", "defaultRailId", "id", "laborPct", "sheetYieldFactor" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "clientContact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CIORNA',
    "laborPct" REAL NOT NULL,
    "yieldFactor" REAL NOT NULL,
    "handleType" TEXT NOT NULL DEFAULT 'APLICAT',
    "handleItemId" TEXT,
    "freeLinesJson" TEXT NOT NULL DEFAULT '[]',
    "snapshotJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("clientContact", "clientName", "createdAt", "freeLinesJson", "id", "laborPct", "name", "snapshotJson", "status", "updatedAt", "yieldFactor") SELECT "clientContact", "clientName", "createdAt", "freeLinesJson", "id", "laborPct", "name", "snapshotJson", "status", "updatedAt", "yieldFactor" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
