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
    mountTop: z.enum(['INCADRAT', 'APLICAT']).default('INCADRAT'),
    mountBottom: z.enum(['INCADRAT', 'APLICAT']).default('INCADRAT'),
    frontType: z.enum(['USI', 'SERTARE', 'FARA']),
    withShelves: checkbox,
    shelves: intNonNeg,
    doors: intNonNeg,
    carcassMaterialId: z.string().min(1),
    frontKind: z.enum(['PAL', 'MDF_MELAMINAT', 'MDF_INFOLIAT', 'MDF_VOPSIT']).default('PAL'),
    frontMaterialId: optStr,
    mdfSupplierId: optStr,
    mdfModelId: optStr,
    mdfFinish: z.enum(['MAT', 'LUCIOS']).default('MAT'),
    mdfFaces: z.coerce.number().int().min(1).max(2).default(1),
    mdfRalCode: optStr,
    mdfColorCategory: z.enum(['NORMALA', 'VIE', 'METALIZAT']).default('NORMALA'),
    backEnabled: checkbox,
    backMaterialId: optStr,
    backMount: z.enum(['FALT', 'APLICAT']),
    carcassFrontEdgeId: z.string().min(1),
    frontPerimeterId: optStr,
    blindPanelWidthMm: z.preprocess(emptyToUndefined, posNum.optional()),
    drawersCount: intNonNeg.default(0),
    drawersSystem: z.enum(['PAL_BOX', 'TANDEMBOX']).default('TANDEMBOX'),
    drawersBottomMaterialId: optStr,
    drawerFrontHeightsMm: z.preprocess(emptyToUndefined, z.string().optional()),
    hingeId: optStr,
    slideId: optStr,
    tandemboxHeightMm: z.preprocess(emptyToUndefined, posNum.optional()),
    handleMode: z.enum(['PROIECT', 'CUSTOM']).default('PROIECT'),
    handleType: z.enum(['APLICAT', 'BUTON', 'INGROPAT', 'PROFIL_J', 'GOLA', 'PUSH', 'FARA']).default('APLICAT'),
    handleItemId: optStr,
    frontExtensionMm: z.preprocess(emptyToUndefined, posNum.optional()),
  })
  .refine((d) => d.frontType !== 'USI' || d.doors >= 1, {
    message: 'Corpul cu uși are nevoie de cel puțin o ușă',
  })
  .refine((d) => d.frontType !== 'SERTARE' || d.drawersCount >= 1, {
    message: 'Corpul cu sertare are nevoie de cel puțin un sertar',
  })
  .refine((d) => d.frontType !== 'SERTARE' || d.drawersSystem !== 'PAL_BOX' || !!d.drawersBottomMaterialId, {
    message: 'Alege materialul pentru fundul sertarelor (cutie PAL)',
  })
  .refine((d) => d.frontType === 'FARA' || d.frontKind === 'MDF_VOPSIT' || !!d.frontMaterialId, {
    message: 'Fronturile cer un material de front',
  })
  .refine(
    (d) =>
      d.frontType === 'FARA' ||
      d.frontKind !== 'MDF_VOPSIT' ||
      (!!d.mdfSupplierId && !!d.mdfModelId && !!d.mdfRalCode),
    { message: 'MDF vopsit cere furnizor, model și culoare' },
  )
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
  const isMdfVopsit = d.frontType !== 'FARA' && d.frontKind === 'MDF_VOPSIT';
  return {
    label: d.label,
    type: d.type,
    widthMm: d.widthMm,
    heightMm: d.heightMm,
    depthMm: d.depthMm,
    mount: { top: d.mountTop, bottom: d.mountBottom },
    shelves: d.frontType === 'SERTARE' ? 0 : (d.frontType === 'USI' && !d.withShelves ? 0 : d.shelves),
    doors: d.frontType === 'USI' ? d.doors : 0,
    drawers:
      d.frontType === 'SERTARE'
        ? {
            count: d.drawersCount,
            system: d.drawersSystem,
            bottomMaterialId: d.drawersSystem === 'PAL_BOX' ? d.drawersBottomMaterialId : undefined,
            frontHeightsMm: heights.length > 0 ? heights : undefined,
          }
        : undefined,
    carcassMaterialId: d.carcassMaterialId,
    frontKind: d.frontKind,
    frontMaterialId: isMdfVopsit ? null : (d.frontType === 'FARA' ? null : (d.frontMaterialId ?? null)),
    mdfFront: isMdfVopsit
      ? {
          supplierId: d.mdfSupplierId!,
          modelId: d.mdfModelId!,
          finish: d.mdfFinish,
          faces: d.mdfFaces,
          ralCode: d.mdfRalCode!,
          colorCategory: d.mdfColorCategory,
        }
      : undefined,
    back: { enabled: d.backEnabled, materialId: d.backMaterialId, mount: d.backMount },
    edgeBands: {
      carcassFrontEdgeId: d.carcassFrontEdgeId,
      frontPerimeterId: d.frontPerimeterId ?? null,
    },
    blindPanelWidthMm: d.type === 'COLT' ? d.blindPanelWidthMm : undefined,
    hardwareSel: (() => {
      const sel = {
        hingeId: d.frontType === 'USI' ? d.hingeId : undefined,
        slideId: d.frontType === 'SERTARE' && d.drawersSystem === 'PAL_BOX' ? d.slideId : undefined,
        tandemboxHeightMm: d.frontType === 'SERTARE' && d.drawersSystem === 'TANDEMBOX' ? d.tandemboxHeightMm : undefined,
      };
      return sel.hingeId || sel.slideId || sel.tandemboxHeightMm !== undefined ? sel : undefined;
    })(),
    handle: d.handleMode === 'CUSTOM'
      ? {
          type: d.handleType,
          itemId: d.handleItemId,
          frontExtensionMm: d.handleType === 'FARA' ? d.frontExtensionMm : undefined,
        }
      : undefined,
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
