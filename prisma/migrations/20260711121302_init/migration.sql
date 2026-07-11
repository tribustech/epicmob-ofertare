-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "thicknessMm" REAL NOT NULL,
    "sheetLengthMm" REAL NOT NULL,
    "sheetWidthMm" REAL NOT NULL,
    "pricingMode" TEXT NOT NULL,
    "pricePerSheet" REAL,
    "pricePerSqm" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EdgeBand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "thicknessMm" REAL NOT NULL,
    "pricePerMl" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HardwareItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "pricePerUnit" REAL NOT NULL,
    "nominalLengthMm" REAL,
    "loadClassKg" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CuttingRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "maxThicknessMm" REAL NOT NULL,
    "pricePerSheet" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "LaborRate" (
    "cabinetType" TEXT NOT NULL PRIMARY KEY,
    "price" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "markupPct" REAL NOT NULL,
    "sheetYieldFactor" REAL NOT NULL,
    "constructionJson" TEXT NOT NULL,
    "defaultHingeId" TEXT,
    "defaultHandleId" TEXT,
    "defaultLegId" TEXT,
    "defaultRailId" TEXT
);
