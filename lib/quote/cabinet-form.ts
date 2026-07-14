import { z } from 'zod';
import type { CabinetInput } from '@/lib/engine';

const posNum = z.coerce.number().finite().positive();
const intNonNeg = z.coerce.number().int().min(0);
const emptyToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v);
const optStr = z.preprocess(emptyToUndefined, z.string().optional());
const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

export const cabinetFormSchema = z
  .object({
    label: z.string().trim().min(1),
    type: z.enum(['BAZA', 'SUSPENDAT', 'INALT', 'COLT']),
    widthMm: posNum,
    heightMm: posNum,
    depthMm: posNum,
    frontType: z.enum(['USI', 'SERTARE', 'FARA']),
    withShelves: checkbox,
    shelves: intNonNeg,
    doors: intNonNeg,
    carcassMaterialId: z.string().min(1),
    frontMaterialId: optStr,
    backEnabled: checkbox,
    backMaterialId: optStr,
    backMount: z.enum(['FALT', 'APLICAT']),
    carcassFrontEdgeId: z.string().min(1),
    frontPerimeterId: optStr,
    blindPanelWidthMm: z.preprocess(emptyToUndefined, posNum.optional()),
    drawersCount: intNonNeg.default(0),
    drawersSystem: z.enum(['PAL_BOX', 'METAL_BOX']).default('METAL_BOX'),
    drawersBottomMaterialId: optStr,
    drawerFrontHeightsMm: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .refine((d) => d.frontType !== 'USI' || d.doors >= 1, {
    message: 'Corpul cu uși are nevoie de cel puțin o ușă',
  })
  .refine((d) => d.frontType !== 'SERTARE' || d.drawersCount >= 1, {
    message: 'Corpul cu sertare are nevoie de cel puțin un sertar',
  })
  .refine((d) => d.frontType !== 'SERTARE' || !!d.drawersBottomMaterialId, {
    message: 'Alege materialul pentru fundul sertarelor',
  })
  .refine((d) => d.frontType === 'FARA' || !!d.frontMaterialId, {
    message: 'Fronturile cer un material de front',
  })
  .refine((d) => {
    if (d.frontType !== 'SERTARE' || !d.drawerFrontHeightsMm) return true;
    const heights = parseDrawerHeights(d.drawerFrontHeightsMm);
    return heights.length === d.drawersCount && heights.every((h) => h > 0);
  }, { message: 'Înălțimile sertarelor nu corespund cu numărul de sertare' })
  .refine((d) => !d.backEnabled || !!d.backMaterialId, {
    message: 'Alege materialul pentru spate',
  });

export type CabinetFormData = z.infer<typeof cabinetFormSchema>;

export function parseDrawerHeights(s: string): number[] {
  return s
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n));
}

export function toCabinetInput(d: CabinetFormData): CabinetInput {
  const heights = d.drawerFrontHeightsMm ? parseDrawerHeights(d.drawerFrontHeightsMm) : [];
  return {
    label: d.label,
    type: d.type,
    widthMm: d.widthMm,
    heightMm: d.heightMm,
    depthMm: d.depthMm,
    shelves: d.frontType === 'SERTARE' ? 0 : (d.frontType === 'USI' && !d.withShelves ? 0 : d.shelves),
    doors: d.frontType === 'USI' ? d.doors : 0,
    drawers:
      d.frontType === 'SERTARE'
        ? {
            count: d.drawersCount,
            system: d.drawersSystem,
            bottomMaterialId: d.drawersBottomMaterialId!,
            frontHeightsMm: heights.length > 0 ? heights : undefined,
          }
        : undefined,
    carcassMaterialId: d.carcassMaterialId,
    frontMaterialId: d.frontType === 'FARA' ? null : (d.frontMaterialId ?? null),
    back: { enabled: d.backEnabled, materialId: d.backMaterialId, mount: d.backMount },
    edgeBands: {
      carcassFrontEdgeId: d.carcassFrontEdgeId,
      frontPerimeterId: d.frontPerimeterId ?? null,
    },
    blindPanelWidthMm: d.type === 'COLT' ? d.blindPanelWidthMm : undefined,
  };
}

export const extraPartSchema = z.object({
  name: z.string().trim().min(1),
  lengthMm: posNum,
  widthMm: posNum,
  qty: z.coerce.number().int().min(1),
  materialId: z.string().min(1),
});

export type ExtraPart = z.infer<typeof extraPartSchema>;
