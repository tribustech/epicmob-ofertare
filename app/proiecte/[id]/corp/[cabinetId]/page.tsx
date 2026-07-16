import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { buildHardwareDefaults, parseConstruction, toCostCatalogs } from '@/lib/catalog/convert';
import {
  expandCabinet, resolveSuggestions,
  type CabinetInput, type ExpandedCabinet, type HandleType, type HardwareCategory, type HardwareItem, type HardwareLine,
} from '@/lib/engine';
import { addExtraPart, removeExtraPart, resetCabinetHardware, saveCabinetHardware, updateCabinetData } from '@/lib/quote/actions';
import { pickLegId } from '@/lib/quote/legs';
import { normalizeCabinetInput } from '@/lib/quote/normalize-input';
import type { ExtraPart } from '@/lib/quote/cabinet-form';
import { HANDLE_TYPE_OPTIONS, withResolvedHandle } from '@/lib/quote/handle';
import { buildHardwareSelOptions, hardwareLabel, loadCorpEditorData, optionsWithCurrent } from '@/lib/quote/corp-editor-data';
import { CabinetEditorForm } from '@/components/CabinetEditorForm';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fmtNum } from '@/lib/format';

export const dynamic = 'force-dynamic';

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
    frontKind: input.frontKind ?? 'PAL',
    frontMaterialId: input.frontMaterialId ?? '',
    mdfSupplierId: input.mdfFront?.supplierId ?? '',
    mdfModelId: input.mdfFront?.modelId ?? '',
    mdfFinish: input.mdfFront?.finish ?? 'MAT',
    mdfFaces: String(input.mdfFront?.faces ?? 1),
    mdfRalCode: input.mdfFront?.ralCode ?? '',
    mdfColorCategory: input.mdfFront?.colorCategory ?? 'NORMALA',
    backEnabled: input.back.enabled ? 'true' : 'false',
    backMaterialId: input.back.materialId ?? '',
    backMount: input.back.mount,
    carcassFrontEdgeId: input.edgeBands.carcassFrontEdgeId,
    frontPerimeterId: input.edgeBands.frontPerimeterId ?? '',
    blindPanelWidthMm: input.blindPanelWidthMm != null ? String(input.blindPanelWidthMm) : '',
    drawersCount: String(input.drawers?.count ?? 0),
    drawersSystem: input.drawers?.system ?? 'TANDEMBOX',
    drawersBottomMaterialId: input.drawers?.bottomMaterialId ?? '',
    drawerFrontHeightsMm: input.drawers?.frontHeightsMm?.join(', ') ?? '',
    mountTop: input.mount?.top ?? 'INCADRAT',
    mountBottom: input.mount?.bottom ?? 'INCADRAT',
    hingeId: input.hardwareSel?.hingeId ?? '',
    slideId: input.hardwareSel?.slideId ?? '',
    tandemboxHeightMm: input.hardwareSel?.tandemboxHeightMm != null ? String(input.hardwareSel.tandemboxHeightMm) : '',
    handleMode: input.handle ? 'CUSTOM' : 'PROIECT',
    handleType: input.handle?.type ?? 'APLICAT',
    handleItemId: input.handle?.itemId ?? '',
    frontExtensionMm: input.handle?.frontExtensionMm != null ? String(input.handle.frontExtensionMm) : '',
  };
}

export default async function CorpPage({ params }: { params: Promise<{ id: string; cabinetId: string }> }) {
  const { id, cabinetId } = await params;
  const cab = await prisma.cabinet.findUnique({ where: { id: cabinetId } });
  if (!cab || cab.projectId !== id) notFound();
  const input = normalizeCabinetInput(JSON.parse(cab.inputJson));

  const [editorData, assembly] = await Promise.all([
    loadCorpEditorData(id),
    cab.assemblyId ? prisma.assembly.findUnique({ where: { id: cab.assemblyId } }) : Promise.resolve(null),
  ]);
  const {
    project, materials, edgeBands, settings, hardwareItems, snapshot,
    frontSupplierOptions, frontModelOptions, ralColors,
  } = editorData;
  const legHeightMm = assembly?.legHeightMm ?? null;
  const activeMaterials = materials.filter((m) => m.active);
  const materialName = (mid: string) => materials.find((m) => m.id === mid)?.name ?? mid;

  const activeHardwareItems = hardwareItems.filter((h) => h.active);
  const hardwareOptions = optionsWithCurrent(activeHardwareItems, undefined, hardwareLabel);
  const hardwareName = (hid: string) => hardwareItems.find((h) => h.id === hid)?.name ?? hid;
  const overrides = cab.hardwareJson ? (JSON.parse(cab.hardwareJson) as HardwareLine[]) : null;
  const extraParts = JSON.parse(cab.extraPartsJson) as ExtraPart[];

  const hardwareSelOptions = buildHardwareSelOptions(hardwareItems, settings);

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
    const expandInput = withResolvedHandle(input, { type: project.handleType as HandleType, itemId: project.handleItemId });
    expanded = expandCabinet(expandInput, catalogs, cc);
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

  const feronerieSummary = overrides !== null
    ? 'Editată manual'
    : suggestedLines.length + unresolvedSuggestions.length === 0
      ? 'Nicio sugestie'
      : `${suggestedLines.length + unresolvedSuggestions.length} sugestii automate`;
  const extraPartsSummary = extraParts.length === 0
    ? 'Nicio piesă suplimentară'
    : `${extraParts.length} ${extraParts.length === 1 ? 'piesă' : 'piese'}`;

  // comenzi rapide: un click adaugă produsul (cu liniile curente păstrate) și trece corpul pe feronerie editată manual
  const quickAddChips = (current: HardwareLine[]) => {
    const present = new Set(current.map((l) => l.hardwareId));
    const items = activeHardwareItems.filter((h) => !present.has(h.id));
    if (items.length === 0) return null;
    return (
      <div className="mt-3 border-t pt-2">
        <p className="mb-1.5 text-xs text-muted-foreground">Adaugă rapid (1 buc — ajustezi apoi cantitatea):</p>
        <div className="flex flex-wrap gap-1.5">
          {items.map((h) => (
            <ActionForm key={h.id} action={saveCabinetHardware.bind(null, cabinetId)} className="inline">
              {current.map((l, i) => (
                <span key={i}>
                  <input type="hidden" name="hardwareId" value={l.hardwareId} />
                  <input type="hidden" name="qty" value={l.qty} />
                </span>
              ))}
              <input type="hidden" name="hardwareId" value={h.id} />
              <input type="hidden" name="qty" value={1} />
              <button type="submit" className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted">
                ＋ {h.name}
              </button>
            </ActionForm>
          ))}
        </div>
      </div>
    );
  };

  const feronerieSlot = (
    <>
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
              <li key={`unresolved-${i}`} className="text-amber-800">
                ⚠ {s.qty} × {s.name} — {s.category === 'MANER'
                  ? 'alege produsul mânerului la Fronturi sau în setările proiectului'
                  : 'fără produs implicit (setează în Setări)'}
              </li>
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
          {quickAddChips(suggestedLines)}
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
          {quickAddChips(overrides)}
          <div className="mt-2">
            <ActionForm action={resetCabinetHardware.bind(null, cabinetId)}>
              <button type="submit" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
                Revino la sugestiile automate
              </button>
            </ActionForm>
          </div>
        </>
      )}
    </>
  );
  const extraPartsSlot = (
    <>
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
        <Select name="materialId" label="Material" options={activeMaterials
          .filter((m) => m.category !== 'BLAT')
          .map((m) => ({ value: m.id, label: m.decorCode ? `${m.decorCode} · ${m.name}` : m.name }))} />
        <div><SubmitButton>Adaugă</SubmitButton></div>
      </ActionForm>
    </>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Corp: <span className="font-mono text-xl">{input.label}</span>
        </h1>
        <Link href={`/proiecte/${id}`} className="text-[13px] font-medium text-accent-blue-foreground hover:underline">
          ← Înapoi la proiect
        </Link>
      </div>

      {hasInactiveRefs && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-800">
          <AlertDescription>
            Corpul folosește materiale/feronerie dezactivate — verifică selecturile marcate „(dezactivat)".
          </AlertDescription>
        </Alert>
      )}

      <CabinetEditorForm
        initial={cabinetInputToFormValues(input)}
        snapshot={snapshot}
        laborPct={project.laborPct}
        yieldFactor={project.yieldFactor}
        legHeightMm={legHeightMm}
        bandOptions={{
          carcassFront: optionsWithCurrent(edgeBands, input.edgeBands.carcassFrontEdgeId),
          frontPerimeter: optionsWithCurrent(edgeBands, input.edgeBands.frontPerimeterId),
        }}
        hardwareOverrides={overrides}
        extraParts={extraParts}
        feronerieSlot={feronerieSlot}
        feronerieSummary={feronerieSummary}
        extraPartsSlot={extraPartsSlot}
        extraPartsSummary={extraPartsSummary}
        frontSupplierOptions={frontSupplierOptions}
        frontModelOptions={frontModelOptions}
        ralColors={ralColors}
        projectHandle={{
          type: project.handleType, itemId: project.handleItemId,
          label: HANDLE_TYPE_OPTIONS.find((o) => o.value === project.handleType)?.label ?? project.handleType,
        }}
        hardwareSelOptions={hardwareSelOptions}
        save={updateCabinetData.bind(null, cabinetId)}
      />
    </div>
  );
}
