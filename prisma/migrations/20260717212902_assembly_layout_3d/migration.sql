-- AlterTable
ALTER TABLE "Assembly" ADD COLUMN "roomDepthMm" REAL;
ALTER TABLE "Assembly" ADD COLUMN "roomHeightMm" REAL;
ALTER TABLE "Assembly" ADD COLUMN "roomWidthMm" REAL;

-- AlterTable
ALTER TABLE "Cabinet" ADD COLUMN "posXMm" REAL;
ALTER TABLE "Cabinet" ADD COLUMN "posYMm" REAL;
ALTER TABLE "Cabinet" ADD COLUMN "posZMm" REAL;
ALTER TABLE "Cabinet" ADD COLUMN "rotDeg" INTEGER;
