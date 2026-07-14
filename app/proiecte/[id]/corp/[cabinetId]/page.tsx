import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { buildHardwareDefaults, parseConstruction, toCostCatalogs } from '@/lib/catalog/convert';
import {
  expandCabinet, resolveSuggestions,
  type CabinetInput, type ExpandedCabinet, type HardwareCategory, type HardwareItem, type HardwareLine,
} from '@/lib/engine';
import { addExtraPart, removeExtraPart, resetCabinetHardware, saveCabinetHardware, updateCabinetData } from '@/lib/quote/actions';
import { buildSnapshot } from '@/lib/quote/snapshot';
import { pickLegId } from '@/lib/quote/legs';
import type { ExtraPart } from '@/lib/quote/cabinet-form';
import { CabinetEditorForm, type FieldOption } from '@/components/CabinetEditorForm';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fmtNum } from '@/lib/format';

export const dynamic = 'force-dynamic';

function optionsWithCurrent<T extends { id: string; name: string; active: boolean }>(
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

function isInactiveId(rows: { id: string; active: boolean }[], id: string | null | undefined): boolean {
  return !!id && rows.some((r) => r.id === id && !r.active);
}

function sameHardwareMultiset(a: HardwareLine[], b: HardwareLine[]): boolean {
  if (a.length !== b.length) return false;
  const key = (l: HardwareLine) => `${l.hardwareId}:${l.qty}`;
  const counts = new Map<string, number>();
  for (const l of a) counts.set(key(l), (counts.get(key(l)) ?? 0) + 1);
  for (const l of b) {
    const k = key(l);
    const c = counts.get(k);
    if (!c) return false;
    counts.set(k, c - 1);
  }
  return true;
}

function cabinetInputToFormValues(input: CabinetInput): Record<string, string> {
  const frontType = input.drawers && input.drawers.count > 0 ? 'SERTARE' : input.doors > 0 ? 'USI' : 'FARA';
  return {
    label: input.label,
    type: input.type,
    frontType,
    withShelves: input.shelves > 0 ? 'true' : 'false',
    widthMm: String(input.widthMm),
    heightMm: String(input.heightMm),
    depthMm: String(input.depthMm),
    // chiuvetă (uși, 0 polițe): câmpul pornește de la 1 ca bifarea „Cu polițe" să aibă o valoare;
    // la FARA păstrăm 0 real (etajera fără polițe rămâne fără)
    shelves: String(input.shelves > 0 ? input.shelves : input.doors > 0 ? 1 : 0),
    doors: String(Math.max(input.doors, 1)),
    carcassMaterialId: input.carcassMaterialId,
    frontMaterialId: input.frontMaterialId ?? '',
    backEnabled: input.back.enabled ? 'true' : 'false',
    backMaterialId: input.back.materialId ?? '',
    backMount: input.back.mount,
    carcassFrontEdgeId: input.edgeBands.carcassFrontEdgeId,
    frontPerimeterId: input.edgeBands.frontPerimeterId ?? '',
    blindPanelWidthMm: input.blindPanelWidthMm != null ? String(input.blindPanelWidthMm) : '',
    drawersCount: String(input.drawers?.count ?? 0),
    drawersSystem: input.drawers?.system ?? 'METAL_BOX',
    drawersBottomMaterialId: input.drawers?.bottomMaterialId ?? '',
    drawerFrontHeightsMm: input.drawers?.frontHeightsMm?.join(', ') ?? '',
  };
}

export default async function CorpPage({ params }: { params: Promise<{ id: string; cabinetId: string }> }) {
  const { id, cabinetId } = await params;
  const cab = await prisma.cabinet.findUnique({ where: { id: cabinetId } });
  if (!cab || cab.projectId !== id) notFound();
  const input = JSON.parse(cab.inputJson) as CabinetInput;

  const [project, assembly, materials, edgeBands, settings] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id } }),
    cab.assemblyId ? prisma.assembly.findUnique({ where: { id: cab.assemblyId } }) : Promise.resolve(null),
    prisma.material.findMany({ orderBy: { name: 'asc' } }),
    prisma.edgeBand.findMany({ orderBy: { thicknessMm: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const legHeightMm = assembly?.legHeightMm ?? null;
  const activeMaterials = materials.filter((m) => m.active);
  const materialName = (mid: string) => materials.find((m) => m.id === mid)?.name ?? mid;

  const hardwareItems = await prisma.hardwareItem.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  const activeHardwareItems = hardwareItems.filter((h) => h.active);
  const hardwareLabel = (h: (typeof hardwareItems)[number]) => `${h.name} (${h.pricePerUnit} lei)`;
  const hardwareOptions = optionsWithCurrent(activeHardwareItems, undefined, hardwareLabel);
  const hardwareName = (hid: string) => hardwareItems.find((h) => h.id === hid)?.name ?? hid;
  const overrides = cab.hardwareJson ? (JSON.parse(cab.hardwareJson) as HardwareLine[]) : null;
  const extraParts = JSON.parse(cab.extraPartsJson) as ExtraPart[];

  const snapshot = await buildSnapshot();

  let expanded: ExpandedCabinet | null = null;
  let expandError: string | null = null;
  try {
    const catalogs = toCostCatalogs(
      materials.map((m) => m),
      edgeBands.map((e) => e),
      [],
      [],
    );
    const cc = parseConstruction(settings?.constructionJson ?? '{}');
    expanded = expandCabinet(input, catalogs, cc);
  } catch (e) {
    expandError = e instanceof Error ? e.message : 'Eroare la generarea pieselor';
  }

  let suggestedLines: HardwareLine[] = [];
  let unresolvedSuggestions: { category: string; name: string; qty: number }[] = [];
  if (expanded && settings) {
    const defaults = buildHardwareDefaults(activeHardwareItems, settings);
    if (legHeightMm != null) {
      defaults.legId = pickLegId(hardwareItems, legHeightMm, defaults.legId);
    }
    const hardwareItemsLike: HardwareItem[] = hardwareItems.map((h) => ({
      id: h.id,
      name: h.name,
      category: h.category as HardwareCategory,
      pricePerUnit: h.pricePerUnit,
      nominalLengthMm: h.nominalLengthMm ?? undefined,
      boxHeightMm: h.boxHeightMm ?? undefined,
    }));
    const resolved = resolveSuggestions(expanded.hardware, defaults, hardwareItemsLike);
    suggestedLines = resolved.lines;
    unresolvedSuggestions = resolved.unresolved;
  }

  const hasInactiveRefs =
    isInactiveId(materials, input.carcassMaterialId) ||
    isInactiveId(materials, input.frontMaterialId) ||
    isInactiveId(materials, input.back.materialId) ||
    isInactiveId(materials, input.drawers?.bottomMaterialId) ||
    isInactiveId(edgeBands, input.edgeBands.carcassFrontEdgeId) ||
    isInactiveId(edgeBands, input.edgeBands.frontPerimeterId) ||
    (overrides !== null && overrides.some((l) => isInactiveId(hardwareItems, l.hardwareId)));

  const overridesStale = overrides !== null && !sameHardwareMultiset(overrides, suggestedLines);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Corp: {input.label}</h1>
        <Link href={`/proiecte/${id}`} className="text-sm text-muted-foreground hover:underline">← Înapoi la proiect</Link>
      </div>

      {hasInactiveRefs && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-800">
          <AlertDescription>
            Corpul folosește materiale/feronerie dezactivate — verifică selecturile marcate „(dezactivat)".
          </AlertDescription>
        </Alert>
      )}

      <CabinetEditorForm
        cabinetId={cabinetId}
        initial={cabinetInputToFormValues(input)}
        snapshot={snapshot}
        laborPct={project.laborPct}
        yieldFactor={project.yieldFactor}
        legHeightMm={legHeightMm}
        materialOptions={{
          carcass: optionsWithCurrent(materials, input.carcassMaterialId),
          front: optionsWithCurrent(materials, input.frontMaterialId),
          back: optionsWithCurrent(materials, input.back.materialId),
          drawersBottom: optionsWithCurrent(materials, input.drawers?.bottomMaterialId),
        }}
        bandOptions={{
          carcassFront: optionsWithCurrent(edgeBands, input.edgeBands.carcassFrontEdgeId),
          frontPerimeter: optionsWithCurrent(edgeBands, input.edgeBands.frontPerimeterId),
        }}
        hardwareOverrides={overrides}
        extraParts={extraParts}
        save={updateCabinetData.bind(null, cabinetId)}
      />

      <Card>
        <CardHeader><CardTitle>Feronerie</CardTitle></CardHeader>
        <CardContent>
          {overrides === null ? (
            <>
              <p className="mb-2 text-sm text-muted-foreground">
                Sugestii automate (se recalculează la fiecare salvare a corpului). Preia-le în editor doar dacă vrei să le modifici.
              </p>
              <ul className="mb-3 space-y-1 text-sm">
                {suggestedLines.map((l) => (
                  <li key={l.hardwareId}>{l.qty} × {hardwareName(l.hardwareId)}</li>
                ))}
                {unresolvedSuggestions.map((s, i) => (
                  <li key={`unresolved-${i}`} className="text-amber-800">⚠ {s.qty} × {s.name} — fără produs implicit (setează în Setări)</li>
                ))}
                {suggestedLines.length === 0 && unresolvedSuggestions.length === 0 && (
                  <li className="text-muted-foreground">Nicio sugestie (corp fără fronturi/sertare).</li>
                )}
              </ul>
              <ActionForm action={saveCabinetHardware.bind(null, cabinetId)}>
                {suggestedLines.map((l) => (
                  <span key={l.hardwareId}>
                    <input type="hidden" name="hardwareId" value={l.hardwareId} />
                    <input type="hidden" name="qty" value={l.qty} />
                  </span>
                ))}
                <SubmitButton>Preia în editor</SubmitButton>
              </ActionForm>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm text-muted-foreground">
                Feronerie editată manual — sugestiile automate nu se mai aplică acestui corp. Cantitate 0 = rândul dispare la salvare.
              </p>
              {overridesStale && (
                <Alert className="mb-2 border-amber-300 bg-amber-50 text-amber-800">
                  <AlertDescription>
                    ⚠ Sugestiile automate pentru dimensiunile curente diferă de feroneria editată — verifică (ex. număr balamale).
                  </AlertDescription>
                </Alert>
              )}
              <ActionForm action={saveCabinetHardware.bind(null, cabinetId)} className="space-y-2">
                {overrides.map((l, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="col-span-2">
                      <Select name="hardwareId" label="Produs" options={optionsWithCurrent(hardwareItems, l.hardwareId, hardwareLabel)} defaultValue={l.hardwareId} />
                    </div>
                    <NumberInput name="qty" label="Buc" defaultValue={l.qty} step="1" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="col-span-2">
                    <Select name="hardwareId" label="Adaugă produs" options={hardwareOptions} allowEmpty />
                  </div>
                  <NumberInput name="qty" label="Buc" defaultValue={0} required={false} step="1" />
                </div>
                <div className="flex gap-2">
                  <SubmitButton>Salvează feroneria</SubmitButton>
                </div>
              </ActionForm>
              <div className="mt-2">
                <ActionForm action={resetCabinetHardware.bind(null, cabinetId)}>
                  <button type="submit" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
                    Revino la sugestiile automate
                  </button>
                </ActionForm>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Piese suplimentare</CardTitle></CardHeader>
        <CardContent>
          <ul className="mb-3 space-y-2">
            {extraParts.map((p, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="grow">{p.name} — {fmtNum(p.lengthMm, 1)} × {fmtNum(p.widthMm, 1)} mm × {p.qty} buc ({materialName(p.materialId)})</span>
                <DeleteButton action={removeExtraPart.bind(null, cabinetId, i)} label="Șterge" />
              </li>
            ))}
            {extraParts.length === 0 && <li className="text-sm text-muted-foreground">Nicio piesă suplimentară.</li>}
          </ul>
          <ActionForm action={addExtraPart.bind(null, cabinetId)} className="grid grid-cols-2 items-end gap-2 md:grid-cols-6">
            <TextInput name="name" label="Denumire" />
            <NumberInput name="lengthMm" label="Lungime (mm)" step="1" />
            <NumberInput name="widthMm" label="Lățime (mm)" step="1" />
            <NumberInput name="qty" label="Buc" defaultValue={1} step="1" />
            <Select name="materialId" label="Material" options={activeMaterials.map((m) => ({ value: m.id, label: m.name }))} />
            <div><SubmitButton>Adaugă</SubmitButton></div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
