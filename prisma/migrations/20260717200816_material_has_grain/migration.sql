-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "thicknessMm" REAL NOT NULL,
    "sheetLengthMm" REAL NOT NULL,
    "sheetWidthMm" REAL NOT NULL,
    "pricingMode" TEXT NOT NULL,
    "pricePerSheet" REAL,
    "pricePerSqm" REAL,
    "imageUrl" TEXT,
    "decorCode" TEXT,
    "brand" TEXT,
    "structura" TEXT,
    "category" TEXT NOT NULL DEFAULT 'PLACA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hasGrain" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Material" ("active", "brand", "category", "decorCode", "id", "imageUrl", "kind", "name", "pricePerSheet", "pricePerSqm", "pricingMode", "sheetLengthMm", "sheetWidthMm", "structura", "thicknessMm", "updatedAt") SELECT "active", "brand", "category", "decorCode", "id", "imageUrl", "kind", "name", "pricePerSheet", "pricePerSqm", "pricingMode", "sheetLengthMm", "sheetWidthMm", "structura", "thicknessMm", "updatedAt" FROM "Material";
DROP TABLE "Material";
ALTER TABLE "new_Material" RENAME TO "Material";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
