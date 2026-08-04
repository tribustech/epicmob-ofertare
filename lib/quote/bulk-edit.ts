import type { CabinetInput } from '@/lib/engine';
import { z } from 'zod';
import { computeQuote, type QuoteInput, type SnapshotData } from './compute';

type BoardFrontPatch = {
  kind: 'PAL' | 'MDF_MELAMINAT' | 'MDF_INFOLIAT';
  materialId: string;
};

type PaintedFrontPatch = {
  kind: 'MDF_VOPSIT';
  mdfFront: NonNullable<CabinetInput['mdfFront']>;
};

type GlassFrontPatch = {
  kind: 'STICLA_RAMA';
  materialId: string;
};

export type BulkFrontPatch = BoardFrontPatch | PaintedFrontPatch | GlassFrontPatch;

export interface BulkCabinetPatch {
  carcassMaterialId?: string;
  front?: BulkFrontPatch;
  dimensions?: {
    widthMm?: number;
    heightMm?: number;
    depthMm?: number;
  };
}

const positiveDimension = z.number().finite().positive('Dimensiunea trebuie să fie mai mare ca 0').optional();
const mdfFrontSchema = z.object({
  supplierId: z.string().min(1),
  modelId: z.string().min(1),
  finish: z.enum(['MAT', 'LUCIOS']),
  faces: z.number().int().min(1).max(2),
  ralCode: z.string().trim().min(1),
  colorCategory: z.enum(['NORMALA', 'VIE', 'METALIZAT']),
});

export const bulkCabinetPatchSchema: z.ZodType<BulkCabinetPatch> = z.object({
  carcassMaterialId: z.string().min(1).optional(),
  front: z.discriminatedUnion('kind', [
    z.object({ kind: z.enum(['PAL', 'MDF_MELAMINAT', 'MDF_INFOLIAT']), materialId: z.string().min(1) }),
    z.object({ kind: z.literal('MDF_VOPSIT'), mdfFront: mdfFrontSchema }),
    z.object({ kind: z.literal('STICLA_RAMA'), materialId: z.string().min(1) }),
  ]).optional(),
  dimensions: z.object({
    widthMm: positiveDimension,
    heightMm: positiveDimension,
    depthMm: positiveDimension,
  }).optional(),
}).refine((patch) => (
  patch.carcassMaterialId !== undefined
  || patch.front !== undefined
  || patch.dimensions?.widthMm !== undefined
  || patch.dimensions?.heightMm !== undefined
  || patch.dimensions?.depthMm !== undefined
), { message: 'Alege cel puțin o modificare' });

export function applyBulkCabinetPatch(
  source: CabinetInput,
  patch: BulkCabinetPatch,
): { input: CabinetInput; frontSkipped: boolean } {
  const input: CabinetInput = {
    ...source,
    back: { ...source.back },
    edgeBands: { ...source.edgeBands },
    ...(source.shelf ? { shelf: { ...source.shelf } } : {}),
  };

  if (patch.carcassMaterialId) {
    input.carcassMaterialId = patch.carcassMaterialId;
    if (input.shelf) input.shelf.materialId = patch.carcassMaterialId;
  }

  if (patch.dimensions?.widthMm !== undefined) input.widthMm = patch.dimensions.widthMm;
  if (patch.dimensions?.heightMm !== undefined) input.heightMm = patch.dimensions.heightMm;
  if (patch.dimensions?.depthMm !== undefined) input.depthMm = patch.dimensions.depthMm;

  const hasFronts = input.doors > 0 || (input.drawers?.count ?? 0) > 0;
  const frontSkipped = patch.front !== undefined && !hasFronts;

  if (patch.front && hasFronts) {
    input.frontKind = patch.front.kind;
    input.edgeBands.frontPerimeterId = ['MDF_INFOLIAT', 'MDF_VOPSIT', 'STICLA_RAMA'].includes(patch.front.kind)
      ? null
      : input.edgeBands.frontPerimeterId;

    if (patch.front.kind === 'MDF_VOPSIT') {
      input.frontMaterialId = null;
      input.mdfFront = { ...patch.front.mdfFront };
    } else {
      input.frontMaterialId = patch.front.materialId;
      delete input.mdfFront;
    }
  }

  return { input, frontSkipped };
}

export interface BulkEditPreview {
  totalBefore: number;
  totalAfter: number;
  selectedBefore: number;
  selectedAfter: number;
  skippedFrontLabels: string[];
  patchedInputs: Map<string, CabinetInput>;
}

export function buildBulkEditPreview(
  quoteInput: QuoteInput,
  snapshot: SnapshotData,
  cabinetIds: string[],
  rawPatch: BulkCabinetPatch,
): BulkEditPreview {
  const patch = bulkCabinetPatchSchema.parse(rawPatch);
  const selectedIds = new Set(cabinetIds);
  if (selectedIds.size === 0) throw new Error('Selectează cel puțin un corp');

  const skippedFrontLabels: string[] = [];
  const patchedInputs = new Map<string, CabinetInput>();
  const patchedCabinets = quoteInput.cabinets.map((cabinet) => {
    if (!cabinet.id || !selectedIds.has(cabinet.id)) return cabinet;
    const result = applyBulkCabinetPatch(cabinet.input, patch);
    if (result.frontSkipped) skippedFrontLabels.push(cabinet.input.label);
    patchedInputs.set(cabinet.id, result.input);
    return { ...cabinet, input: result.input };
  });

  if (patchedInputs.size !== selectedIds.size) {
    throw new Error('Unul sau mai multe corpuri selectate nu există');
  }

  const before = computeQuote(quoteInput, snapshot);
  const afterInput: QuoteInput = { ...quoteInput, cabinets: patchedCabinets };
  const after = computeQuote(afterInput, snapshot);
  const selectedBeforeInput: QuoteInput = {
    ...quoteInput,
    freeLines: [],
    cabinets: quoteInput.cabinets.filter((cabinet) => cabinet.id && selectedIds.has(cabinet.id)),
  };
  const selectedAfterInput: QuoteInput = {
    ...afterInput,
    freeLines: [],
    cabinets: patchedCabinets.filter((cabinet) => cabinet.id && selectedIds.has(cabinet.id)),
  };

  return {
    totalBefore: before.costs.sellPrice,
    totalAfter: after.costs.sellPrice,
    selectedBefore: computeQuote(selectedBeforeInput, snapshot).costs.sellPrice,
    selectedAfter: computeQuote(selectedAfterInput, snapshot).costs.sellPrice,
    skippedFrontLabels,
    patchedInputs,
  };
}
