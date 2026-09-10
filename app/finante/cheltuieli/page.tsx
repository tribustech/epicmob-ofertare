import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { fmtDate } from '@/lib/crm/dates';
import { DOCUMENT_KIND_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_PILL, type DocumentKind, type PaymentStatus } from '@/lib/finance/constants';
import { loadDocument, loadExpenseFormOptions, loadExpenses } from '@/lib/finance/document-queries';
import { createExpense } from '@/lib/finance/document-actions';
import { monthKey, monthLabel, recentMonthKeys } from '@/lib/finance/month';
import { SidePanel } from '@/components/SidePanel';
import { LinkRow } from '@/components/crm/LinkRow';
import { ParamSelect } from '@/components/crm/ParamSelect';
import { EmptyState, tableWrapCls, tdCls, thCls } from '@/components/crm/ui';
import { ExpenseForm } from '@/components/finance/ExpenseForm';
import { DocumentPanel } from '@/components/finance/DocumentPanel';
import { DocumentSheet } from '@/components/finance/DocumentSheet';

export const dynamic = 'force-dynamic';

type SP = { luna?: string; status?: string; categorie?: string; proiect?: string; nealocate?: string; doc?: string };

export default async function CheltuieliPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const luna = sp.luna || monthKey();
  const status = (['NEPLATIT', 'PARTIAL', 'PLATIT'].includes(sp.status ?? '') ? sp.status : '') as PaymentStatus | '';
  const [rows, options, doc] = await Promise.all([
    loadExpenses({ luna, status, categoryId: sp.categorie || undefined, projectId: sp.proiect || undefined, nealocate: sp.nealocate === '1' }),
    loadExpenseFormOptions(),
    sp.doc ? loadDocument(sp.doc) : Promise.resolve(null),
  ]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const unpaid = rows.reduce((s, r) => s + r.remaining, 0);

  // link-urile păstrează filtrele curente
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && k !== 'doc') qs.set(k, v);
  const base = `/finante/cheltuieli${qs.toString() ? `?${qs}` : ''}`;
  const withDoc = (id: string) => `${base}${qs.toString() ? '&' : '?'}doc=${id}`;
  const toggleNealocate = () => { const q = new URLSearchParams(qs); if (sp.nealocate === '1') q.delete('nealocate'); else q.set('nealocate', '1'); return `/finante/cheltuieli${q.toString() ? `?${q}` : ''}`; };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ParamSelect param="luna" options={[{ value: 'toate', label: 'Toate lunile' }, ...recentMonthKeys(18).map((k) => ({ value: k, label: monthLabel(k) }))]} allLabel={monthLabel(monthKey())} />
          <ParamSelect param="status" options={Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))} allLabel="Orice status" />
          <ParamSelect param="categorie" options={options.categories.map((c) => ({ value: c.value, label: c.label }))} allLabel="Toate categoriile" />
          <ParamSelect param="proiect" options={options.projects} allLabel="Toate proiectele" />
          <Link href={toggleNealocate()} className={cn('rounded-lg border px-2 py-1 text-[12.5px]', sp.nealocate === '1' ? 'border-foreground bg-foreground text-background' : 'border-input text-muted-foreground hover:text-foreground')}>
            doar nealocate
          </Link>
        </div>
        <SidePanel trigger="＋ Adaugă cheltuială" title="Adaugă cheltuială" className="max-w-[560px]" hint="Un singur formular: documentul → pe ce proiect → plata. Fără alocare = cheltuială indirectă.">
          <ExpenseForm options={options} action={createExpense} />
        </SidePanel>
      </div>

      <div className="flex gap-5 text-[12.5px] text-muted-foreground">
        <span>{rows.length} documente · total <span className="font-mono font-semibold text-foreground">{fmtLei(total)}</span></span>
        <span>de plătit <span className={cn('font-mono font-semibold', unpaid > 0 ? 'text-red-600' : 'text-foreground')}>{fmtLei(unpaid)}</span></span>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nicio cheltuială pentru filtrele alese" text="Adaugă prima cu butonul din dreapta. Bonurile de la magazin merg și de pe telefon, din /finante/cheltuieli/noua." />
      ) : (
        <div className={tableWrapCls}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Data</th>
                <th className={thCls}>Furnizor</th>
                <th className={thCls}>Tip</th>
                <th className={cn(thCls, 'text-right')}>Sumă</th>
                <th className={thCls}>Categorie</th>
                <th className={thCls}>Alocat pe</th>
                <th className={thCls}>Plată</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <LinkRow key={d.id} href={withDoc(d.id)}>
                  <td className={cn(tdCls, 'whitespace-nowrap font-mono text-[12px]')}>{fmtDate.format(d.issuedAt)}</td>
                  <td className={cn(tdCls, 'font-semibold')}>
                    {d.counterparty}
                    {d.expected && <span className="ml-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-px text-[10.5px] font-semibold text-amber-800">așteptat</span>}
                  </td>
                  <td className={cn(tdCls, 'text-[12.5px]')}>{DOCUMENT_KIND_LABELS[d.kind as DocumentKind] ?? d.kind}{d.number && <span className="ml-1 font-mono text-muted-foreground">{d.number}</span>}</td>
                  <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold')}>{fmtLei(d.amount)}</td>
                  <td className={cn(tdCls, 'text-[12.5px] text-muted-foreground')}>{d.category ?? '—'}</td>
                  <td className={tdCls}>
                    <div className="flex flex-wrap gap-1">
                      {d.allocations.map((a) => (
                        <span key={a.projectId} className="rounded-full border border-accent-blue-border bg-accent-blue px-2 py-px text-[10.5px] font-semibold text-accent-blue-foreground">{a.projectName} · {fmtLei(a.amount)}</span>
                      ))}
                      {d.unallocated > 0.005 && <span className="rounded-full bg-muted px-2 py-px text-[10.5px] font-semibold text-muted-foreground">indirect · {fmtLei(d.unallocated)}</span>}
                    </div>
                  </td>
                  <td className={tdCls}>
                    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold', PAYMENT_STATUS_PILL[d.status])}>{PAYMENT_STATUS_LABELS[d.status]}</span>
                    {d.status === 'PARTIAL' && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">rest {fmtLei(d.remaining)}</div>}
                  </td>
                </LinkRow>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {doc && (
        <DocumentSheet title={`${DOCUMENT_KIND_LABELS[doc.kind as DocumentKind] ?? doc.kind} · ${doc.counterparty}`} closeHref={base}>
          <DocumentPanel doc={doc} options={options} />
        </DocumentSheet>
      )}
    </div>
  );
}
