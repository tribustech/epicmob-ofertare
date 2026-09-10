import type { AppSettings, EdgeBand, HardwareItem, Material } from '@prisma/client';
import { prisma } from '@/lib/db';
import { buildSnapshot } from '@/lib/quote/snapshot';
import { getRalColors } from '@/lib/ral';
import type { FieldOption } from '@/components/CabinetEditorForm';
import type { FrontModelOption } from '@/components/FrontModelPicker';
import type { RalColor } from '@/components/RalPicker';

export function optionsWithCurrent<T extends { id: string; name: string; active: boolean }>(
  rows: T[],
  currentId: string | null | undefined,
  formatActive: (r: T) => string = (r) => r.name,
): FieldOption[] {
  const opts = rows.filter((r) => r.active).map((r) => ({ value: r.id, label: formatActive(r) }));
  if (currentId && !opts.some((o) => o.value === currentId)) {
    const row = rows.find((r) => r.id === currentId);
    if (row) opts.push({ value: row.id, label: `${row.name} (dezactivat)` });
  }
  return opts;
}

export const hardwareLabel = (h: HardwareItem) => `${h.name} (${h.pricePerUnit} lei)`;

export function buildHardwareSelOptions(hardwareItems: HardwareItem[], settings: AppSettings | null) {
  const hinges = hardwareItems.filter((h) => h.active && h.category === 'BALAMA');
  const slides = hardwareItems.filter((h) => h.active && h.category === 'SERTAR' && h.boxHeightMm == null && h.nominalLengthMm != null);
  const tandemboxHeights = [...new Set(
    hardwareItems.filter((h) => h.active && h.category === 'SERTAR' && h.boxHeightMm != null).map((h) => h.boxHeightMm as number),
  )].sort((a, b) => a - b);
  const handleItems = hardwareItems.filter((h) => h.active && h.category === 'MANER');
  const pushItems = hardwareItems.filter((h) => h.active && h.category === 'ACCESORIU');
  const defaultHinge = settings?.defaultHingeId ? hardwareItems.find((h) => h.id === settings.defaultHingeId) : null;
  return {
    hinges: hinges.map((h) => ({ value: h.id, label: hardwareLabel(h) })),
    slides: slides.map((h) => ({ value: h.id, label: hardwareLabel(h) })),
    tandemboxHeights,
    handleItems: handleItems.map((h) => ({ value: h.id, label: hardwareLabel(h) })),
    pushItems: pushItems.map((h) => ({ value: h.id, label: hardwareLabel(h) })),
    defaultHingeName: defaultHinge?.name ?? null,
  };
}

export interface CorpEditorData {
  quote: NonNullable<Awaited<ReturnType<typeof prisma.quote.findUnique>>>;
  materials: Material[];
  edgeBands: EdgeBand[];
  settings: AppSettings | null;
  hardwareItems: HardwareItem[];
  snapshot: Awaited<ReturnType<typeof buildSnapshot>>;
  frontSupplierOptions: FieldOption[];
  frontModelOptions: FrontModelOption[];
  ralColors: RalColor[];
}

export async function loadCorpEditorData(quoteId: string): Promise<CorpEditorData> {
  const [quote, materials, edgeBands, settings, frontSuppliers, frontModels, hardwareItems, snapshot] = await Promise.all([
    prisma.quote.findUniqueOrThrow({ where: { id: quoteId } }),
    prisma.material.findMany({ orderBy: { name: 'asc' } }),
    prisma.edgeBand.findMany({ orderBy: { thicknessMm: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.frontSupplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.frontModel.findMany({ where: { active: true }, orderBy: [{ tier: 'asc' }, { code: 'asc' }] }),
    prisma.hardwareItem.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    buildSnapshot(),
  ]);

  // Fronturi MDF vopsit: opțiuni pentru sub-formular (furnizor/model) + paleta RAL (plain data client-safe)
  const frontSupplierOptions: FieldOption[] = frontSuppliers.map((s) => ({ value: s.id, label: s.name }));
  const frontModelOptions: FrontModelOption[] = frontModels.map((m) => ({
    id: m.id, code: m.code, name: m.name, tier: m.tier,
    collection: m.collection, shapeFamily: m.shapeFamily, imageUrl: m.imageUrl,
  }));
  const ralColors: RalColor[] = getRalColors().map((c) => ({
    code: c.code, num: c.num, name_en: c.name_en, hex: c.hex, vivid: c.vivid, black: c.black,
  }));

  return { quote, materials, edgeBands, settings, hardwareItems, snapshot, frontSupplierOptions, frontModelOptions, ralColors };
}
