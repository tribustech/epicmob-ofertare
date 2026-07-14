import Link from 'next/link';
import { notFound } from 'next/navigation';
import { legHeightByCabinet, loadProject, toQuoteInput, tryComputeQuote, type LoadedCabinet } from '@/lib/quote/load';
import { getQuoteBasis } from '@/lib/quote/basis';
import { PrintButton } from '@/components/PrintButton';
import { Badge } from '@/components/ui/badge';
import { fmtLei } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  BAZA: 'Corp bază', SUSPENDAT: 'Corp suspendat', INALT: 'Corp înalt',
  COLT: 'Corp de colț',
};

export default async function OfertaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  if (!data) notFound();
  const { project, assemblies, cabinets } = data;

  const basis = await getQuoteBasis(project);
  if (basis.kind === 'MISSING') {
    return (
      <p className="text-sm">
        Proiectul e într-o stare înghețată dar nu are un calcul salvat — <Link href={`/proiecte/${id}`} className="underline">înapoi la proiect</Link> și comută starea pentru a genera un calcul.
      </p>
    );
  }
  const snapshot = basis.snapshot;
  const { quote, error } = tryComputeQuote(toQuoteInput(project, cabinets, legHeightByCabinet(assemblies, cabinets)), snapshot);
  if (!quote) return <p className="text-sm text-red-700">Eroare de calcul: {error}</p>;

  const materialName = (mid: string | null) =>
    mid ? (snapshot.materials.find((m) => m.id === mid)?.name ?? mid) : '—';

  const cabinetsByAssembly = new Map<string, LoadedCabinet[]>();
  for (const c of cabinets) {
    if (!c.assemblyId) continue;
    const list = cabinetsByAssembly.get(c.assemblyId) ?? [];
    list.push(c);
    cabinetsByAssembly.set(c.assemblyId, list);
  }
  const unassigned = cabinets.filter((c) => !c.assemblyId);

  return (
    <div className="mx-auto max-w-2xl space-y-6 bg-white p-6 print:p-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">EpicMob — Ofertă de preț</h1>
          <p className="text-sm text-neutral-600">
            {new Date().toLocaleDateString('ro-RO')} · Proiect: {project.name}
          </p>
          {project.clientName && (
            <p className="text-sm text-neutral-600">Client: {project.clientName} {project.clientContact ? `· ${project.clientContact}` : ''}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {basis.kind === 'LIVE' && (
            <Badge className="print:hidden bg-green-600 text-white hover:bg-green-600">Prețuri live</Badge>
          )}
          {basis.kind === 'FROZEN' && (
            <Badge variant="outline" className="print:hidden border-amber-500 text-amber-700">
              Prețuri înghețate la {new Date(basis.snapshot.takenAt).toLocaleDateString('ro-RO')}
            </Badge>
          )}
          <PrintButton />
        </div>
      </div>

      {assemblies.map((a) => {
        const assemblyCabinets = cabinetsByAssembly.get(a.id) ?? [];
        if (assemblyCabinets.length === 0) return null;
        return (
          <div key={a.id} className="space-y-2">
            <h2 className="text-sm font-semibold">{a.name}</h2>
            <CabinetsTable cabinets={assemblyCabinets} materialName={materialName} />
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Alte corpuri</h2>
          <CabinetsTable cabinets={unassigned} materialName={materialName} />
        </div>
      )}

      <div className="rounded border p-4 text-right">
        <div className="text-sm text-neutral-600">Preț total (materiale, feronerie, manoperă și montaj incluse)</div>
        <div className="text-3xl font-bold">{fmtLei(quote.costs.sellPrice)}</div>
      </div>

      <p className="text-xs text-neutral-500">
        Ofertă valabilă 30 de zile de la data emiterii. Execuție și montaj asumate prin contract.
        EpicMob · contact@epicmob.ro · +40 750 402 027
      </p>
    </div>
  );
}

function CabinetsTable({ cabinets, materialName }: { cabinets: LoadedCabinet[]; materialName: (mid: string | null) => string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-neutral-600">
          <th className="py-1">Corp</th><th>Tip</th><th>Dimensiuni (L×H×A mm)</th><th>Fronturi</th>
        </tr>
      </thead>
      <tbody>
        {cabinets.map((c) => (
          <tr key={c.id} className="border-b last:border-0">
            <td className="py-1">{c.input.label}</td>
            <td>{TYPE_LABELS[c.input.type] ?? c.input.type}</td>
            <td>{c.input.widthMm} × {c.input.heightMm} × {c.input.depthMm}</td>
            <td>{materialName(c.input.frontMaterialId)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
