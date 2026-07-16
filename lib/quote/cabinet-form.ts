import { z } from 'zod';
import type { CabinetInput } from '@/lib/engine';

const posNum = z.coerce.number({ invalid_type_error: 'Introdu un număr' }).finite().positive('Introdu o valoare mai mare ca 0');
const intNonNeg = z.coerce.number({ invalid_type_error: 'Introdu un număr' }).int('Introdu un număr întreg').min(0, 'Nu poate fi negativ');
const emptyToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v);
const optStr = z.preprocess(emptyToUndefined, z.string().optional());
const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

export const cabinetFormSchema = z
  .object({
    label: z.string().trim().min(1, 'Completează eticheta'),
    type: z.enum(['BAZA', 'SUSPENDAT', 'INALT', 'COLT']),
    widthMm: posNum,
    heightMm: posNum,
    depthMm: posNum,
    mountTop: z.enum(['INCADRAT', 'APLICAT']).default('INCADRAT'),
    mountBottom: z.enum(['INCADRAT', 'APLICAT']).default('INCADRAT'),
    frontType: z.enum(['USI', 'SERTARE', 'FARA']),
    withShelves: checkbox,
    shelves: intNonNeg,
    shelfMaterialId: optStr,
    shelfDecorMatters: checkbox,
    shelfDecorAxis: z.enum(['LR', 'FB']).default('LR'),
    doors: intNonNeg,
    carcassMaterialId: z.string().min(1, 'Alege materialul carcasei'),
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
    carcassFrontEdgeId: z.string().min(1, 'Alege cantul carcasei'),
    frontPerimeterId: optStr,
    blindPanelWidthMm: z.preprocess(emptyToUndefined, posNum.optional()),
    drawersCount: intNonNeg.default(0),
    drawersSystem: z.enum(['PAL_BOX', 'TANDEMBOX']).default('TANDEMBOX'),
    drawersBottomMaterialId: optStr,
    drawerFrontHeightsMm: z.preprocess(emptyToUndefined, z.string().optional()),
    tandemboxHeightMm: z.preprocess(emptyToUndefined, posNum.optional()),
    doorOpening: z.enum(['BALAMALE', 'RIDICABILA']).default('BALAMALE'),
    handleMode: z.enum(['PROIECT', 'CUSTOM']).default('PROIECT'),
    handleType: z.enum(['APLICAT', 'BUTON', 'INGROPAT', 'PROFIL_J', 'GOLA', 'PUSH', 'FARA']).default('APLICAT'),
    frontExtensionMm: z.preprocess(emptyToUndefined, posNum.optional()),
  })
  .refine((d) => d.frontType !== 'USI' || d.doors >= 1, {
    message: 'Corpul cu uși are nevoie de cel puțin o ușă',
    path: ['doors'],
  })
  .refine((d) => d.frontType !== 'SERTARE' || d.drawersCount >= 1, {
    message: 'Corpul cu sertare are nevoie de cel puțin un sertar',
    path: ['drawersCount'],
  })
  .refine((d) => d.frontType !== 'SERTARE' || d.drawersSystem !== 'PAL_BOX' || !!d.drawersBottomMaterialId, {
    message: 'Alege materialul pentru fundul sertarelor (cutie PAL)',
    path: ['drawersBottomMaterialId'],
  })
  .refine((d) => d.frontType === 'FARA' || d.frontKind === 'MDF_VOPSIT' || !!d.frontMaterialId, {
    message: 'Alege materialul fronturilor',
    path: ['frontMaterialId'],
  })
  .refine(
    (d) =>
      d.frontType === 'FARA' ||
      d.frontKind !== 'MDF_VOPSIT' ||
      (!!d.mdfSupplierId && !!d.mdfModelId && !!d.mdfRalCode),
    { message: 'MDF vopsit cere furnizor, model și culoare', path: ['mdfSupplierId'] },
  )
  .refine((d) => {
    if (d.frontType !== 'SERTARE' || !d.drawerFrontHeightsMm) return true;
    const heights = parseDrawerHeights(d.drawerFrontHeightsMm);
    return heights.length === d.drawersCount && heights.every((h) => h > 0);
  }, { message: 'Înălțimile sertarelor nu corespund cu numărul de sertare', path: ['drawerFrontHeightsMm'] })
  .refine((d) => !d.backEnabled || !!d.backMaterialId, {
    message: 'Alege materialul pentru spate',
    path: ['backMaterialId'],
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
  const shelves = d.frontType === 'SERTARE' ? 0 : (d.frontType === 'USI' && !d.withShelves ? 0 : d.shelves);
  return {
    label: d.label,
    type: d.type,
    widthMm: d.widthMm,
    heightMm: d.heightMm,
    depthMm: d.depthMm,
    mount: { top: d.mountTop, bottom: d.mountBottom },
    shelves,
    shelf: shelves > 0 && (d.shelfMaterialId || d.shelfDecorMatters)
      ? {
          materialId: d.shelfMaterialId,
          decorAxis: d.shelfDecorMatters ? d.shelfDecorAxis : undefined,
        }
      : undefined,
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
    // uși ridicabile doar la suspendat (set Aventos în loc de balamale)
    doorOpening: d.frontType === 'USI' && d.type === 'SUSPENDAT' && d.doorOpening === 'RIDICABILA'
      ? 'RIDICABILA'
      : undefined,
    // v4: produsele de feronerie (balamale/mâner/glisiere) se aleg în tabelul de feronerie
    // (HardwareAdjustments) — aici rămâne doar configurația care decide setul Tandembox
    hardwareSel: d.frontType === 'SERTARE' && d.drawersSystem === 'TANDEMBOX' && d.tandemboxHeightMm !== undefined
      ? { tandemboxHeightMm: d.tandemboxHeightMm }
      : undefined,
    handle: d.handleMode === 'CUSTOM'
      ? {
          type: d.handleType,
          frontExtensionMm: d.handleType === 'FARA' ? d.frontExtensionMm : undefined,
        }
      : undefined,
  };
}

/**
 * Corpurile se creează goale la „Adaugă corp" și se completează în editor.
 * Un corp incomplet nu intră în calculul ofertei (e exclus cu avertisment) —
 * oglindește cerințele minime din cabinetFormSchema la nivel de CabinetInput.
 */
export function isCabinetInputComplete(i: CabinetInput): boolean {
  // blatul are alte cerințe minime: lungime + adâncime + material blat.
  // „adâncimea > lățimea plăcii" (nr. manual de plăci) e tratat ca avertisment la calcul, nu incompletitudine.
  if (i.type === 'BLAT') {
    return i.widthMm > 0 && i.depthMm > 0 && !!i.blat?.materialId;
  }
  const isVopsit = i.frontKind === 'MDF_VOPSIT' && !!i.mdfFront;
  const hasFronts = i.doors > 0 || (i.drawers?.count ?? 0) > 0;
  return (
    i.widthMm > 0 && i.heightMm > 0 && i.depthMm > 0 &&
    !!i.carcassMaterialId &&
    !!i.edgeBands.carcassFrontEdgeId &&
    (!hasFronts || !!i.frontMaterialId || isVopsit) &&
    (i.drawers?.system !== 'PAL_BOX' || !!i.drawers.bottomMaterialId) &&
    (!i.back.enabled || !!i.back.materialId)
  );
}

export const extraPartSchema = z.object({
  name: z.string().trim().min(1),
  lengthMm: posNum,
  widthMm: posNum,
  qty: z.coerce.number().int().min(1),
  materialId: z.string().min(1),
});

export type ExtraPart = z.infer<typeof extraPartSchema>;

/** Blatul are un formular propriu, minimal: fără carcasă/fronturi/feronerie.
 *  widthMm = lungime (rularea pe perete), depthMm = adâncime (față–spate). */
export const blatFormSchema = z.object({
  label: z.string().trim().min(1, 'Completează eticheta'),
  widthMm: posNum,
  depthMm: posNum,
  blatMaterialId: z.string().min(1, 'Alege materialul blatului'),
  manualPieces: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional()),
});
export type BlatFormData = z.infer<typeof blatFormSchema>;

export function toBlatInput(d: BlatFormData, thicknessMm: number): CabinetInput {
  return {
    label: d.label,
    type: 'BLAT',
    widthMm: d.widthMm,
    heightMm: thicknessMm, // grosimea preluată din material (informativ)
    depthMm: d.depthMm,
    shelves: 0,
    doors: 0,
    carcassMaterialId: '',
    frontMaterialId: null,
    back: { enabled: false, mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: '', frontPerimeterId: null },
    blat: { materialId: d.blatMaterialId, manualPieces: d.manualPieces },
  };
}
