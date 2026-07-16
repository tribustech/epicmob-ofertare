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
    "defaultRailId" TEXT,
    "defaultShelfSupportId" TEXT,
    "defaultPlinthClipId" TEXT,
    "defaultAventosId" TEXT,
    "eurToRon" REAL NOT NULL DEFAULT 4.97,
    "blatCutPricePerPiece" REAL NOT NULL DEFAULT 35
);
INSERT INTO "new_AppSettings" ("constructionJson", "cutKerfMm", "cutTrimMm", "defaultAventosId", "defaultHandleId", "defaultHingeId", "defaultLegId", "defaultPlinthClipId", "defaultRailId", "defaultShelfSupportId", "eurToRon", "golaPricePerMl", "id", "laborPct", "profilJPerFront", "sheetYieldFactor") SELECT "constructionJson", "cutKerfMm", "cutTrimMm", "defaultAventosId", "defaultHandleId", "defaultHingeId", "defaultLegId", "defaultPlinthClipId", "defaultRailId", "defaultShelfSupportId", "eurToRon", "golaPricePerMl", "id", "laborPct", "profilJPerFront", "sheetYieldFactor" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
