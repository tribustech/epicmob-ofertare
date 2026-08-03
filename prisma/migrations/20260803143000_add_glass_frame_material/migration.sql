INSERT INTO "Material" (
  "id", "name", "kind", "thicknessMm", "sheetLengthMm", "sheetWidthMm",
  "pricingMode", "pricePerSheet", "pricePerSqm", "category", "active", "hasGrain", "updatedAt"
)
VALUES (
  'sticla-rama-standard', 'Sticlă cu ramă (complet)', 'STICLA_RAMA', 20, 3000, 2000,
  'PER_SQM', NULL, 400, 'PLACA', true, false, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
