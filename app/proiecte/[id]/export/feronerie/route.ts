import { loadProject, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  if (!data) return new Response('Proiect inexistent', { status: 404 });
  if (!data.snapshot) return new Response('Proiectul nu are un calcul salvat — apasă „Calculează" întâi.', { status: 400 });
  const { quote, error } = tryComputeQuote(toQuoteInput(data.project, data.cabinets), data.snapshot);
  if (!quote) return new Response(`Eroare de calcul: ${error}`, { status: 400 });
  const csv = ['Denumire;Buc', ...quote.hardwareSummary.map((h) => `${h.name};${h.qty}`)].join('\n') + '\n';
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="feronerie.csv"',
    },
  });
}
