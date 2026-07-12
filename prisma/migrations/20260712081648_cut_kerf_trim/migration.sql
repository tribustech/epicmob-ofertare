-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "markupPct" REAL NOT NULL,
    "sheetYieldFactor" REAL NOT NULL,
    "cutKerfMm" REAL NOT NULL DEFAULT 4,
    "cutTrimMm" REAL NOT NULL DEFAULT 10,
    "constructionJson" TEXT NOT NULL,
    "defaultHingeId" TEXT,
    "defaultHandleId" TEXT,
    "defaultLegId" TEXT,
    "defaultRailId" TEXT
);
INSERT INTO "new_AppSettings" ("constructionJson", "defaultHandleId", "defaultHingeId", "defaultLegId", "defaultRailId", "id", "markupPct", "sheetYieldFactor") SELECT "constructionJson", "defaultHandleId", "defaultHingeId", "defaultLegId", "defaultRailId", "id", "markupPct", "sheetYieldFactor" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
