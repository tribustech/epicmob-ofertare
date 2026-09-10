import Link from 'next/link';
import { notFound } from 'next/navigation';
import { legHeightByCabinet, loadQuote, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';
import { getQuoteBasis } from '@/lib/quote/basis';
import { CuttingLayoutSvg } from '@/components/CuttingLayoutSvg';
import { PrintButton } from '@/components/PrintButton';
import { fmtNum } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PlanDebitarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadQuote(id);
  if (!data) notFound();
  const { quote: quoteRow, assemblies, cabinets } = data;

  const basis = await getQuoteBasis(quoteRow);
  if (basis.kind === 'MISSING') {
    return (
      <p className="text-sm">
        Proiectul e într-o stare înghețată dar nu are un calcul salvat — <Link href={`/oferte/${id}`} className="underline">înapoi la proiect</Link>.
      </p>
    );
  }
  const snapshot = basis.snapshot;
  const { quote, error } = tryComputeQuote(toQuoteInput(quoteRow, cabinets, legHeightByCabinet(assemblies, cabinets), assemblies), snapshot);
  if (!quote) return <p className="text-sm text-red-700">Eroare de calcul: {error}</p>;

  const nested = quote.costs.needs.boards.filter((b) => b.layout !== null);

  return (
    <div className="mx-auto max-w-4xl space-y-8 bg-white p-6 print:p-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan debitare — {quoteRow.name}</h1>
          <p className="text-sm text-neutral-600">{new Date().toLocaleDateString('ro-RO')} · doar materialele la placă; cele la m² nu se optimizează</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
          <Link href={`/oferte/${id}`} className="text-sm underline">Înapoi la proiect</Link>
        </div>
      </div>

      {nested.length === 0 && <p className="text-sm">Niciun material la placă în acest proiect.</p>}

      {nested.map((b) => {
        const material = snapshot.materials.find((m) => m.id === b.materialId);
        const name = material?.name ?? b.materialId;
        return (
          <section key={b.materialId} className="space-y-4 break-inside-avoid">
            <h2 className="font-semibold">
              {name} — {b.sheets} {b.sheets === 1 ? 'placă' : 'plăci'} ({material?.sheetLengthMm}×{material?.sheetWidthMm} mm) · pierdere {fmtNum(b.wastePct ?? 0, 1)}%
            </h2>
            {b.layout!.map((sheet, i) => (
              <figure key={i} className="space-y-1 break-inside-avoid">
                <figcaption className="text-xs text-neutral-600">Placa {i + 1} din {b.sheets}</figcaption>
                <CuttingLayoutSvg layout={sheet} sheetLengthMm={material?.sheetLengthMm ?? 2800} sheetWidthMm={material?.sheetWidthMm ?? 2070} patternId={`rest-${b.materialId}-${i}`} />
              </figure>
            ))}
          </section>
        );
      })}
    </div>
  );
}
