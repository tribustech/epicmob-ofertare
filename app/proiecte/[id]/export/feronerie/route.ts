import { legHeightByCabinet, loadProject, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';
import { getQuoteBasis } from '@/lib/quote/basis';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  if (!data) return new Response('Proiect inexistent', { status: 404 });
  const basis = await getQuoteBasis(data.project);
  if (basis.kind === 'MISSING') return new Response('Proiectul e într-o stare înghețată fără calcul salvat — comută starea.', { status: 400 });
  const { quote, error } = tryComputeQuote(
    toQuoteInput(data.project, data.cabinets, legHeightByCabinet(data.assemblies, data.cabinets), data.assemblies),
    basis.snapshot,
  );
  if (!quote) return new Response(`Eroare de calcul: ${error}`, { status: 400 });
  const csv = ['Denumire;Buc', ...quote.hardwareSummary.map((h) => `${h.name};${h.qty}`)].join('\n') + '\n';
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="feronerie.csv"',
    },
  });
}
