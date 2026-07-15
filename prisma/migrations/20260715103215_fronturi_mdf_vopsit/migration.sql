-- CreateTable
CREATE TABLE "FrontSupplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "handleMillingEur" REAL NOT NULL DEFAULT 0,
    "vividSurchargeEur" REAL NOT NULL DEFAULT 0,
    "metallicSurchargeEur" REAL NOT NULL DEFAULT 0,
    "blackGlossEurPerFace" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FrontModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shapeFamily" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "collection" TEXT,
    "hasHandleMilling" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "FrontModel_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "FrontSupplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FrontPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "finish" TEXT NOT NULL,
    "faces" INTEGER NOT NULL,
    "thicknessMm" INTEGER NOT NULL DEFAULT 18,
    "pricePerSqmEur" REAL NOT NULL,
    CONSTRAINT "FrontPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "FrontSupplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "eurToRon" REAL NOT NULL DEFAULT 4.97
);
INSERT INTO "new_AppSettings" ("constructionJson", "cutKerfMm", "cutTrimMm", "defaultHandleId", "defaultHingeId", "defaultLegId", "defaultRailId", "golaPricePerMl", "id", "laborPct", "profilJPerFront", "sheetYieldFactor") SELECT "constructionJson", "cutKerfMm", "cutTrimMm", "defaultHandleId", "defaultHingeId", "defaultLegId", "defaultRailId", "golaPricePerMl", "id", "laborPct", "profilJPerFront", "sheetYieldFactor" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FrontModel_supplierId_idx" ON "FrontModel"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "FrontPrice_supplierId_tier_finish_faces_thicknessMm_key" ON "FrontPrice"("supplierId", "tier", "finish", "faces", "thicknessMm");
