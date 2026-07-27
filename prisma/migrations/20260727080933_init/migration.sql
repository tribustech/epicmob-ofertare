-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "thicknessMm" DOUBLE PRECISION NOT NULL,
    "sheetLengthMm" DOUBLE PRECISION NOT NULL,
    "sheetWidthMm" DOUBLE PRECISION NOT NULL,
    "pricingMode" TEXT NOT NULL,
    "pricePerSheet" DOUBLE PRECISION,
    "pricePerSqm" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "decorCode" TEXT,
    "brand" TEXT,
    "structura" TEXT,
    "category" TEXT NOT NULL DEFAULT 'PLACA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hasGrain" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdgeBand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "thicknessMm" DOUBLE PRECISION NOT NULL,
    "pricePerMl" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdgeBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HardwareItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "nominalLengthMm" DOUBLE PRECISION,
    "loadClassKg" DOUBLE PRECISION,
    "boxHeightMm" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HardwareItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuttingRate" (
    "id" TEXT NOT NULL,
    "maxThicknessMm" DOUBLE PRECISION NOT NULL,
    "pricePerSheet" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CuttingRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrontSupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "handleMillingEur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vividSurchargeEur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metallicSurchargeEur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blackGlossEurPerFace" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrontSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrontModel" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shapeFamily" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "collection" TEXT,
    "hasHandleMilling" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FrontModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrontPrice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "finish" TEXT NOT NULL,
    "faces" INTEGER NOT NULL,
    "thicknessMm" INTEGER NOT NULL DEFAULT 18,
    "pricePerSqmEur" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "FrontPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "laborPct" DOUBLE PRECISION NOT NULL,
    "profilJPerFront" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "golaPricePerMl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sheetYieldFactor" DOUBLE PRECISION NOT NULL,
    "cutKerfMm" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "cutTrimMm" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "constructionJson" TEXT NOT NULL,
    "defaultHingeId" TEXT,
    "defaultHandleId" TEXT,
    "defaultLegId" TEXT,
    "defaultRailId" TEXT,
    "defaultShelfSupportId" TEXT,
    "defaultPlinthClipId" TEXT,
    "defaultAventosId" TEXT,
    "eurToRon" DOUBLE PRECISION NOT NULL DEFAULT 4.97,
    "blatCutPricePerPiece" DOUBLE PRECISION NOT NULL DEFAULT 35,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "clientContact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CIORNA',
    "laborPct" DOUBLE PRECISION NOT NULL,
    "yieldFactor" DOUBLE PRECISION NOT NULL,
    "handleType" TEXT NOT NULL DEFAULT 'APLICAT',
    "handleItemId" TEXT,
    "freeLinesJson" TEXT NOT NULL DEFAULT '[]',
    "snapshotJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assembly" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legHeightMm" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'FARA_BLAT',
    "baseHeightMm" DOUBLE PRECISION,
    "blatMaterialId" TEXT,
    "blatDepthMm" DOUBLE PRECISION,
    "upperHeightMm" DOUBLE PRECISION,
    "roomWidthMm" DOUBLE PRECISION,
    "roomDepthMm" DOUBLE PRECISION,
    "roomHeightMm" DOUBLE PRECISION,
    "fixedElementsJson" TEXT NOT NULL DEFAULT '[]',
    "roomWallsJson" TEXT,

    CONSTRAINT "Assembly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cabinet" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assemblyId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "inputJson" TEXT NOT NULL,
    "hardwareJson" TEXT,
    "extraPartsJson" TEXT NOT NULL DEFAULT '[]',
    "posXMm" DOUBLE PRECISION,
    "posZMm" DOUBLE PRECISION,
    "posYMm" DOUBLE PRECISION,
    "rotDeg" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cabinet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FrontModel_supplierId_idx" ON "FrontModel"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "FrontPrice_supplierId_tier_finish_faces_thicknessMm_key" ON "FrontPrice"("supplierId", "tier", "finish", "faces", "thicknessMm");

-- AddForeignKey
ALTER TABLE "FrontModel" ADD CONSTRAINT "FrontModel_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "FrontSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontPrice" ADD CONSTRAINT "FrontPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "FrontSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assembly" ADD CONSTRAINT "Assembly_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cabinet" ADD CONSTRAINT "Cabinet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cabinet" ADD CONSTRAINT "Cabinet_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "Assembly"("id") ON DELETE SET NULL ON UPDATE CASCADE;
