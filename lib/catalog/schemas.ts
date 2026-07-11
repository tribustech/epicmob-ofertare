import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v);
const num = z.coerce.number().finite();
const posNum = num.positive();
const optPosNum = z.preprocess(emptyToUndefined, posNum.optional());

export function formDataToObject(fd: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === 'string') obj[key] = value;
  }
  return obj;
}

export const materialSchema = z
  .object({
    name: z.string().trim().min(1),
    kind: z.enum(['PAL', 'MDF_VOPSIT', 'MDF_MELAMINAT', 'MDF_INFOLIAT', 'PFL']),
    thicknessMm: posNum,
    sheetLengthMm: posNum,
    sheetWidthMm: posNum,
    pricingMode: z.enum(['PER_SHEET', 'PER_SQM']),
    pricePerSheet: optPosNum,
    pricePerSqm: optPosNum,
  })
  .refine(
    (d) => (d.pricingMode === 'PER_SHEET' ? d.pricePerSheet !== undefined : d.pricePerSqm !== undefined),
    { message: 'Lipsește prețul pentru modul de preț ales' },
  );

export const edgeBandSchema = z.object({
  name: z.string().trim().min(1),
  thicknessMm: posNum,
  pricePerMl: posNum,
});

export const hardwareSchema = z.object({
  name: z.string().trim().min(1),
  category: z.enum(['BALAMA', 'SERTAR', 'MANER', 'PICIOR', 'SINA_SUSPENDARE', 'ACCESORIU']),
  pricePerUnit: posNum,
  nominalLengthMm: optPosNum,
  loadClassKg: optPosNum,
});

export const cuttingRateSchema = z.object({
  maxThicknessMm: posNum,
  pricePerSheet: posNum,
});

export const laborRateSchema = z.object({
  price: num.nonnegative(),
});

const optId = z.preprocess(emptyToUndefined, z.string().optional());

export const settingsSchema = z.object({
  markupPct: num.nonnegative(),
  sheetYieldFactor: num.gt(0).lte(1),
  defaultHingeId: optId,
  defaultHandleId: optId,
  defaultLegId: optId,
  defaultRailId: optId,
});
