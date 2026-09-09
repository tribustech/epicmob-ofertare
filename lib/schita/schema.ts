import { z } from 'zod';

// Ce întoarce AI-ul după ce citește schița. Rolul dictează cum construim corpul.
export const proposalCabinetSchema = z.object({
  label: z.string(),
  section: z.enum(['BAZA', 'SUSPENDAT', 'INALT', 'BLAT']),
  role: z.enum(['normal', 'chiuveta', 'masina_spalat', 'cuptor', 'frigider', 'cargo', 'blat']),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  depthMm: z.number().positive(),
  doors: z.number().int().min(0).default(0),
  drawers: z.number().int().min(0).default(0),
  shelves: z.number().int().min(0).default(0),
});
export type ProposalCabinet = z.infer<typeof proposalCabinetSchema>;

export const proposalSchema = z.object({
  reasoning: z.string(),          // ce a înțeles din schiță (rezumat scurt)
  questions: z.array(z.string()), // ce nu e sigur / de confirmat cu clientul
  finishHint: z.string().nullable().optional(), // finisaj/cod culoare scris pe schiță, ex. „Kastamonu A669 Nuc"
  clientName: z.string().nullable().optional(),
  assemblyName: z.string().default('Bucătărie'),
  wallWidthMm: z.number().nullable().optional(),
  wallHeightMm: z.number().nullable().optional(),
  cabinets: z.array(proposalCabinetSchema).min(1),
});
export type Proposal = z.infer<typeof proposalSchema>;

// JSON Schema pentru tool-ul Claude (structured output garantat)
export const PROPOSAL_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reasoning: { type: 'string', description: 'Rezumat scurt (RO) a ce ai înțeles din schiță' },
    questions: { type: 'array', items: { type: 'string' }, description: 'Lucruri neclare de confirmat cu utilizatorul' },
    clientName: { type: ['string', 'null'], description: 'Numele clientului dacă apare, altfel null' },
    assemblyName: { type: 'string', description: 'Numele ansamblului, ex. „Bucătărie"' },
    wallWidthMm: { type: ['number', 'null'], description: 'Lățimea totală a peretelui în mm' },
    wallHeightMm: { type: ['number', 'null'], description: 'Înălțimea totală în mm' },
    cabinets: {
      type: 'array',
      description: 'Corpurile de mobilier, stânga→dreapta, apoi suspendatele, apoi blatul',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string', description: 'Etichetă scurtă, ex. „Corp chiuvetă"' },
          section: { type: 'string', enum: ['BAZA', 'SUSPENDAT', 'INALT', 'BLAT'] },
          role: { type: 'string', enum: ['normal', 'chiuveta', 'masina_spalat', 'cuptor', 'frigider', 'cargo', 'blat'] },
          widthMm: { type: 'number' },
          heightMm: { type: 'number' },
          depthMm: { type: 'number' },
          doors: { type: 'integer', minimum: 0 },
          drawers: { type: 'integer', minimum: 0 },
          shelves: { type: 'integer', minimum: 0 },
        },
        required: ['label', 'section', 'role', 'widthMm', 'heightMm', 'depthMm', 'doors', 'drawers', 'shelves'],
      },
    },
  },
  required: ['reasoning', 'questions', 'clientName', 'assemblyName', 'wallWidthMm', 'wallHeightMm', 'cabinets'],
} as const;
