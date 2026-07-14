ALTER TABLE "Project" RENAME COLUMN "markupPct" TO "laborPct";
ALTER TABLE "AppSettings" RENAME COLUMN "markupPct" TO "laborPct";
DROP TABLE "LaborRate";
