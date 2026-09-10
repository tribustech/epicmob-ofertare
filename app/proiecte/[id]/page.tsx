import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { deadlineParts, fmtDate, toDateInput } from '@/lib/crm/dates';
import { LOST_REASON_LABELS, NEXT_PROJECT_STATUS, PROJECT_STATUS_LABELS, type ProjectStatus } from '@/lib/crm/constants';
import { loadProjectDetail, loadProjectOptions } from '@/lib/crm/project-queries';
import { loadPinnedNotes, loadTimeline } from '@/lib/crm/timeline';
import { PinnedNotes, Timeline, parseFilter } from '@/components/crm/Timeline';
import { loadProjectMoneyDetail } from '@/lib/finance/project-money';
import { loadEstimateVsReal } from '@/lib/finance/estimate';
import { loadAccountOptions } from '@/lib/finance/account-queries';
import { addContractChange, addReceipt, deleteContractChange, deleteReceipt } from '@/lib/finance/receipt-actions';
import { DOCUMENT_KIND_LABELS, INCOME_TYPE_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_PILL, type DocumentKind } from '@/lib/finance/constants';
import { DeleteButton } from '@/components/DeleteButton';
import {
  acceptQuote, advanceProject, createQuoteForProject, markProjectLost, moveQuoteToProject, setHoursWorked, updateProjectDetails,
} from '@/lib/crm/project-actions';
import { duplicateQuote } from '@/lib/quote/actions';
import { ActionForm } from '@/components/ActionForm';
import { NumberInput, Select, SubmitButton, TextArea, TextInput } from '@/components/forms';
import { FormModal } from '@/components/FormModal';
import { ProjectStatusPill, microLabelCls, tableWrapCls, tdCls, thCls } from '@/components/crm/ui';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const QUOTE_STATUS: Record<string, { label: string; cls: string }> = {
  CIORNA: { label: 'Ciornă', cls: 'bg-muted text-muted-foreground' },
  TRIMISA: { label: 'Trimisă', cls: 'border border-accent-blue-border bg-accent-blue text-accent-blue-foreground' },
  ACCEPTATA: { label: 'Acceptată', cls: 'border border-emerald-200 bg-emerald-50 text-emerald-700' },
  RESPINSA: { label: 'Respinsă', cls: 'bg-muted text-muted-foreground line-through' },
};

const TABS = [
  { key: 'oferte', label: 'Oferte' }, { key: 'costuri', label: 'Costuri' }, { key: 'bani', label: 'Bani' }, { key: 'timeline', label: 'Timeline' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export default async function ProiectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; flux?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : 'oferte';
  const [project, projectOptions, timeline, pinned, bani, accounts, evr] = await Promise.all([
    loadProjectDetail(id), loadProjectOptions(id), loadTimeline({ projectId: id }), loadPinnedNotes({ projectId: id }),
    loadProjectMoneyDetail(id), loadAccountOptions(), loadEstimateVsReal(id),
  ]);
  if (!project) notFound();
  const money = bani.money;
  const accountOptions = accounts.map((a) => ({ value: a.value, label: `${a.label} · ${fmtLei(a.balance)}` }));
  const todayInput = toDateInput(new Date());

  const next = NEXT_PROJECT_STATUS[project.status as ProjectStatus] ?? null;
  const dl = deadlineParts(project.deadlineAt);
  const isClosed = project.status === 'INCHIS' || project.status === 'PIERDUT';
  const accepted = project.quotes.filter((q) => q.status === 'ACCEPTATA');
  const latest = project.quotes[project.quotes.length - 1];
  const lostReasonOptions = Object.entries(LOST_REASON_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 text-[12.5px] text-muted-foreground">
        <Link href="/proiecte" className="hover:text-foreground">Proiecte</Link>
        {project.client && (
          <><span>›</span><Link href={`/clienti/${project.client.id}`} className="hover:text-foreground">{project.client.name}</Link></>
        )}
        <span>›</span><span className="text-foreground">{project.name}</span>
      </div>

      {/* ───── antet ───── */}
      <div className="flex flex-col gap-4 rounded-xl bg-card px-6 py-5 ring-1 ring-border">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[13px] text-muted-foreground">
              {project.client ? (
                <Link href={`/clienti/${project.client.id}`} className="hover:text-foreground">{project.client.name}</Link>
              ) : <span>fără client</span>}
              <span>·</span>
              <span>
                deadline <span className={cn('font-mono', dl.cls)}>{dl.label}</span>{dl.sub && ` ${dl.sub}`}
              </span>
              <FormModal trigger="schimbă" title="Detalii proiect" variant="outline" size="sm" className="h-[22px] px-2 text-[11.5px] text-muted-foreground">
                <ActionForm action={updateProjectDetails.bind(null, project.id)} className="grid gap-4">
                  <TextInput name="name" label="Nume" defaultValue={project.name} />
                  <TextArea name="description" label="Descriere" defaultValue={project.description} rows={2} />
                  <TextInput name="deadlineAt" label="Deadline promis" type="date" defaultValue={toDateInput(project.deadlineAt)} required={false} mono />
                  <div><SubmitButton>Salvează</SubmitButton></div>
                </ActionForm>
              </FormModal>
            </div>
            {project.description && <p className="mt-2 max-w-[720px] text-[13px] text-muted-foreground">{project.description}</p>}
          </div>

          <div className="flex items-center gap-2">
            <ProjectStatusPill status={project.status} className="px-3 py-1 text-[12px]" />
            {next && next === 'MONTAT' && (
              <FormModal trigger={`Trece la ${PROJECT_STATUS_LABELS[next]} →`} title="Proiect montat">
                <ActionForm action={advanceProject.bind(null, project.id)} className="grid gap-4">
                  <input type="hidden" name="to" value="MONTAT" />
                  <NumberInput name="hoursWorked" label="Ore lucrate (opțional)" defaultValue={project.hoursWorked} required={false} step="0.5" />
                  <p className="text-[12px] text-muted-foreground">Venitul proiectului intră în raportul lunii în care e montat.</p>
                  <div><SubmitButton>Marchează montat</SubmitButton></div>
                </ActionForm>
              </FormModal>
            )}
            {next && next !== 'MONTAT' && (
              <ActionForm
                action={advanceProject.bind(null, project.id)}
                confirm={
                  next === 'ACCEPTAT' && accepted.length === 0
                    ? 'Nicio ofertă nu e acceptată. Treci proiectul pe Acceptat oricum?'
                    : next === 'INCHIS' && (money.receivable > 0.005 || money.unpaidShare > 0.005)
                      ? `Atenție: ${money.receivable > 0.005 ? `mai sunt de încasat ${fmtLei(money.receivable)}` : ''}${money.receivable > 0.005 && money.unpaidShare > 0.005 ? ' și ' : ''}${money.unpaidShare > 0.005 ? `mai sunt facturi neplătite de ${fmtLei(money.unpaidShare)}` : ''}. Închizi proiectul oricum?`
                      : `Treci proiectul la „${PROJECT_STATUS_LABELS[next]}"?`
                }
              >
                <input type="hidden" name="to" value={next} />
                <Button type="submit">Trece la {PROJECT_STATUS_LABELS[next]} →</Button>
              </ActionForm>
            )}
            {!isClosed && (
              <FormModal trigger="Pierdut" title="Proiect pierdut" variant="outline">
                <ActionForm action={markProjectLost.bind(null, project.id)} className="grid gap-4">
                  <Select name="lostReason" label="Motiv" options={lostReasonOptions} />
                  <TextInput name="lostNote" label="Detalii" required={false} />
                  <div><SubmitButton>Marchează pierdut</SubmitButton></div>
                </ActionForm>
              </FormModal>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
          <div>
            <div className={microLabelCls}>Contract</div>
            <div className="mt-1 font-mono text-2xl font-semibold tracking-tight">{money.contract > 0 ? fmtLei(money.contract) : '—'}</div>
            <div className="text-[12px] text-muted-foreground">
              {accepted.length === 0 ? 'nicio ofertă acceptată' : accepted.length === 1 ? `oferta v${accepted[0].version}` : `${accepted.length} oferte acceptate`}
              {money.contractChanges !== 0 && ` ${money.contractChanges > 0 ? '+' : '−'} ${fmtLei(Math.abs(money.contractChanges))} modificări`}
            </div>
          </div>
          <div>
            <div className={microLabelCls}>Încasat</div>
            <div className="mt-1 font-mono text-2xl font-semibold tracking-tight text-accent-blue-foreground">{fmtLei(money.received)}</div>
            <div className="text-[12px] text-muted-foreground">
              {money.contract > 0 ? `de încasat ${fmtLei(Math.max(0, money.receivable))}` : 'fără contract'}
            </div>
          </div>
          <div>
            <div className={microLabelCls}>Cheltuit</div>
            <div className="mt-1 font-mono text-2xl font-semibold tracking-tight">{fmtLei(money.spent)}</div>
            <div className="text-[12px] text-muted-foreground">
              {accepted.length > 0 && accepted[0].totalCost != null ? `estimat ${fmtLei(accepted.reduce((s, q) => s + (q.totalCost ?? 0), 0))}` : 'fără estimat'}
              {money.unpaidShare > 0.005 && ` · de plătit ${fmtLei(money.unpaidShare)}`}
            </div>
          </div>
          <div>
            <div className={microLabelCls}>Contribuție la zi</div>
            <div className={cn('mt-1 font-mono text-2xl font-semibold tracking-tight', money.contract > 0 ? (money.contribution < 0 ? 'text-red-600' : 'text-emerald-700') : 'text-muted-foreground/50')}>
              {money.contract > 0 ? fmtLei(money.contribution) : '—'}
            </div>
            <div className="text-[12px] text-muted-foreground">{money.contributionPct != null ? `${money.contributionPct}% din contract` : 'contract − cheltuit'}</div>
          </div>
        </div>
      </div>

      {/* ───── tab-uri ───── */}
      <div className="flex gap-5 border-b border-[#d9d7d0]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/proiecte/${project.id}?tab=${t.key}`}
            className={cn(
              '-mb-px border-b-2 px-0.5 pb-2.5 pt-2 text-[13.5px] font-medium',
              t.key === tab ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'oferte' ? (
        <div className={tableWrapCls}>
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <div className="text-[15px] font-bold">Oferte</div>
            <div className="flex gap-2">
              {latest && (
                <ActionForm action={duplicateQuote.bind(null, latest.id)}>
                  <Button type="submit" variant="outline" size="sm">Duplică v{latest.version}</Button>
                </ActionForm>
              )}
              <FormModal trigger="Ofertă nouă" title="Ofertă nouă" size="sm">
                <ActionForm action={createQuoteForProject.bind(null, project.id)} className="grid gap-4">
                  <TextInput name="label" label="Etichetă (opțional)" placeholder="fronturi MDF vopsit" required={false} />
                  <p className="text-[12px] text-muted-foreground">Se deschide editorul de ofertă ca versiunea v{(latest?.version ?? 0) + 1}.</p>
                  <div><SubmitButton>Creează oferta</SubmitButton></div>
                </ActionForm>
              </FormModal>
            </div>
          </div>
          {project.quotes.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Nicio ofertă încă. Creează prima cu „Ofertă nouă".</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>Versiune</th>
                  <th className={thCls}>Status</th>
                  <th className={cn(thCls, 'text-right')}>Corpuri</th>
                  <th className={cn(thCls, 'text-right')}>Cost materiale</th>
                  <th className={cn(thCls, 'text-right')}>Preț ofertă</th>
                  <th className={thCls}>Data</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {project.quotes.map((q) => {
                  const st = QUOTE_STATUS[q.status] ?? { label: q.status, cls: 'bg-muted text-muted-foreground' };
                  const isAccepted = q.status === 'ACCEPTATA';
                  return (
                    <tr key={q.id} className={cn(isAccepted && 'bg-emerald-50/40')}>
                      <td className={cn(tdCls, 'font-semibold')}>
                        <span className="font-mono">v{q.version}</span>
                        {q.label && <span className="ml-1.5 font-normal text-muted-foreground">{q.label}</span>}
                      </td>
                      <td className={tdCls}><span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold', st.cls)}>{st.label}</span></td>
                      <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{q.cabinetCount}</td>
                      <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{q.totalCost != null ? fmtLei(q.totalCost) : '—'}</td>
                      <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold', isAccepted && 'text-emerald-700')}>
                        {isAccepted && q.acceptedPrice != null ? fmtLei(q.acceptedPrice) : q.sellPrice != null ? fmtLei(q.sellPrice) : '—'}
                      </td>
                      <td className={cn(tdCls, 'font-mono text-[12px] text-muted-foreground')}>{fmtDate.format(isAccepted && q.acceptedAt ? q.acceptedAt : q.updatedAt)}</td>
                      <td className={cn(tdCls, 'whitespace-nowrap text-right')}>
                        <div className="flex items-center justify-end gap-1.5">
                          {!isAccepted && !isClosed && (
                            <FormModal trigger="Acceptă" title={`Acceptă oferta v${q.version}`} size="sm">
                              <ActionForm
                                action={acceptQuote.bind(null, q.id)}
                                className="grid gap-4"
                                confirm={project.quotes.some((o) => o.id !== q.id && o.status === 'TRIMISA') ? 'Celelalte oferte trimise vor fi marcate ca respinse. Continui?' : undefined}
                              >
                                <p className="text-[13px]">
                                  Prețul se îngheață la <span className="font-mono font-semibold">{q.sellPrice != null ? fmtLei(q.sellPrice) : '—'}</span> și devine prețul contractului.
                                  {project.status === 'OFERTARE' && ' Proiectul trece pe Acceptat.'}
                                </p>
                                {!project.deadlineAt && (
                                  <TextInput name="deadlineAt" label="Deadline promis clientului" type="date" required={false} mono />
                                )}
                                <div><SubmitButton>Acceptă oferta</SubmitButton></div>
                              </ActionForm>
                            </FormModal>
                          )}
                          {projectOptions.length > 0 && (
                            <FormModal trigger="Mută" title="Mută oferta în alt proiect" variant="ghost" size="sm">
                              <ActionForm action={moveQuoteToProject.bind(null, q.id)} className="grid gap-4">
                                <Select name="projectId" label="Proiect destinație" options={projectOptions} allowEmpty />
                                <p className="text-[12px] text-muted-foreground">Util pentru gruparea ofertelor migrate. Oferta primește versiunea următoare în proiectul nou.</p>
                                <div><SubmitButton>Mută oferta</SubmitButton></div>
                              </ActionForm>
                            </FormModal>
                          )}
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/oferte/${q.id}`}>Deschide →</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : tab === 'costuri' ? (
        <div className="space-y-4">
          {/* (a) Estimat vs Real */}
          <div className={tableWrapCls}>
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <div className="text-[15px] font-bold">
                Estimat vs Real <span className="ml-1.5 font-medium text-muted-foreground">· pe categorii</span>
                {evr.totalOver && <span className="ml-2 rounded-full border border-red-200 bg-red-50 px-2 py-px align-middle text-[10.5px] font-semibold text-red-700">peste estimat</span>}
              </div>
              <span className="text-[12px] text-muted-foreground">
                {evr.estimate ? `estimat din ${accepted.length === 1 ? `oferta v${accepted[0].version}` : 'ofertele acceptate'}` : 'fără ofertă acceptată'} · prag {evr.thresholdPct}%
              </span>
            </div>
            {evr.rows.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Nimic de comparat încă: fără ofertă acceptată și fără cheltuieli alocate.</div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Categorie</th>
                    <th className={cn(thCls, 'text-right')}>Estimat</th>
                    <th className={cn(thCls, 'text-right')}>Real</th>
                    <th className={cn(thCls, 'text-right')}>Diferență</th>
                    <th className={cn(thCls, 'text-right')}>Real / estimat</th>
                  </tr>
                </thead>
                <tbody>
                  {evr.rows.map((r) => (
                    <tr key={r.key} className={cn(r.over && 'bg-red-50/60')}>
                      <td className={cn(tdCls, 'font-medium')}>
                        {r.label}
                        {r.over && <span className="ml-2 rounded-full border border-red-200 bg-red-50 px-2 py-px text-[10.5px] font-semibold text-red-700">peste estimat</span>}
                        {r.estimated == null && <span className="ml-2 text-[11px] text-muted-foreground">fără mapare la ofertă</span>}
                      </td>
                      <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{r.estimated != null ? fmtLei(r.estimated) : '—'}</td>
                      <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold')}>{fmtLei(r.real)}</td>
                      <td className={cn(tdCls, 'text-right font-mono text-[12.5px]', r.diff != null && (r.diff > 0 ? 'text-red-600' : 'text-emerald-700'))}>
                        {r.diff != null ? `${r.diff > 0 ? '+' : r.diff < 0 ? '−' : ''}${fmtLei(Math.abs(r.diff))}` : '—'}
                      </td>
                      <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{r.ratio != null ? `${Math.round(r.ratio * 100)}%` : '—'}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className={tdCls}>Total direct</td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{evr.totalEstimated != null ? fmtLei(evr.totalEstimated) : '—'}</td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{fmtLei(evr.totalReal)}</td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px]', evr.totalEstimated != null && (evr.totalReal - evr.totalEstimated > 0 ? 'text-red-600' : 'text-emerald-700'))}>
                      {evr.totalEstimated != null ? `${evr.totalReal - evr.totalEstimated > 0 ? '+' : '−'}${fmtLei(Math.abs(evr.totalReal - evr.totalEstimated))}` : '—'}
                    </td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{evr.totalEstimated ? `${Math.round((evr.totalReal / evr.totalEstimated) * 100)}%` : '—'}</td>
                  </tr>
                  {evr.estimate && (
                    <tr className="text-muted-foreground">
                      <td className={tdCls}>Manoperă % din ofertă <span className="text-[11px]">(adaosul brut: preț − cost)</span></td>
                      <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{fmtLei(evr.estimate.markup)}</td>
                      <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold', money.contribution < evr.estimate.markup ? 'text-red-600' : 'text-emerald-700')}>{fmtLei(money.contribution)}</td>
                      <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{`${money.contribution - evr.estimate.markup > 0 ? '+' : '−'}${fmtLei(Math.abs(money.contribution - evr.estimate.markup))}`}</td>
                      <td className={cn(tdCls, 'text-right text-[11px]')}>contribuția reală</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* (b) alocările */}
          <div className={tableWrapCls}>
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <div className="text-[15px] font-bold">Cheltuieli alocate <span className="ml-1.5 font-mono text-[13px] font-medium text-muted-foreground">{fmtLei(money.spent)}</span></div>
              <Button asChild size="sm"><Link href={`/finante/cheltuieli/noua?proiect=${project.id}`}>Adaugă cheltuială</Link></Button>
            </div>
            {bani.allocations.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Nicio cheltuială alocată încă. Bonurile și facturile se aloca pe proiect din „Adaugă cheltuială".</div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Document</th>
                    <th className={thCls}>Categorie</th>
                    <th className={cn(thCls, 'text-right')}>Alocat</th>
                    <th className={thCls}>Plată</th>
                  </tr>
                </thead>
                <tbody>
                  {bani.allocations.map((a) => (
                    <tr key={a.id}>
                      <td className={tdCls}>
                        <Link href={`/finante/cheltuieli?luna=toate&doc=${a.document.id}`} className="font-semibold hover:underline">{a.document.counterparty}</Link>
                        <div className="text-[11.5px] text-muted-foreground">
                          {DOCUMENT_KIND_LABELS[a.document.kind as DocumentKind] ?? a.document.kind}{a.document.number && ` ${a.document.number}`} · {fmtDate.format(a.document.issuedAt)} · din {fmtLei(a.document.amount)}
                        </div>
                      </td>
                      <td className={cn(tdCls, 'text-[12.5px]')}>{a.category}</td>
                      <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold')}>{fmtLei(a.amount)}</td>
                      <td className={tdCls}>
                        <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold', PAYMENT_STATUS_PILL[a.document.status])}>{PAYMENT_STATUS_LABELS[a.document.status]}</span>
                        {a.unpaidShare > 0.005 && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">de plătit {fmtLei(a.unpaidShare)}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* (c) modificări de contract */}
            <div className={tableWrapCls}>
              <div className="flex items-center justify-between border-b px-5 py-3.5">
                <div className="text-[15px] font-bold">Modificări de contract</div>
                <FormModal trigger="Adaugă modificare" title="Modificare de contract" variant="outline" size="sm">
                  <ActionForm action={addContractChange.bind(null, project.id)} className="grid gap-3">
                    <TextInput name="description" label="Ce s-a schimbat" placeholder="a mai vrut 2 corpuri suspendate" />
                    <div className="grid grid-cols-2 gap-3">
                      <TextInput name="amount" label="Sumă (± lei)" placeholder="1800 sau -500" mono />
                      <TextInput name="date" label="Data" type="date" defaultValue={todayInput} mono />
                    </div>
                    <p className="text-[12px] text-muted-foreground">Intră în prețul contractului și în timeline. Sumă negativă = reducere.</p>
                    <div><SubmitButton>Salvează</SubmitButton></div>
                  </ActionForm>
                </FormModal>
              </div>
              {bani.changes.length === 0 ? (
                <div className="px-5 py-6 text-center text-[13px] text-muted-foreground">Nicio modificare după acceptare.</div>
              ) : (
                <ul className="divide-y">
                  {bani.changes.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-[13px]">
                      <span><span className="mr-2 font-mono text-[11.5px] text-muted-foreground">{fmtDate.format(c.date)}</span>{c.description}</span>
                      <span className="flex items-center gap-2">
                        <span className={cn('font-mono font-semibold', c.amount < 0 ? 'text-red-600' : 'text-emerald-700')}>{c.amount > 0 ? '+' : '−'}{fmtLei(Math.abs(c.amount))}</span>
                        <DeleteButton action={deleteContractChange.bind(null, c.id)} iconOnly label="Șterge modificarea" confirmMessage="Ștergi această modificare de contract?" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between border-t px-5 py-2.5 text-[12.5px]">
                <span className="text-muted-foreground">Preț contract</span><span className="font-mono font-semibold">{fmtLei(money.contract)}</span>
              </div>
            </div>

            {/* (d) ore lucrate */}
            <div className="flex flex-col gap-2 rounded-xl bg-card p-5 ring-1 ring-border">
              <div className="text-[15px] font-bold">Ore lucrate</div>
              <div className="font-mono text-2xl font-semibold tracking-tight">{project.hoursWorked != null ? project.hoursWorked : '—'}</div>
              <p className="text-[12px] text-muted-foreground">Se cere la Montat, opțional. Manopera directă = ore × tarif orar încărcat, când există destule proiecte cu ore.</p>
              <div>
                <FormModal trigger={project.hoursWorked != null ? 'Schimbă' : 'Completează'} title="Ore lucrate" variant="outline" size="sm">
                  <ActionForm action={setHoursWorked.bind(null, project.id)} className="grid gap-4">
                    <NumberInput name="hoursWorked" label="Ore lucrate" defaultValue={project.hoursWorked} required={false} step="0.5" />
                    <div><SubmitButton>Salvează</SubmitButton></div>
                  </ActionForm>
                </FormModal>
              </div>
            </div>
          </div>
        </div>
      ) : tab === 'bani' ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className={tableWrapCls}>
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <div className="text-[15px] font-bold">Încasări</div>
              <FormModal trigger="Adaugă încasare" title="Adaugă încasare" size="sm">
                <ActionForm action={addReceipt.bind(null, project.id)} className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput name="amount" label="Sumă (lei)" placeholder={money.receivable > 0 ? money.receivable.toFixed(2).replace('.', ',') : '0,00'} mono />
                    <TextInput name="incomeType" label="Tip" placeholder="Avans, Rată, Final sau ce vrei tu" required={false} suggestions={Object.values(INCOME_TYPE_LABELS)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Select name="accountId" label="În contul" options={accountOptions} allowEmpty />
                    <TextInput name="date" label="Data" type="date" defaultValue={todayInput} mono />
                  </div>
                  <TextInput name="note" label="Notă (chitanță / factură emisă)" required={false} />
                  <div><SubmitButton>Înregistrează</SubmitButton></div>
                </ActionForm>
              </FormModal>
            </div>
            {bani.receipts.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Nicio încasare încă.</div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Data</th>
                    <th className={thCls}>Tip</th>
                    <th className={thCls}>Cont</th>
                    <th className={cn(thCls, 'text-right')}>Sumă</th>
                    <th className={thCls}></th>
                  </tr>
                </thead>
                <tbody>
                  {bani.receipts.map((r) => (
                    <tr key={r.id}>
                      <td className={cn(tdCls, 'whitespace-nowrap font-mono text-[12px]')}>{fmtDate.format(r.date)}</td>
                      <td className={cn(tdCls, 'text-[12.5px]')}>{r.incomeType ? INCOME_TYPE_LABELS[r.incomeType as keyof typeof INCOME_TYPE_LABELS] ?? r.incomeType : 'Încasare'}{r.note && <div className="text-[11.5px] text-muted-foreground">{r.note}</div>}</td>
                      <td className={cn(tdCls, 'text-[12.5px]')}><Link href={`/finante/conturi/${r.account.id}`} className="hover:underline">{r.account.name}</Link></td>
                      <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold text-emerald-700')}>+{fmtLei(r.amount)}</td>
                      <td className={cn(tdCls, 'text-right')}><DeleteButton action={deleteReceipt.bind(null, r.id)} iconOnly label="Șterge încasarea" confirmMessage="Ștergi această încasare? Banii ies din cont." /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="grid grid-cols-3 gap-3 border-t px-5 py-3 text-[12.5px]">
              <div><div className={microLabelCls}>Încasat</div><div className="font-mono font-semibold text-accent-blue-foreground">{fmtLei(money.received)}</div></div>
              <div><div className={microLabelCls}>Din contract</div><div className="font-mono font-semibold">{fmtLei(money.contract)}</div></div>
              <div><div className={microLabelCls}>De încasat</div><div className={cn('font-mono font-semibold', money.receivable > 0 && 'text-red-600')}>{fmtLei(Math.max(0, money.receivable))}</div></div>
            </div>
          </div>

          <div className={tableWrapCls}>
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <div className="text-[15px] font-bold">Facturi neplătite pe proiect</div>
              <span className="font-mono text-[12.5px] font-semibold">{fmtLei(money.unpaidShare)}</span>
            </div>
            {bani.unpaidDocs.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Nimic de plătit furnizorilor pe acest proiect.</div>
            ) : (
              <ul className="divide-y">
                {bani.unpaidDocs.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-[13px]">
                    <div className="min-w-0">
                      <Link href={`/finante/cheltuieli?luna=toate&doc=${a.document.id}`} className="font-semibold hover:underline">{a.document.counterparty}</Link>
                      <div className="text-[11.5px] text-muted-foreground">
                        {DOCUMENT_KIND_LABELS[a.document.kind as DocumentKind] ?? a.document.kind}{a.document.dueAt ? ` · scadent ${fmtDate.format(a.document.dueAt)}` : ''} · cota proiectului
                      </div>
                    </div>
                    <span className="font-mono font-semibold">{fmtLei(a.unpaidShare)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t px-5 py-2.5 text-[11.5px] text-muted-foreground">De plătit = (document − plătit) × (alocare / document). La Închis, aplicația avertizează dacă rămâne ceva aici.</div>
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Timeline
            entries={timeline}
            target={{ projectId: project.id }}
            baseHref={`/proiecte/${project.id}?tab=timeline`}
            filter={parseFilter(sp.flux)}
            placeholder="Update pe proiect… (măsurători, ce s-a schimbat, ce ai promis)"
          />
          <div className="flex flex-col gap-4">
            <PinnedNotes notes={pinned} />
            {pinned.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#d4d4d0] px-4 py-3 text-[12.5px] text-muted-foreground">
                Bifează „Important" la o notiță ca să apară aici, pinuită. Notițele clientului apar pe toate proiectele lui.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
