import { z } from 'zod';
import { CLIENT_KINDS, LOST_REASONS } from './constants';

const optText = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().optional());
const optMoney = z.preprocess(
  (v) => (v === '' || v == null ? undefined : String(v).replace(/\./g, '').replace(',', '.')),
  z.coerce.number().nonnegative('Bugetul nu poate fi negativ').optional(),
);

export const contactFields = {
  name: z.string().trim().min(1, 'Numele lipsește'),
  kind: z.enum(CLIENT_KINDS).default('PERSOANA'),
  phone: optText,
  email: optText,
  address: optText,
  cui: optText,
};

export const newLeadSchema = z.object({
  ...contactFields,
  source: optText,
  wants: optText,
  budgetEstimate: optMoney,
  nextActionAt: optText, // 'YYYY-MM-DD'
  nextActionNote: optText,
});

export const updateClientSchema = z.object({
  ...contactFields,
  source: optText,
  wants: optText,
  budgetEstimate: optMoney,
});

export const nextActionSchema = z.object({
  nextActionAt: optText,
  nextActionNote: optText,
});

export const markLostSchema = z.object({
  lostReason: z.enum(LOST_REASONS),
  lostNote: optText,
});

export const remarketingSchema = z.object({
  remarketing: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
  remarketingNote: optText,
});

export const newProjectSchema = z.object({
  name: z.string().trim().min(1, 'Numele proiectului lipsește'),
  description: optText,
  deadlineAt: optText,
});
