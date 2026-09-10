import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { daysFromToday, fmtDate, toDateInput } from '@/lib/crm/dates';
import { CLIENT_KIND_LABELS, LOST_REASON_LABELS } from '@/lib/crm/constants';
import { loadClientDetail, loadLeadSources } from '@/lib/crm/client-queries';
import { loadPinnedNotes, loadTimeline } from '@/lib/crm/timeline';
import { PinnedNotes, Timeline, parseFilter } from '@/components/crm/Timeline';
import {
  createProjectForClient, markLost, reactivateClient, setNextAction, setRemarketing, updateClient,
} from '@/lib/crm/client-actions';
import { ActionForm } from '@/components/ActionForm';
import { Select, SubmitButton, TextArea, TextInput } from '@/components/forms';
import { FormModal } from '@/components/FormModal';
import { SidePanel } from '@/components/SidePanel';
import { ProjectStatusPill, StagePill, microLabelCls } from '@/components/crm/ui';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ flux?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [client, sources, timeline, pinned] = await Promise.all([
    loadClientDetail(id), loadLeadSources(), loadTimeline({ clientId: id }), loadPinnedNotes({ clientId: id }),
  ]);
  if (!client) notFound();
  const sourceOptions = sources.map((s) => ({ value: s.name, label: s.name }));
  const kindOptions = Object.entries(CLIENT_KIND_LABELS).map(([value, label]) => ({ value, label }));
  const nextDays = client.nextActionAt ? daysFromToday(client.nextActionAt) : null;
  const isLeadStage = client.stage === 'LEAD' || client.stage === 'CALIFICAT';

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 text-[12.5px] text-muted-foreground">
        <Link href={isLeadStage ? '/leaduri' : '/clienti'} className="hover:text-foreground">{isLeadStage ? 'Leaduri' : 'Clienți'}</Link>
        <span>›</span>
        <span className="text-foreground">{client.name}</span>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* ───── coloana stângă ───── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3.5 rounded-xl bg-card p-5 ring-1 ring-border">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-xl font-bold tracking-tight">{client.name}</h1>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {CLIENT_KIND_LABELS[client.kind as 'PERSOANA' | 'FIRMA'] ?? client.kind}
                  {client.source && <> · sursă {client.source}</>}
                  {' · din '}{fmtDate.format(client.firstContactAt)}
                </div>
              </div>
              <StagePill stage={client.stage} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><div className={microLabelCls}>Telefon</div><div className="mt-0.5 font-mono text-[13px]">{client.phone ?? '—'}</div></div>
              <div><div className={microLabelCls}>Email</div><div className="mt-0.5 break-all text-[13px]">{client.email ?? '—'}</div></div>
              <div className="col-span-2"><div className={microLabelCls}>Adresă</div><div className="mt-0.5 text-[13px]">{client.address ?? '—'}</div></div>
              {client.kind === 'FIRMA' && (
                <div className="col-span-2"><div className={microLabelCls}>CUI</div><div className="mt-0.5 font-mono text-[13px]">{client.cui ?? '—'}</div></div>
              )}
            </div>

            {(client.wants || client.budgetEstimate != null) && (
              <div className="grid grid-cols-[1fr_auto] gap-3 border-t pt-3">
                <div><div className={microLabelCls}>Ce vrea</div><div className="mt-0.5 text-[13px] leading-snug">{client.wants ?? '—'}</div></div>
                <div className="text-right"><div className={microLabelCls}>Buget</div><div className="mt-0.5 font-mono text-[13px]">{client.budgetEstimate != null ? fmtLei(client.budgetEstimate) : '—'}</div></div>
              </div>
            )}

            {client.stage === 'PIERDUT' && (
              <div className="rounded-lg border border-border bg-muted px-3 py-2 text-[12.5px]">
                <span className="font-semibold">Pierdut</span>
                {client.lostReason && <> · {LOST_REASON_LABELS[client.lostReason as keyof typeof LOST_REASON_LABELS] ?? client.lostReason}</>}
                {client.lostNote && <div className="text-muted-foreground">{client.lostNote}</div>}
              </div>
            )}

            {client.remarketing && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
                <span className="font-semibold">Remarketing</span>{client.remarketingNote && <> · {client.remarketingNote}</>}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 border-t pt-3">
              <SidePanel trigger="Editează" title="Editează clientul" variant="outline" size="sm">
                <ActionForm action={updateClient.bind(null, client.id)} className="grid gap-4">
                  <TextInput name="name" label="Nume" defaultValue={client.name} />
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput name="phone" label="Telefon" type="tel" defaultValue={client.phone} required={false} mono />
                    <Select name="kind" label="Tip" options={kindOptions} defaultValue={client.kind} />
                  </div>
                  <TextInput name="email" label="Email" type="email" defaultValue={client.email} required={false} />
                  <TextInput name="address" label="Adresă" defaultValue={client.address} required={false} />
                  <TextInput name="cui" label="CUI (firmă)" defaultValue={client.cui} required={false} mono />
                  <div className="grid grid-cols-2 gap-3 border-t pt-4">
                    <Select name="source" label="Sursă" options={sourceOptions} defaultValue={client.source} allowEmpty />
                    <TextInput name="budgetEstimate" label="Buget estimat (lei)" defaultValue={client.budgetEstimate != null ? String(client.budgetEstimate) : ''} required={false} mono />
                  </div>
                  <TextArea name="wants" label="Ce vrea" defaultValue={client.wants} />
                  <div className="pt-1"><SubmitButton>Salvează</SubmitButton></div>
                </ActionForm>
              </SidePanel>

              <FormModal trigger="Remarketing" title="Remarketing" variant="ghost" size="sm">
                <ActionForm action={setRemarketing.bind(null, client.id)} className="grid gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="remarketing" defaultChecked={client.remarketing} className="size-4" />
                    Păstrează la remarketing (apare pe tab-ul Remarketing și în export)
                  </label>
                  <TextInput name="remarketingNote" label="Notă" defaultValue={client.remarketingNote} required={false} placeholder="ex. revine în primăvară" />
                  <div><SubmitButton>Salvează</SubmitButton></div>
                </ActionForm>
              </FormModal>

              {client.stage === 'PIERDUT' ? (
                <ActionForm action={reactivateClient.bind(null, client.id)}>
                  <Button type="submit" variant="ghost" size="sm">Reactivează ca lead</Button>
                </ActionForm>
              ) : (
                <FormModal trigger="Marchează pierdut" title="Lead pierdut" variant="ghost" size="sm">
                  <ActionForm action={markLost.bind(null, client.id)} className="grid gap-4">
                    <Select name="lostReason" label="Motiv" options={Object.entries(LOST_REASON_LABELS).map(([value, label]) => ({ value, label }))} />
                    <TextInput name="lostNote" label="Detalii" required={false} />
                    <div><SubmitButton>Marchează pierdut</SubmitButton></div>
                  </ActionForm>
                </FormModal>
              )}
            </div>
          </div>

          <PinnedNotes notes={pinned} />

          {/* următoarea acțiune */}
          {client.stage !== 'PIERDUT' && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-card p-5 ring-1 ring-border">
              <div>
                <div className={microLabelCls}>Următoarea acțiune</div>
                {client.nextActionAt ? (
                  <div className="mt-0.5 text-[13px]">
                    <span className={cn('font-mono text-[12.5px]', nextDays != null && nextDays < 0 ? 'text-red-600' : nextDays === 0 ? 'text-amber-700' : '')}>
                      {fmtDate.format(client.nextActionAt)}
                    </span>
                    {client.nextActionNote && <span className="text-muted-foreground"> · {client.nextActionNote}</span>}
                  </div>
                ) : (
                  <div className="mt-0.5 text-[13px] text-muted-foreground">nimic planificat</div>
                )}
              </div>
              <FormModal trigger={client.nextActionAt ? 'Schimbă' : 'Planifică'} title="Următoarea acțiune" variant="outline" size="sm">
                <ActionForm action={setNextAction.bind(null, client.id)} className="grid gap-4">
                  <div className="grid grid-cols-[150px_1fr] gap-3">
                    <TextInput name="nextActionAt" label="Data" type="date" defaultValue={toDateInput(client.nextActionAt)} required={false} mono />
                    <TextInput name="nextActionNote" label="Ce faci" defaultValue={client.nextActionNote} required={false} placeholder="Sună cu preț orientativ" />
                  </div>
                  <p className="text-[12px] text-muted-foreground">Lasă data goală ca să ștergi acțiunea.</p>
                  <div><SubmitButton>Salvează</SubmitButton></div>
                </ActionForm>
              </FormModal>
            </div>
          )}

          {/* proiecte */}
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <div className="text-[15px] font-bold">Proiecte</div>
              <FormModal trigger="Proiect nou" title="Proiect nou" size="sm">
                <ActionForm action={createProjectForClient.bind(null, client.id)} className="grid gap-4">
                  <TextInput name="name" label="Nume proiect" placeholder="Apartament Pipera" />
                  <TextArea name="description" label="Descriere" rows={2} />
                  <TextInput name="deadlineAt" label="Deadline promis (dacă e știut)" type="date" required={false} mono />
                  {client.stage === 'LEAD' && <p className="text-[12px] text-muted-foreground">Leadul trece la Calificat.</p>}
                  <div><SubmitButton>Creează proiectul</SubmitButton></div>
                </ActionForm>
              </FormModal>
            </div>
            {client.projects.length === 0 ? (
              <div className="px-5 py-6 text-center text-[13px] text-muted-foreground">Niciun proiect încă.</div>
            ) : (
              client.projects.map((p) => {
                const d = p.deadlineAt ? daysFromToday(p.deadlineAt) : null;
                return (
                  <Link key={p.id} href={`/proiecte/${p.id}`} className="flex items-center justify-between gap-3 border-b px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/50">
                    <div>
                      <div className="text-[13.5px] font-semibold">{p.name}</div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">
                        {p.deadlineAt ? (
                          <span className={cn('font-mono', d != null && d < 7 ? 'text-red-600' : '')}>deadline {fmtDate.format(p.deadlineAt)}</span>
                        ) : 'fără deadline'}
                        {' · '}{p.quotes.length} {p.quotes.length === 1 ? 'ofertă' : 'oferte'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <ProjectStatusPill status={p.status} className="px-2 py-px text-[10.5px]" />
                      <span className="font-mono text-[12.5px] font-semibold">{p.contractValue > 0 ? fmtLei(p.contractValue) : '—'}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* ───── coloana dreaptă: timeline unificat (notițe + evenimente, ale clientului și ale proiectelor lui) ───── */}
        <Timeline
          entries={timeline}
          target={{ clientId: client.id }}
          baseHref={`/clienti/${client.id}`}
          filter={parseFilter(sp.flux)}
          placeholder="Notiță pe client… (apare și pe toate proiectele lui)"
        />
      </div>
    </div>
  );
}
