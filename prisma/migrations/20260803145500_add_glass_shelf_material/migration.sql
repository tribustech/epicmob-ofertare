INSERT INTO "Material" (
  "id", "name", "kind", "thicknessMm", "sheetLengthMm", "sheetWidthMm",
  "pricingMode", "pricePerSheet", "pricePerSqm", "category", "active", "hasGrain", "updatedAt"
)
VALUES (
  'sticla-polita-standard', 'Sticlă poliță clară 8mm', 'STICLA_POLITA', 8, 3000, 2000,
  'PER_SQM', NULL, 300, 'PLACA', true, false, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
