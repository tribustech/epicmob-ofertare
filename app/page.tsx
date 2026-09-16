import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { daysFromToday, fmtDate, toDateInput } from '@/lib/crm/dates';
import { LOST_REASON_LABELS } from '@/lib/crm/constants';
import { loadLeadSources } from '@/lib/crm/client-queries';
import { markLost, setNextAction } from '@/lib/crm/client-actions';
import { loadActiveProjects, loadLeadsToContact, loadMeasurementsToSchedule, loadQuotesToFollowUp, loadStaleQuotes } from '@/lib/crm/dashboard-queries';
import { loadDashboardMoney } from '@/lib/finance/dashboard-money';
import { generateExpectedDocuments } from '@/lib/finance/recurring-generate';
import { DOCUMENT_KIND_LABELS, type DocumentKind } from '@/lib/finance/constants';
import { ActionForm } from '@/components/ActionForm';
import { Select, SubmitButton, TextInput } from '@/components/forms';
import { FormModal } from '@/components/FormModal';
import { SidePanel } from '@/components/SidePanel';
import { ClientEditForm } from '@/components/crm/ClientEditForm';
import { DeadlineBadge, ProjectStatusPill, QuoteStatusPill, microLabelCls } from '@/components/crm/ui';
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
  const [projects, leads, followUps, measurements, staleQuotes, money, sources] = await Promise.all([
    loadActiveProjects(), loadLeadsToContact(), loadQuotesToFollowUp(), loadMeasurementsToSchedule(), loadStaleQuotes(), loadDashboardMoney(), loadLeadSources(),
  ]);
  const lostOptions = Object.entries(LOST_REASON_LABELS).map(([value, label]) => ({ value, label }));
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
        <Link href="/finante/incasari" className={cn(moneyCard, 'transition-shadow hover:ring-2 hover:ring-accent-blue-foreground/40')} title="De unde am încasat și încasările viitoare">
          <div className="flex items-center justify-between">
            <div className={microLabelCls}>De încasat</div>
            <span className="text-[11.5px] font-medium text-accent-blue-foreground">Detalii →</span>
          </div>
          <div className="font-mono text-2xl font-semibold tracking-tight text-accent-blue-foreground">{fmtLei(money.receivableTotal)}</div>
          <div className="mt-auto flex flex-col gap-1 border-t pt-2">
            {money.receivables.slice(0, 3).map((p) => (
              <div key={p.id} className={row}><span className="truncate">{p.name}</span><span className="font-mono">{fmtLei(p.remaining)}</span></div>
            ))}
            {money.receivables.length === 0 && <div className="text-[12.5px] text-muted-foreground">nimic de încasat</div>}
          </div>
        </Link>
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
                <div className="min-w-0"><DeadlineBadge deadlineAt={p.deadlineAt} size="sm" /></div>
                <div className="text-right font-mono text-[12.5px] font-semibold">{p.contract > 0 ? fmtLei(p.contract) : <span className="font-normal text-muted-foreground">fără contract</span>}</div>
              </Link>
            );
          })
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="De contactat azi"
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
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <FormModal trigger="Următoarea acțiune" title={`Următoarea acțiune · ${l.name}`} variant="outline" size="sm">
                      <ActionForm action={setNextAction.bind(null, l.id)} className="grid gap-4">
                        <div className="grid grid-cols-[150px_1fr] gap-3">
                          <TextInput name="nextActionAt" label="Data" type="date" defaultValue={toDateInput(l.nextActionAt)} required={false} mono />
                          <TextInput name="nextActionNote" label="Ce faci" defaultValue={l.nextActionNote} required={false} placeholder="Sună cu preț orientativ" />
                        </div>
                        <p className="text-[12px] text-muted-foreground">Lasă data goală ca să ștergi acțiunea (leadul dispare din listă).</p>
                        <div><SubmitButton>Salvează</SubmitButton></div>
                      </ActionForm>
                    </FormModal>
                    <SidePanel trigger="Editează" title="Editează leadul" variant="ghost" size="sm">
                      <ClientEditForm client={l} sources={sources} />
                    </SidePanel>
                    <FormModal trigger="Pierdut" title={`Lead pierdut · ${l.name}`} variant="ghost" size="sm">
                      <ActionForm action={markLost.bind(null, l.id)} className="grid gap-4">
                        <Select name="lostReason" label="Motiv" options={lostOptions} />
                        <TextInput name="lostNote" label="Detalii" required={false} />
                        <div><SubmitButton>Marchează pierdut</SubmitButton></div>
                      </ActionForm>
                    </FormModal>
                    <Button asChild variant="ghost" size="sm"><Link href={`/clienti/${l.id}`}>Deschide</Link></Button>
                  </div>
                </div>
              );
            })
          )}
        </Panel>

        <Panel title="De programat măsurătoare" sub="fără dată stabilită">
          {measurements.length === 0 ? (
            <Empty text="Nicio măsurătoare de programat." />
          ) : (
            measurements.map((q) => (
              <Link key={q.id} href={`/proiecte/${q.project?.id}`} className="block border-b px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold">{q.project?.name}</span>
                  <span className="font-mono text-[12px] text-muted-foreground">{q.waitingDays} z</span>
                </div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {q.project?.client?.name ?? 'fără client'}{q.project?.client?.phone && ` · ${q.project.client.phone}`}
                </div>
              </Link>
            ))
          )}
        </Panel>

        <Panel title="De relansat" sub="măsurători și oferte cu dată">
          {followUps.length === 0 ? (
            <Empty text="Nicio ofertă de relansat azi." />
          ) : (
            followUps.map((q) => (
              <Link key={q.id} href={`/proiecte/${q.project?.id}`} className="block border-b px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold">{q.project?.name}</span>
                  <QuoteStatusPill status={q.status} />
                </div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {q.project?.client?.name ?? 'fără client'} · #{q.version} · {fmtDate.format(q.followUpAt)}{' '}
                  {q.lateDays > 0 ? <span className="text-red-600">({q.lateDays} zile întârziere)</span> : <span className="text-amber-700">azi</span>}
                </div>
                {q.followUpNote && <div className="mt-0.5 truncate text-[12.5px]">{q.followUpNote}</div>}
              </Link>
            ))
          )}
        </Panel>

        <Panel title="Oferte fără răspuns" sub="fără dată, › 7 zile">
          {staleQuotes.length === 0 ? (
            <Empty text="Nicio ofertă trimisă care așteaptă de peste 7 zile." />
          ) : (
            staleQuotes.map((q) => (
              <Link key={q.id} href={`/proiecte/${q.project?.id}`} className="block border-b px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold">{q.project?.name}</span>
                  <span className="font-mono text-[12.5px] font-semibold">{q.sellPrice != null ? fmtLei(q.sellPrice) : '—'}</span>
                </div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {q.project?.client?.name ?? 'fără client'} · #{q.version} · trimisă {fmtDate.format(q.sentAt)}{' '}
                  <span className="text-red-600">({q.days} zile)</span>
                </div>
              </Link>
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
