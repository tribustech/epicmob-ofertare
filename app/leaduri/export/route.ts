import { prisma } from '@/lib/db';

/** Export CSV al clienților marcați remarketing (nume, telefon, email, sursă, ce vrea, buget, notă). */
export async function GET() {
  const rows = await prisma.client.findMany({ where: { remarketing: true }, orderBy: { name: 'asc' } });
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Nume', 'Telefon', 'Email', 'Sursă', 'Ce vrea', 'Buget', 'Notă remarketing'];
  const lines = rows.map((c) =>
    [c.name, c.phone, c.email, c.source, c.wants, c.budgetEstimate?.toString(), c.remarketingNote].map(esc).join(';'),
  );
  const csv = '﻿' + [header.join(';'), ...lines].join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="remarketing.csv"',
    },
  });
}
