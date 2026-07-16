import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { createCabinet } from '@/lib/quote/actions';
import { HANDLE_TYPE_OPTIONS } from '@/lib/quote/handle';
import { buildHardwareSelOptions, loadCorpEditorData, optionsWithCurrent } from '@/lib/quote/corp-editor-data';
import { CabinetEditorForm } from '@/components/CabinetEditorForm';

export const dynamic = 'force-dynamic';

// Doar alegerile structurale sunt precompletate — dimensiunile și materialele
// pornesc goale, ca să nu intre în ofertă valori pe care nu le-a ales nimeni.
function emptyFormValues(label: string): Record<string, string> {
  return {
    label,
    type: 'BAZA',
    frontType: 'USI',
    withShelves: 'true',
    widthMm: '', heightMm: '', depthMm: '',
    shelves: '1', doors: '1',
    carcassMaterialId: '',
    frontKind: 'PAL',
    frontMaterialId: '',
    mdfSupplierId: '', mdfModelId: '', mdfFinish: 'MAT', mdfFaces: '1', mdfRalCode: '', mdfColorCategory: 'NORMALA',
    backEnabled: 'true', backMaterialId: '', backMount: 'FALT',
    carcassFrontEdgeId: '', frontPerimeterId: '',
    blindPanelWidthMm: '',
    drawersCount: '0', drawersSystem: 'TANDEMBOX', drawersBottomMaterialId: '', drawerFrontHeightsMm: '',
    mountTop: 'INCADRAT', mountBottom: 'INCADRAT',
    hingeId: '', slideId: '', tandemboxHeightMm: '',
    handleMode: 'PROIECT', handleType: 'APLICAT', handleItemId: '', frontExtensionMm: '',
  };
}

export default async function CorpNouPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ansamblu?: string }>;
}) {
  const [{ id }, { ansamblu }] = await Promise.all([params, searchParams]);
  if (!ansamblu) notFound();
  const assembly = await prisma.assembly.findUnique({ where: { id: ansamblu } });
  if (!assembly || assembly.projectId !== id) notFound();

  const [editorData, count] = await Promise.all([
    loadCorpEditorData(id),
    prisma.cabinet.count({ where: { projectId: id } }),
  ]);
  const {
    project, edgeBands, settings, hardwareItems, snapshot,
    frontSupplierOptions, frontModelOptions, ralColors,
  } = editorData;

  const afterSaveNote = (
    <p className="text-sm text-muted-foreground">Disponibil după salvarea corpului.</p>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Corp nou <span className="font-normal text-muted-foreground">· {assembly.name}</span>
        </h1>
        <Link href={`/proiecte/${id}`} className="text-[13px] font-medium text-accent-blue-foreground hover:underline">
          ← Înapoi la proiect
        </Link>
      </div>

      <CabinetEditorForm
        initial={emptyFormValues(`C${count + 1}`)}
        snapshot={snapshot}
        laborPct={project.laborPct}
        yieldFactor={project.yieldFactor}
        legHeightMm={assembly.legHeightMm}
        bandOptions={{
          carcassFront: optionsWithCurrent(edgeBands, undefined),
          frontPerimeter: optionsWithCurrent(edgeBands, undefined),
        }}
        hardwareOverrides={null}
        extraParts={[]}
        feronerieSlot={afterSaveNote}
        feronerieSummary="Disponibil după salvare"
        extraPartsSlot={afterSaveNote}
        extraPartsSummary="Disponibil după salvare"
        frontSupplierOptions={frontSupplierOptions}
        frontModelOptions={frontModelOptions}
        ralColors={ralColors}
        projectHandle={{
          type: project.handleType, itemId: project.handleItemId,
          label: HANDLE_TYPE_OPTIONS.find((o) => o.value === project.handleType)?.label ?? project.handleType,
        }}
        hardwareSelOptions={buildHardwareSelOptions(hardwareItems, settings)}
        save={createCabinet.bind(null, id, assembly.id)}
      />
    </div>
  );
}
