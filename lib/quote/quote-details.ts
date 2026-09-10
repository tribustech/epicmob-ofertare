import { z } from 'zod';

const optTrimmedStr = z.preprocess((v) => {
  if (v == null) return undefined;
  const value = String(v).trim();
  return value === '' ? undefined : value;
}, z.string().optional());

const quoteDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Numele proiectului lipsește'),
  observatii: optTrimmedStr,
});

export const parseQuoteDetails = (input: Record<string, unknown>) => quoteDetailsSchema.parse(input);
