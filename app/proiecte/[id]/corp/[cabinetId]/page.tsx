import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import type { CabinetInput } from '@/lib/engine';
import { addExtraPart, removeExtraPart, updateBlat, updateCabinetData } from '@/lib/quote/actions';
import { normalizeCabinetInput } from '@/lib/quote/normalize-input';
import { normalizeHardwareJson } from '@/lib/quote/hardware-adjustments';
import type { ExtraPart } from '@/lib/quote/cabinet-form';
import { HANDLE_TYPE_OPTIONS } from '@/lib/quote/handle';
import { buildHardwareSelOptions, loadCorpEditorData, optionsWithCurrent } from '@/lib/quote/corp-editor-data';
import { CabinetEditorForm } from '@/components/CabinetEditorForm';
import { BlatEditorForm, type BlatMaterialOption } from '@/components/BlatEditorForm';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtNum } from '@/lib/format';

export const dynamic = 'force-dynamic';

function isInactiveId(rows: { id: string; active: boolean }[], id: string | null | undefined): boolean {
  return !!id && rows.some((r) => r.id === id && !r.active);
}

function cabinetInputToFormValues(input: CabinetInput): Record<string, string> {
  const frontType = input.drawers && input.drawers.count > 0 ? 'SERTARE' : input.doors > 0 ? 'USI' : 'FARA';
  return {
    label: input.label,
    type: input.type,
    frontType,
    withShelves: input.shelves > 0 ? 'true' : 'false',
    // corpul abia creat are dimensiuni 0 — câmpurile pornesc goale, nu cu „0"
    widthMm: input.widthMm ? String(input.widthMm) : '',
    heightMm: input.heightMm ? String(input.heightMm) : '',
    depthMm: input.depthMm ? String(input.depthMm) : '',
    // chiuvetă (uși, 0 polițe): câmpul pornește de la 1 ca bifarea „Cu polițe" să aibă o valoare;
    // la FARA păstrăm 0 real (etajera fără polițe rămâne fără)
    shelves: String(input.shelves > 0 ? input.shelves : input.doors > 0 ? 1 : 0),
    shelfMaterialId: input.shelf?.materialId ?? '',
    shelfDecorMatters: input.shelf?.decorAxis ? 'true' : 'false',
    shelfDecorAxis: input.shelf?.decorAxis ?? 'LR',
    doors: String(Math.max(input.doors, 1)),
    doorOpening: input.doorOpening ?? 'BALAMALE',
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
    tandemboxHeightMm: input.hardwareSel?.tandemboxHeightMm != null ? String(input.hardwareSel.tandemboxHeightMm) : '',
    handleMode: input.handle ? 'CUSTOM' : 'PROIECT',
    handleType: input.handle?.type ?? 'APLICAT',
    frontExtensionMm: input.handle?.frontExtensionMm != null ? String(input.handle.frontExtensionMm) : '',
  };
}

export default async function CorpPage({ params }: { params: Promise<{ id: string; cabinetId: string }> }) {
  const { id, cabinetId } = await params;
  const cab = await prisma.cabinet.findUnique({ where: { id: cabinetId } });
  if (!cab || cab.projectId !== id) notFound();
  const input = normalizeCabinetInput(JSON.parse(cab.inputJson));
  const hardwareAdjustments = normalizeHardwareJson(cab.hardwareJson);

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

  // Blatul are editor propriu, minimal — nu trece prin CabinetEditorForm.
  if (input.type === 'BLAT') {
    // păstrăm materialele inactive în listă doar dacă sunt selectate (MaterialPicker filtrează activele)
    const blatMaterials: BlatMaterialOption[] = materials
      .filter((m) => m.category === 'BLAT' && (m.active || m.id === input.blat?.materialId))
      .map((m) => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
        thicknessMm: m.thicknessMm,
        brand: m.brand,
        category: m.category,
        imageUrl: m.imageUrl,
        decorCode: m.decorCode,
        pricePerSheet: m.pricePerSheet,
        pricePerSqm: m.pricePerSqm,
        pricingMode: m.pricingMode,
        active: m.active,
        sheetLengthMm: m.sheetLengthMm,
        sheetWidthMm: m.sheetWidthMm,
      }));
    return (
      <div className="space-y-5">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            Blat: <span className="font-mono text-xl">{input.label}</span>
          </h1>
          <Link href={`/proiecte/${id}`} className="text-[13px] font-medium text-accent-blue-foreground hover:underline">
            ← Înapoi la proiect
          </Link>
        </div>
        <Card>
          <CardHeader><CardTitle>Configurare blat</CardTitle></CardHeader>
          <CardContent>
            <BlatEditorForm
              initial={{
                label: input.label,
                widthMm: input.widthMm ? String(input.widthMm) : '',
                depthMm: input.depthMm ? String(input.depthMm) : '',
                blatMaterialId: input.blat?.materialId ?? '',
                manualPieces: input.blat?.manualPieces != null ? String(input.blat.manualPieces) : '',
              }}
              materials={blatMaterials}
              cutPricePerPiece={settings?.blatCutPricePerPiece ?? 35}
              save={updateBlat.bind(null, cabinetId)}
            />
          </CardContent>
        </Card>
      </div>
    );
  }
  const extraParts = JSON.parse(cab.extraPartsJson) as ExtraPart[];
  const { tandemboxHeights } = buildHardwareSelOptions(hardwareItems, settings);

  const adjustedItemIds = [
    ...Object.values(hardwareAdjustments?.slots ?? {}).map((a) => a?.itemId),
    ...(hardwareAdjustments?.extra ?? []).map((l) => l.hardwareId),
  ];
  const hasInactiveRefs =
    isInactiveId(materials, input.carcassMaterialId) ||
    isInactiveId(materials, input.frontMaterialId) ||
    isInactiveId(materials, input.back.materialId) ||
    isInactiveId(materials, input.drawers?.bottomMaterialId) ||
    isInactiveId(edgeBands, input.edgeBands.carcassFrontEdgeId) ||
    isInactiveId(edgeBands, input.edgeBands.frontPerimeterId) ||
    adjustedItemIds.some((hid) => isInactiveId(hardwareItems, hid));

  const extraPartsSummary = extraParts.length === 0
    ? 'Nicio piesă suplimentară'
    : `${extraParts.length} ${extraParts.length === 1 ? 'piesă' : 'piese'}`;

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
    <div className="xl:relative xl:left-1/2 xl:w-[min(1800px,calc(100vw-3rem))] xl:-translate-x-1/2">
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
          hardwareAdjustments={hardwareAdjustments}
          extraParts={extraParts}
          extraPartsSlot={extraPartsSlot}
          extraPartsSummary={extraPartsSummary}
          frontSupplierOptions={frontSupplierOptions}
          frontModelOptions={frontModelOptions}
          ralColors={ralColors}
          projectHandle={{
            type: project.handleType, itemId: project.handleItemId,
            label: HANDLE_TYPE_OPTIONS.find((o) => o.value === project.handleType)?.label ?? project.handleType,
          }}
          tandemboxHeights={tandemboxHeights}
          initialPieces={input.pieces}
          save={updateCabinetData.bind(null, cabinetId)}
        />
      </div>
    </div>
  );
}
