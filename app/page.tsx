import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { daysFromToday, deadlineParts, fmtDate } from '@/lib/crm/dates';
import { loadActiveProjects, loadLeadsToContact, loadStaleQuotes } from '@/lib/crm/dashboard-queries';
import { loadDashboardMoney } from '@/lib/finance/dashboard-money';
import { generateExpectedDocuments } from '@/lib/finance/recurring-generate';
import { DOCUMENT_KIND_LABELS, type DocumentKind } from '@/lib/finance/constants';
import { ProjectStatusPill, microLabelCls } from '@/components/crm/ui';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const fmtLong = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function Panel({ title, sub, action, children, className }: {
  title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl bg-card ring-1 ring-border', className)}>
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="text-[14px] font-bold">
          {title}{sub && <span className="ml-1.5 font-medium text-muted-foreground">{sub}</span>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-5 py-6 text-center text-[13px] text-muted-foreground">{text}</div>;
}

export default async function Dashboard() {
  await generateExpectedDocuments(); // recurentele „așteptate" se generează lazy, fără cron
  const [projects, leads, staleQuotes, money] = await Promise.all([loadActiveProjects(), loadLeadsToContact(), loadStaleQuotes(), loadDashboardMoney()]);
  const today = fmtLong.format(new Date());
  const in14 = Date.now() + 14 * 86_400_000;
  const payables = money.unpaid.filter((d) => !d.dueAt || d.dueAt.getTime() <= in14);
  const payablesTotal = payables.reduce((s, d) => s + d.remaining, 0);
  const moneyCard = 'flex flex-col gap-2 rounded-xl bg-card p-5 ring-1 ring-border';
  const row = 'flex items-center justify-between gap-2 text-[12.5px]';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="text-[13px] text-muted-foreground first-letter:uppercase">{today}</div>
      </div>

      {/* banda 1 — bani */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={moneyCard}>
          <div className={microLabelCls}>Conturi</div>
          {money.accounts.map((a) => (
            <Link key={a.id} href={`/finante/conturi/${a.id}`} className={cn(row, 'hover:underline')}>
              <span>{a.name}</span><span className={cn('font-mono font-semibold', a.balance < 0 && 'text-red-600')}>{fmtLei(a.balance)}</span>
            </Link>
          ))}
          <div className={cn(row, 'mt-auto border-t pt-2 font-semibold')}><span>Total</span><span className="font-mono">{fmtLei(money.accountsTotal)}</span></div>
        </div>
        <div className={moneyCard}>
          <div className={microLabelCls}>Disponibil real</div>
          <div className={cn('font-mono text-2xl font-semibold tracking-tight', money.available < 0 && 'text-red-600')}>{fmtLei(money.available)}</div>
          <div className="mt-auto flex flex-col gap-1 border-t pt-2 text-muted-foreground">
            <div className={row}><span>Solduri conturi</span><span className="font-mono">{fmtLei(money.accountsTotal)}</span></div>
            <div className={row}><span>− Facturi neplătite</span><span className="font-mono">{fmtLei(money.unpaidTotal)}</span></div>
            <div className={row}><span>− Împrumuturi scadente 30 z</span><span className="font-mono">{fmtLei(money.loansDue30)}</span></div>
          </div>
        </div>
        <div className={moneyCard}>
          <div className={microLabelCls}>De încasat</div>
          <div className="font-mono text-2xl font-semibold tracking-tight text-accent-blue-foreground">{fmtLei(money.receivableTotal)}</div>
          <div className="mt-auto flex flex-col gap-1 border-t pt-2">
            {money.receivables.slice(0, 3).map((p) => (
              <Link key={p.id} href={`/proiecte/${p.id}?tab=bani`} className={cn(row, 'hover:underline')}><span className="truncate">{p.name}</span><span className="font-mono">{fmtLei(p.remaining)}</span></Link>
            ))}
            {money.receivables.length === 0 && <div className="text-[12.5px] text-muted-foreground">nimic de încasat</div>}
          </div>
        </div>
        <div className={moneyCard}>
          <div className={microLabelCls}>Datorii</div>
          <div className={cn('font-mono text-2xl font-semibold tracking-tight', money.debtsTotal > 0 && 'text-red-600')}>{fmtLei(money.debtsTotal)}</div>
          <div className="mt-auto flex flex-col gap-1 border-t pt-2">
            <Link href="/finante/cheltuieli?status=NEPLATIT&luna=toate" className={cn(row, 'hover:underline')}><span>Facturi neplătite ({money.unpaid.length})</span><span className="font-mono">{fmtLei(money.unpaidTotal)}</span></Link>
            {money.loans.map((l) => (
              <div key={l.id} className={row}><span className="truncate">{l.lenderName}{l.dueAt && <span className="text-muted-foreground"> · {fmtDate.format(l.dueAt)}</span>}</span><span className="font-mono">{fmtLei(l.remaining)}</span></div>
            ))}
            {money.personal.filter((a) => a.debt > 0).map((a) => (
              <div key={a.id} className={row}><span className="truncate">de returnat · {a.name}</span><span className="font-mono">{fmtLei(a.debt)}</span></div>
            ))}
          </div>
        </div>
      </div>

      <Panel
        title="Proiecte active"
        sub="· după deadline"
        action={<Link href="/proiecte" className="text-[12.5px] font-medium text-accent-blue-foreground hover:underline">Toate proiectele →</Link>}
      >
        {projects.length === 0 ? (
          <Empty text="Niciun proiect activ." />
        ) : (
          projects.map((p) => {
            const dl = deadlineParts(p.deadlineAt);
            return (
              <Link
                key={p.id}
                href={`/proiecte/${p.id}`}
                className="grid grid-cols-[minmax(0,1.6fr)_120px_150px_minmax(0,1fr)] items-center gap-4 border-b px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold">{p.name}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{p.client ?? 'fără client'}</div>
                </div>
                <ProjectStatusPill status={p.status} className="justify-self-start" />
                <div className={cn('font-mono text-[12.5px]', dl.cls)}>
                  {dl.label}
                  {dl.sub && <div className="font-sans text-[11.5px] text-muted-foreground">{dl.sub}</div>}
                </div>
                <div className="text-right font-mono text-[12.5px] font-semibold">{p.contract > 0 ? fmtLei(p.contract) : <span className="font-normal text-muted-foreground">fără contract</span>}</div>
              </Link>
            );
          })
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Leaduri de contactat"
          action={<Link href="/leaduri" className="text-[12.5px] font-medium text-accent-blue-foreground hover:underline">Toate →</Link>}
        >
          {leads.length === 0 ? (
            <Empty text="Nimic de sunat azi." />
          ) : (
            leads.map((l) => {
              const d = l.nextActionAt ? daysFromToday(l.nextActionAt) : 0;
              return (
                <div key={l.id} className="border-b px-5 py-3 last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold">{l.name}</span>
                    <span className={cn('font-mono text-[11.5px]', d < 0 ? 'text-red-600' : 'text-amber-700')}>
                      {d < 0 ? `întârziat ${-d} z` : 'azi'}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                    {l.phone && <span className="font-mono">{l.phone}</span>}{l.phone && l.wants && ' · '}{l.wants}
                  </div>
                  {l.nextActionNote && <div className="mt-0.5 text-[12.5px]">{l.nextActionNote}</div>}
                  <div className="mt-2">
                    <Button asChild variant="outline" size="sm"><Link href={`/clienti/${l.id}`}>Notează</Link></Button>
                  </div>
                </div>
              );
            })
          )}
        </Panel>

        <Panel title="Oferte fără răspuns" sub="› 7 zile">
          {staleQuotes.length === 0 ? (
            <Empty text="Nicio ofertă trimisă care așteaptă de peste 7 zile." />
          ) : (
            staleQuotes.map((q) => (
              <div key={q.id} className="border-b px-5 py-3 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/proiecte/${q.project?.id}`} className="text-[13.5px] font-semibold hover:underline">{q.project?.name}</Link>
                  <span className="font-mono text-[12.5px] font-semibold">{q.sellPrice != null ? fmtLei(q.sellPrice) : '—'}</span>
                </div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {q.project?.client?.name ?? 'fără client'} · v{q.version} · trimisă {fmtDate.format(q.sentAt)}{' '}
                  <span className="text-red-600">({q.days} zile)</span>
                </div>
              </div>
            ))
          )}
        </Panel>

        <Panel title="De plătit" sub="în 14 zile" action={<span className="font-mono text-[12.5px] font-semibold">{fmtLei(payablesTotal)}</span>}>
          {payables.length === 0 ? (
            <Empty text="Nimic scadent în următoarele 14 zile." />
          ) : (
            payables.slice(0, 8).map((d) => (
              <Link key={d.id} href={`/finante/cheltuieli?luna=toate&doc=${d.id}`} className="flex items-center justify-between gap-2 border-b px-5 py-2.5 transition-colors last:border-b-0 hover:bg-muted/50">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{d.counterparty}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {DOCUMENT_KIND_LABELS[d.kind as DocumentKind] ?? d.kind}{d.dueAt ? ` · scadent ${fmtDate.format(d.dueAt)}` : ' · fără scadență'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="font-mono text-[12.5px] font-semibold">{fmtLei(d.remaining)}</span>
                  {d.expected && <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-800">așteptat</span>}
                </div>
              </Link>
            ))
          )}
        </Panel>
      </div>
    </div>
  );
}
