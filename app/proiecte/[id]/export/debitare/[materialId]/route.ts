import { legHeightByCabinet, loadProject, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';
import { getQuoteBasis } from '@/lib/quote/basis';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> },
) {
  const { id, materialId } = await params;
  const data = await loadProject(id);
  if (!data) return new Response('Proiect inexistent', { status: 404 });
  const basis = await getQuoteBasis(data.project);
  if (basis.kind === 'MISSING') return new Response('Proiectul e într-o stare înghețată fără calcul salvat — comută starea.', { status: 400 });
  const { quote, error } = tryComputeQuote(
    toQuoteInput(data.project, data.cabinets, legHeightByCabinet(data.assemblies, data.cabinets), data.assemblies),
    basis.snapshot,
  );
  if (!quote) return new Response(`Eroare de calcul: ${error}`, { status: 400 });
  const glassFile = quote.glassFrontList.find((f) => f.materialId === materialId);
  const glassShelfFile = quote.glassShelfList.find((f) => f.materialId === materialId);
  const file = quote.cutList.find((f) => f.materialId === materialId) ?? glassFile ?? glassShelfFile;
  if (!file) return new Response('Material fără piese în acest proiect', { status: 404 });
  return new Response('﻿' + file.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${glassFile ? 'fronturi-sticla' : glassShelfFile ? 'polite-sticla' : 'debitare'}-${materialId}.csv"`,
    },
  });
}
