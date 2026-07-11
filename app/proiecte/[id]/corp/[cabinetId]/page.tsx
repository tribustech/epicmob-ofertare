import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { buildHardwareDefaults, parseConstruction, toCostCatalogs } from '@/lib/catalog/convert';
import { expandCabinet, resolveSuggestions, type CabinetInput, type ExpandedCabinet, type HardwareLine } from '@/lib/engine';
import { addExtraPart, removeExtraPart, resetCabinetHardware, saveCabinetHardware, updateCabinet } from '@/lib/quote/actions';
import type { ExtraPart } from '@/lib/quote/cabinet-form';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { fmtNum } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TYPE_OPTIONS = [
  { value: 'BAZA', label: 'Corp bază' },
  { value: 'SUSPENDAT', label: 'Corp suspendat' },
  { value: 'INALT', label: 'Corp înalt' },
  { value: 'SERTARE', label: 'Corp cu sertare' },
  { value: 'COLT', label: 'Corp de colț' },
];

export default async function CorpPage({ params }: { params: Promise<{ id: string; cabinetId: string }> }) {
  const { id, cabinetId } = await params;
  const cab = await prisma.cabinet.findUnique({ where: { id: cabinetId } });
  if (!cab || cab.projectId !== id) notFound();
  const input = JSON.parse(cab.inputJson) as CabinetInput;

  const [materials, edgeBands, settings] = await Promise.all([
    prisma.material.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.edgeBand.findMany({ where: { active: true }, orderBy: { thicknessMm: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const materialOptions = materials.map((m) => ({ value: m.id, label: m.name }));
  const bandOptions = edgeBands.map((e) => ({ value: e.id, label: e.name }));
  const materialName = (mid: string) => materials.find((m) => m.id === mid)?.name ?? mid;
  const bandName = (bid?: string) => (bid ? (edgeBands.find((e) => e.id === bid)?.name ?? bid) : '');

  const hardwareItems = await prisma.hardwareItem.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  const hardwareOptions = hardwareItems.map((h) => ({ value: h.id, label: `${h.name} (${h.pricePerUnit} lei)` }));
  const hardwareName = (hid: string) => hardwareItems.find((h) => h.id === hid)?.name ?? hid;
  const overrides = cab.hardwareJson ? (JSON.parse(cab.hardwareJson) as HardwareLine[]) : null;
  const extraParts = JSON.parse(cab.extraPartsJson) as ExtraPart[];

  let expanded: ExpandedCabinet | null = null;
  let expandError: string | null = null;
  try {
    const catalogs = toCostCatalogs(
      materials.map((m) => m),
      edgeBands.map((e) => e),
      [],
      [],
      [
        { cabinetType: 'BAZA', price: 0 }, { cabinetType: 'SUSPENDAT', price: 0 },
        { cabinetType: 'INALT', price: 0 }, { cabinetType: 'SERTARE', price: 0 },
        { cabinetType: 'COLT', price: 0 },
      ],
    );
    const cc = parseConstruction(settings?.constructionJson ?? '{}');
    expanded = expandCabinet(input, catalogs, cc);
  } catch (e) {
    expandError = e instanceof Error ? e.message : 'Eroare la generarea pieselor';
  }

  let suggestedLines: HardwareLine[] = [];
  if (expanded && settings) {
    const defaults = buildHardwareDefaults(hardwareItems, settings);
    suggestedLines = resolveSuggestions(expanded.hardware, defaults).lines;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Corp: {input.label}</h1>
        <Link href={`/proiecte/${id}`} className="text-sm text-neutral-600 hover:underline">← Înapoi la proiect</Link>
      </div>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Dimensiuni și opțiuni</h2>
        <p className="mb-3 text-sm text-neutral-600">
          Câmpurile de sertare contează doar la tipul „Corp cu sertare"; panoul orb doar la „Corp de colț". Salvează pentru a regenera piesele.
        </p>
        <ActionForm action={updateCabinet.bind(null, cabinetId)} className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <TextInput name="label" label="Etichetă" defaultValue={input.label} />
            <Select name="type" label="Tip corp" options={TYPE_OPTIONS} defaultValue={input.type} />
            <NumberInput name="widthMm" label="Lățime L (mm)" defaultValue={input.widthMm} step="1" />
            <NumberInput name="heightMm" label="Înălțime H (mm)" defaultValue={input.heightMm} step="1" />
            <NumberInput name="depthMm" label="Adâncime A (mm)" defaultValue={input.depthMm} step="1" />
            <NumberInput name="shelves" label="Polițe" defaultValue={input.shelves} step="1" />
            <NumberInput name="doors" label="Uși" defaultValue={input.doors} step="1" />
            <Select name="carcassMaterialId" label="Material carcasă" options={materialOptions} defaultValue={input.carcassMaterialId} />
            <Select name="frontMaterialId" label="Material fronturi" options={materialOptions} defaultValue={input.frontMaterialId} allowEmpty />
            <Select name="carcassFrontEdgeId" label="Cant carcasă" options={bandOptions} defaultValue={input.edgeBands.carcassFrontEdgeId} />
            <Select name="frontPerimeterId" label="Cant fronturi" options={bandOptions} defaultValue={input.edgeBands.frontPerimeterId} allowEmpty />
            <NumberInput name="blindPanelWidthMm" label="Panou orb (mm, colț)" defaultValue={input.blindPanelWidthMm ?? null} required={false} step="1" />
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="backEnabled" defaultChecked={input.back.enabled} />
              <span>Cu spate</span>
            </label>
            <Select name="backMaterialId" label="Material spate" options={materialOptions} defaultValue={input.back.materialId} allowEmpty />
            <Select
              name="backMount" label="Montaj spate"
              options={[{ value: 'FALT', label: 'În falț' }, { value: 'APLICAT', label: 'Aplicat' }]}
              defaultValue={input.back.mount}
            />
            <NumberInput name="drawersCount" label="Nr. sertare" defaultValue={input.drawers?.count ?? 0} step="1" />
            <Select
              name="drawersSystem" label="Sistem sertare"
              options={[{ value: 'METAL_BOX', label: 'Blum (laterale metalice)' }, { value: 'PAL_BOX', label: 'Cutie din PAL' }]}
              defaultValue={input.drawers?.system ?? 'METAL_BOX'}
            />
            <Select name="drawersBottomMaterialId" label="Fund sertare" options={materialOptions} defaultValue={input.drawers?.bottomMaterialId} allowEmpty />
            <div className="col-span-2">
              <TextInput
                name="drawerFrontHeightsMm" label="Înălțimi fronturi sertar (mm, cu virgulă; gol = egale)"
                defaultValue={input.drawers?.frontHeightsMm?.join(', ') ?? ''} required={false}
              />
            </div>
          </div>

          <SubmitButton>Salvează corpul</SubmitButton>
        </ActionForm>
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Piese generate</h2>
        {expandError && <p className="rounded bg-red-50 px-2 py-1 text-sm text-red-700">{expandError}</p>}
        {expanded && (
          <>
            {expanded.warnings.length > 0 && (
              <ul className="mb-2 space-y-1">
                {expanded.warnings.map((w, i) => (
                  <li key={i} className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">⚠ {w.message}</li>
                ))}
              </ul>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-neutral-600">
                  <th className="py-1">Piesă</th><th>Dimensiuni (mm)</th><th>Buc</th><th>Material</th><th>Canturi</th>
                </tr>
              </thead>
              <tbody>
                {expanded.parts.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1">{p.name}</td>
                    <td>{fmtNum(p.lengthMm, 1)} × {fmtNum(p.widthMm, 1)}</td>
                    <td>{p.qty}</td>
                    <td>{materialName(p.materialId)}</td>
                    <td className="text-neutral-500">
                      {[p.edges.l1, p.edges.l2, p.edges.w1, p.edges.w2].filter(Boolean).map((b) => bandName(b)).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Feronerie</h2>
        {overrides === null ? (
          <>
            <p className="mb-2 text-sm text-neutral-600">
              Sugestii automate (se recalculează la fiecare salvare a corpului). Preia-le în editor doar dacă vrei să le modifici.
            </p>
            <ul className="mb-3 space-y-1 text-sm">
              {suggestedLines.map((l) => (
                <li key={l.hardwareId}>{l.qty} × {hardwareName(l.hardwareId)}</li>
              ))}
              {suggestedLines.length === 0 && <li className="text-neutral-500">Nicio sugestie (corp fără fronturi/sertare).</li>}
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
            <p className="mb-2 text-sm text-neutral-600">
              Feronerie editată manual — sugestiile automate nu se mai aplică acestui corp. Cantitate 0 = rândul dispare la salvare.
            </p>
            <ActionForm action={saveCabinetHardware.bind(null, cabinetId)} className="space-y-2">
              {overrides.map((l, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="col-span-2">
                    <Select name="hardwareId" label="Produs" options={hardwareOptions} defaultValue={l.hardwareId} />
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
                <button type="submit" className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-50">
                  Revino la sugestiile automate
                </button>
              </ActionForm>
            </div>
          </>
        )}
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Piese suplimentare</h2>
        <ul className="mb-3 space-y-2">
          {extraParts.map((p, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span className="grow">{p.name} — {fmtNum(p.lengthMm, 1)} × {fmtNum(p.widthMm, 1)} mm × {p.qty} buc ({materialName(p.materialId)})</span>
              <DeleteButton action={removeExtraPart.bind(null, cabinetId, i)} label="Șterge" />
            </li>
          ))}
          {extraParts.length === 0 && <li className="text-sm text-neutral-500">Nicio piesă suplimentară.</li>}
        </ul>
        <ActionForm action={addExtraPart.bind(null, cabinetId)} className="grid grid-cols-2 items-end gap-2 md:grid-cols-6">
          <TextInput name="name" label="Denumire" />
          <NumberInput name="lengthMm" label="Lungime (mm)" step="1" />
          <NumberInput name="widthMm" label="Lățime (mm)" step="1" />
          <NumberInput name="qty" label="Buc" defaultValue={1} step="1" />
          <Select name="materialId" label="Material" options={materialOptions} />
          <div><SubmitButton>Adaugă</SubmitButton></div>
        </ActionForm>
      </section>
    </div>
  );
}
