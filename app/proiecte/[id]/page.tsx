import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadProject, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';
import {
  addCabinet, addFreeLine, deleteCabinet, deleteProject, duplicateCabinet,
  recalculateProject, removeFreeLine, updateProjectSettings,
} from '@/lib/quote/actions';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { fmtLei, fmtNum } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  BAZA: 'Bază', SUSPENDAT: 'Suspendat', INALT: 'Înalt', SERTARE: 'Sertare', COLT: 'Colț',
};
const STATUS_OPTIONS = [
  { value: 'CIORNA', label: 'Ciornă' },
  { value: 'TRIMISA', label: 'Trimisă' },
  { value: 'ACCEPTATA', label: 'Acceptată' },
];
const CATEGORY_LABELS: [key: string, label: string][] = [
  ['boards', 'Plăci'], ['edging', 'Cant ABS'], ['cuttingService', 'Debitare'],
  ['hardware', 'Feronerie'], ['labor', 'Manoperă'], ['freeLines', 'Linii libere'],
];

export default async function ProiectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  if (!data) notFound();
  const { project, cabinets, snapshot } = data;
  const freeLines = JSON.parse(project.freeLinesJson) as { name: string; amount: number }[];

  const computed = snapshot ? tryComputeQuote(toQuoteInput(project, cabinets), snapshot) : null;
  const quote = computed?.quote ?? null;
  const materialName = (mid: string) =>
    snapshot?.materials.find((m) => m.id === mid)?.name ?? mid;
  const bandLabel = (bid: string) =>
    snapshot?.edgeBands.find((b) => b.id === bid)?.name ?? bid;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{project.name}</h1>
          <p className="text-sm text-neutral-600">{project.clientName ?? 'Fără client'} {project.clientContact ? `· ${project.clientContact}` : ''}</p>
        </div>
        <DeleteButton action={deleteProject.bind(null, project.id)} label="Șterge proiectul" />
      </div>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Setările proiectului</h2>
        <ActionForm action={updateProjectSettings.bind(null, project.id)} className="grid grid-cols-2 items-end gap-2 md:grid-cols-4">
          <NumberInput name="markupPct" label="Adaos (%)" defaultValue={project.markupPct} />
          <NumberInput name="yieldFactor" label="Factor utilizare foaie" defaultValue={project.yieldFactor} step="0.01" />
          <Select name="status" label="Stare" options={STATUS_OPTIONS} defaultValue={project.status} />
          <div><SubmitButton>Salvează</SubmitButton></div>
        </ActionForm>
      </section>

      <section className="rounded border bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Corpuri</h2>
          <ActionForm action={addCabinet.bind(null, project.id)}>
            <SubmitButton>Adaugă corp</SubmitButton>
          </ActionForm>
        </div>
        <ul className="space-y-2">
          {cabinets.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded border p-2 text-sm">
              <span className="grow">
                <Link href={`/proiecte/${project.id}/corp/${c.id}`} className="font-medium hover:underline">{c.input.label}</Link>
                {' '}— {TYPE_LABELS[c.input.type] ?? c.input.type} · {c.input.widthMm}×{c.input.heightMm}×{c.input.depthMm} mm
                {c.hardwareOverrides ? ' · feronerie editată' : ''}
              </span>
              <ActionForm action={duplicateCabinet.bind(null, c.id)}>
                <button type="submit" className="rounded border px-3 py-1.5 hover:bg-neutral-50">Duplică</button>
              </ActionForm>
              <DeleteButton action={deleteCabinet.bind(null, c.id)} />
            </li>
          ))}
          {cabinets.length === 0 && <li className="text-neutral-500">Niciun corp — adaugă primul.</li>}
        </ul>
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Linii libere (blat, transport…)</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {freeLines.map((l, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="grow">{l.name} — {fmtLei(l.amount)}</span>
              <DeleteButton action={removeFreeLine.bind(null, project.id, i)} label="Șterge" />
            </li>
          ))}
          {freeLines.length === 0 && <li className="text-neutral-500">Nicio linie liberă.</li>}
        </ul>
        <ActionForm action={addFreeLine.bind(null, project.id)} className="grid grid-cols-2 items-end gap-2 md:grid-cols-4">
          <TextInput name="name" label="Denumire" />
          <NumberInput name="amount" label="Suma (lei)" />
          <div><SubmitButton>Adaugă</SubmitButton></div>
        </ActionForm>
      </section>

      <section className="rounded border bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Calcul și ofertă</h2>
          <ActionForm action={recalculateProject.bind(null, project.id)}>
            <SubmitButton>{snapshot ? 'Recalculează cu prețurile curente' : 'Calculează'}</SubmitButton>
          </ActionForm>
        </div>

        {!snapshot && <p className="text-sm text-neutral-600">Apasă „Calculează" pentru a copia prețurile curente în proiect și a vedea rezumatul.</p>}
        {computed?.error && <p className="rounded bg-red-50 px-2 py-1 text-sm text-red-700">{computed.error}</p>}

        {quote && snapshot && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500">Prețuri copiate la: {new Date(snapshot.takenAt).toLocaleString('ro-RO')}</p>

            {quote.warnings.length > 0 && (
              <ul className="space-y-1">
                {quote.warnings.map((w, i) => (
                  <li key={i} className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">⚠ {w.cabinetLabel ? `${w.cabinetLabel}: ` : ''}{w.message}</li>
                ))}
              </ul>
            )}
            {quote.unresolvedHardware.length > 0 && (
              <ul className="space-y-1">
                {quote.unresolvedHardware.map((s, i) => (
                  <li key={i} className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">
                    ⚠ Feronerie fără produs implicit: {s.name} × {s.qty} — setează implicitul în Setări sau editează feroneria corpului.
                  </li>
                ))}
              </ul>
            )}

            <table className="w-full max-w-md text-sm">
              <tbody>
                {CATEGORY_LABELS.map(([key, label]) => (
                  <tr key={key} className="border-b">
                    <td className="py-1 text-neutral-600">{label}</td>
                    <td className="text-right">{fmtLei(quote.costs.breakdown[key as keyof typeof quote.costs.breakdown])}</td>
                  </tr>
                ))}
                <tr className="border-b font-medium">
                  <td className="py-1">Cost total</td>
                  <td className="text-right">{fmtLei(quote.costs.totalCost)}</td>
                </tr>
                <tr className="text-lg font-bold">
                  <td className="py-1">Preț de vânzare (adaos {fmtNum(project.markupPct)}%)</td>
                  <td className="text-right">{fmtLei(quote.costs.sellPrice)}</td>
                </tr>
                {quote.costs.leiPerMl !== null && (
                  <tr className="text-sm text-neutral-500">
                    <td className="py-1">Echivalent lei/ml corpuri de bază</td>
                    <td className="text-right">{fmtNum(quote.costs.leiPerMl, 0)} lei/ml</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div>
              <h3 className="mb-1 font-medium">Necesar de materiale</h3>
              <ul className="text-sm">
                {quote.costs.needs.boards.map((b) => (
                  <li key={b.materialId}>
                    {materialName(b.materialId)}: {fmtNum(b.totalAreaSqm)} m²{b.sheets !== null ? ` → ${b.sheets} foi` : ' (la m²)'}
                  </li>
                ))}
                {quote.costs.needs.edging.map((e) => (
                  <li key={e.edgeBandId}>{bandLabel(e.edgeBandId)}: {fmtNum(e.totalMl)} ml</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-1 font-medium">Listă feronerie</h3>
              <ul className="text-sm">
                {quote.hardwareSummary.map((h) => (
                  <li key={h.name}>{h.qty} × {h.name}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/proiecte/${project.id}/oferta`} className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white">
                Ofertă pentru client (print/PDF)
              </Link>
              {quote.cutList.map((f) => (
                <a key={f.materialId} href={`/proiecte/${project.id}/export/debitare/${f.materialId}`} className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-50">
                  CSV debitare: {f.materialName}
                </a>
              ))}
              <a href={`/proiecte/${project.id}/export/feronerie`} className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-50">
                CSV feronerie
              </a>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
