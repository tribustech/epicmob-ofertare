import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { fmtDate } from '@/lib/crm/dates';
import { CLIENT_KIND_LABELS } from '@/lib/crm/constants';
import { loadClientsList } from '@/lib/crm/client-queries';
import { LinkRow } from '@/components/crm/LinkRow';
import { EmptyState, PageHeader, StagePill, tableWrapCls, tdCls, thCls } from '@/components/crm/ui';

export const dynamic = 'force-dynamic';

export default async function ClientiPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const rows = await loadClientsList(q);

  return (
    <div className="space-y-5">
      <PageHeader title="Clienți">
        <form method="get" action="/clienti">
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Caută nume sau telefon…"
            className="h-8 w-[260px] rounded-lg border border-input bg-card px-2.5 text-[13.5px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </form>
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState
          title={q ? 'Niciun client găsit' : 'Niciun client încă'}
          text={q ? 'Încearcă alt nume sau număr.' : 'Clienții apar aici după ce un lead primește un proiect (Calificat) sau un contract (Client).'}
        />
      ) : (
        <div className={tableWrapCls}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Nume</th>
                <th className={thCls}>Telefon</th>
                <th className={thCls}>Stage</th>
                <th className={cn(thCls, 'text-right')}>Proiecte</th>
                <th className={cn(thCls, 'text-right')}>Valoare contracte</th>
                <th className={thCls}>Ultima activitate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <LinkRow key={c.id} href={`/clienti/${c.id}`}>
                  <td className={cn(tdCls, 'text-[13.5px] font-semibold')}>
                    {c.name}
                    <div className="text-[11.5px] font-normal text-muted-foreground">{CLIENT_KIND_LABELS[c.kind as 'PERSOANA' | 'FIRMA'] ?? c.kind}</div>
                  </td>
                  <td className={cn(tdCls, 'font-mono text-[12.5px]')}>{c.phone ?? '—'}</td>
                  <td className={tdCls}><StagePill stage={c.stage} /></td>
                  <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{c.projectCount}</td>
                  <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold')}>{c.contractValue > 0 ? fmtLei(c.contractValue) : '—'}</td>
                  <td className={cn(tdCls, 'text-[12.5px] text-muted-foreground')}>{fmtDate.format(c.lastActivity)}</td>
                </LinkRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
