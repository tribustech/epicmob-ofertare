-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "blatEdgeBandId" TEXT,
ADD COLUMN     "roundedEdgePricePerPiece" DOUBLE PRECISION NOT NULL DEFAULT 0;
