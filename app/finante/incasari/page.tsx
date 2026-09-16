import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { daysFromToday, fmtDate } from '@/lib/crm/dates';
import { INCOME_TYPE_LABELS } from '@/lib/finance/constants';
import { loadReceivables } from '@/lib/finance/receivables';
import { ProjectStatusPill, microLabelCls, tableWrapCls, tdCls, thCls } from '@/components/crm/ui';

export const dynamic = 'force-dynamic';

const card = 'flex flex-col gap-1 rounded-xl bg-card p-5 ring-1 ring-border';

export default async function IncasariPage() {
  const { rows, receipts, groups, total } = await loadReceivables();
  const received = rows.reduce((s, r) => s + r.received, 0);
  const contract = rows.reduce((s, r) => s + r.contract, 0);
  const late = groups.find((g) => g.key === 'INTARZIAT')?.total ?? 0;
  const openCount = groups.reduce((s, g) => s + g.rows.length, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <div className={microLabelCls}>De încasat</div>
          <div className="font-mono text-2xl font-semibold tracking-tight text-accent-blue-foreground">{fmtLei(total)}</div>
          <div className="text-[12px] text-muted-foreground">{openCount} {openCount === 1 ? 'proiect' : 'proiecte'} cu rest</div>
        </div>
        <div className={card}>
          <div className={microLabelCls}>Întârziate</div>
          <div className={cn('font-mono text-2xl font-semibold tracking-tight', late > 0 && 'text-red-600')}>{fmtLei(late)}</div>
          <div className="text-[12px] text-muted-foreground">montate sau cu deadline trecut</div>
        </div>
        <div className={card}>
          <div className={microLabelCls}>Încasat pe proiectele active</div>
          <div className="font-mono text-2xl font-semibold tracking-tight text-emerald-700">{fmtLei(received)}</div>
          <div className="text-[12px] text-muted-foreground">{receipts.length} {receipts.length === 1 ? 'încasare' : 'încasări'}</div>
        </div>
        <div className={card}>
          <div className={microLabelCls}>Contracte active</div>
          <div className="font-mono text-2xl font-semibold tracking-tight">{fmtLei(contract)}</div>
          <div className="text-[12px] text-muted-foreground">{rows.length} proiecte active + montate</div>
        </div>
      </div>

      {/* ───── încasări viitoare ───── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-[16px] font-bold">Încasări viitoare</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Rest de încasat = preț contract − încasat. Data așteptată = deadline-ul promis; proiect montat sau deadline trecut = întârziat.
          </p>
        </div>
        {groups.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed p-10 text-center text-[13px] text-muted-foreground">Nimic de încasat.</div>
        ) : (
          <div className={tableWrapCls}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>Client · Proiect</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Deadline</th>
                  <th className={cn(thCls, 'text-right')}>Contract</th>
                  <th className={cn(thCls, 'text-right')}>Încasat</th>
                  <th className={cn(thCls, 'text-right')}>Rest</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows key={g.key} label={g.label} total={g.total} late={g.key === 'INTARZIAT'}>
                    {g.rows.map((r) => {
                      const d = r.deadlineAt ? daysFromToday(r.deadlineAt) : null;
                      const parts = [
                        r.advance > 0 && `avans ${fmtLei(r.advance)}`,
                        r.installments > 0 && `rate ${fmtLei(r.installments)}`,
                        r.final > 0 && `final ${fmtLei(r.final)}`,
                      ].filter(Boolean);
                      return (
                        <tr key={r.id}>
                          <td className={tdCls}>
                            {r.client
                              ? <Link href={`/clienti/${r.client.id}`} className="font-semibold hover:underline">{r.client.name}</Link>
                              : <span className="text-muted-foreground">fără client</span>}
                            <span className="text-muted-foreground"> · </span>
                            <Link href={`/proiecte/${r.id}?tab=bani`} className="hover:underline">{r.name}</Link>
                          </td>
                          <td className={tdCls}><ProjectStatusPill status={r.status} className="px-2 py-px text-[10.5px]" /></td>
                          <td className={cn(tdCls, 'whitespace-nowrap font-mono text-[12px]', d != null && d < 0 ? 'text-red-600' : d != null && d <= 7 ? 'text-amber-700' : 'text-muted-foreground')}>
                            {r.deadlineAt ? fmtDate.format(r.deadlineAt) : '—'}
                          </td>
                          <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{fmtLei(r.contract)}</td>
                          <td className={cn(tdCls, 'text-right')}>
                            <div className="font-mono text-[12.5px] text-emerald-700">{fmtLei(r.received)}</div>
                            {parts.length > 0 && <div className="text-[11.5px] text-muted-foreground">{parts.join(' · ')}</div>}
                          </td>
                          <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold text-accent-blue-foreground')}>{fmtLei(r.remaining)}</td>
                        </tr>
                      );
                    })}
                  </GroupRows>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ───── de unde am încasat ───── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-[16px] font-bold">De unde am încasat</h2>
          <p className="text-[12.5px] text-muted-foreground">Toate încasările pe proiectele active și montate, cele mai recente primele.</p>
        </div>
        {receipts.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed p-10 text-center text-[13px] text-muted-foreground">Nicio încasare încă.</div>
        ) : (
          <div className={tableWrapCls}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>Data</th>
                  <th className={thCls}>Client · Proiect</th>
                  <th className={thCls}>Tip</th>
                  <th className={cn(thCls, 'text-right')}>Sumă</th>
                  <th className={thCls}>Cont</th>
                  <th className={thCls}>Notă</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((m) => (
                  <tr key={m.id}>
                    <td className={cn(tdCls, 'whitespace-nowrap font-mono text-[12px]')}>{fmtDate.format(m.date)}</td>
                    <td className={tdCls}>
                      {m.project?.client
                        ? <Link href={`/clienti/${m.project.client.id}`} className="font-semibold hover:underline">{m.project.client.name}</Link>
                        : <span className="text-muted-foreground">fără client</span>}
                      {m.project && (
                        <>
                          <span className="text-muted-foreground"> · </span>
                          <Link href={`/proiecte/${m.project.id}?tab=bani`} className="hover:underline">{m.project.name}</Link>
                        </>
                      )}
                    </td>
                    <td className={cn(tdCls, 'text-[12.5px]')}>
                      {m.incomeType ? INCOME_TYPE_LABELS[m.incomeType as keyof typeof INCOME_TYPE_LABELS] ?? m.incomeType : '—'}
                    </td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold text-emerald-700')}>+{fmtLei(m.amount)}</td>
                    <td className={cn(tdCls, 'text-[12.5px]')}><Link href={`/finante/conturi/${m.account.id}`} className="hover:underline">{m.account.name}</Link></td>
                    <td className={cn(tdCls, 'max-w-[260px] text-[12.5px] text-muted-foreground')}>{m.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function GroupRows({ label, total, late, children }: { label: string; total: number; late?: boolean; children: React.ReactNode }) {
  return (
    <>
      <tr className="bg-muted/40">
        <td colSpan={5} className={cn(tdCls, 'py-2 text-[11px] font-semibold uppercase tracking-[.05em]', late ? 'text-red-600' : 'text-muted-foreground')}>{label}</td>
        <td className={cn(tdCls, 'py-2 text-right font-mono text-[12px] font-semibold', late && 'text-red-600')}>{fmtLei(total)}</td>
      </tr>
      {children}
    </>
  );
}
