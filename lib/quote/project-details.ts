import { z } from 'zod';

const optTrimmedStr = z.preprocess((v) => {
  if (v == null) return undefined;
  const value = String(v).trim();
  return value === '' ? undefined : value;
}, z.string().optional());

const projectDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Numele proiectului lipsește'),
  clientName: optTrimmedStr,
  clientContact: optTrimmedStr,
  observatii: optTrimmedStr,
});

export const parseProjectDetails = (input: Record<string, unknown>) => projectDetailsSchema.parse(input);
