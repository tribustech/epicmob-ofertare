import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { daysFromToday, fmtDate } from '@/lib/crm/dates';
import { CLIENT_KIND_LABELS, CLIENT_STAGE_LABELS, type ClientStage } from '@/lib/crm/constants';
import { countLeadTabs, loadLeadSources, loadLeads, type LeadTab } from '@/lib/crm/client-queries';
import { createLead } from '@/lib/crm/client-actions';
import { ActionForm } from '@/components/ActionForm';
import { Select, SubmitButton, TextArea, TextInput } from '@/components/forms';
import { SidePanel } from '@/components/SidePanel';
import { LinkRow } from '@/components/crm/LinkRow';
import { ParamSelect } from '@/components/crm/ParamSelect';
import { EmptyState, PageHeader, tableWrapCls, tdCls, thCls } from '@/components/crm/ui';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const TABS: { key: LeadTab; label: string }[] = [
  { key: 'activi', label: 'Activi' },
  { key: 'pierduti', label: 'Pierduți' },
  { key: 'remarketing', label: 'Remarketing' },
];

export default async function LeaduriPage({ searchParams }: { searchParams: Promise<{ tab?: string; sursa?: string }> }) {
  const sp = await searchParams;
  const tab: LeadTab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as LeadTab) : 'activi';
  const sursa = sp.sursa?.trim() || undefined;
  const [rows, counts, sources] = await Promise.all([loadLeads(tab, sursa), countLeadTabs(), loadLeadSources()]);
  const sourceOptions = sources.map((s) => ({ value: s.name, label: s.name }));

  return (
    <div className="space-y-5">
      <PageHeader title="Leaduri">
        <SidePanel trigger="Lead nou" title="Lead nou" hint="Stage LEAD · primul contact = azi. Telefonul e opțional, dar ajută la evitarea dublurilor.">
          <ActionForm action={createLead} className="grid gap-4">
            <TextInput name="name" label="Nume" placeholder="Maria Georgescu" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput name="phone" label="Telefon" type="tel" placeholder="07xx xxx xxx" required={false} mono />
              <Select name="source" label="Sursă" options={sourceOptions} allowEmpty />
            </div>
            <TextArea name="wants" label="Ce vrea" placeholder="bucătărie 3,2 m în L, fronturi MDF vopsit…" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput name="budgetEstimate" label="Buget estimat (lei)" placeholder="25000" required={false} mono />
              <Select name="kind" label="Tip" options={Object.entries(CLIENT_KIND_LABELS).map(([value, label]) => ({ value, label }))} defaultValue="PERSOANA" />
            </div>
            <TextInput name="email" label="Email" type="email" required={false} />
            <div className="grid grid-cols-[140px_1fr] gap-3 border-t pt-4">
              <TextInput name="nextActionAt" label="Următoarea acțiune" type="date" required={false} mono />
              <TextInput name="nextActionNote" label="Ce faci" placeholder="Sună cu preț orientativ" required={false} />
            </div>
            <div className="pt-1"><SubmitButton>Creează lead</SubmitButton></div>
          </ActionForm>
        </SidePanel>
      </PageHeader>

      <div className="flex items-center justify-between border-b border-[#d9d7d0]">
        <div className="flex gap-5">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/leaduri?tab=${t.key}${sursa ? `&sursa=${encodeURIComponent(sursa)}` : ''}`}
              className={cn(
                '-mb-px border-b-2 px-0.5 pb-2.5 pt-2 text-[13.5px] font-medium',
                t.key === tab ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label} <span className="font-mono text-[11.5px] text-muted-foreground">{counts[t.key]}</span>
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-1.5">
          <ParamSelect param="sursa" options={sourceOptions} allLabel="Toate sursele" />
          {tab === 'remarketing' && (
            <Button asChild variant="outline" size="sm">
              <a href="/leaduri/export">Export CSV</a>
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={tab === 'activi' ? 'Niciun lead activ' : tab === 'pierduti' ? 'Niciun lead pierdut' : 'Nimeni la remarketing'}
          text={tab === 'activi' ? 'Adaugă primul lead cu butonul „Lead nou".' : undefined}
        />
      ) : (
        <div className={tableWrapCls}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Nume</th>
                <th className={thCls}>Telefon</th>
                <th className={thCls}>Sursă</th>
                <th className={thCls}>Ce vrea</th>
                <th className={cn(thCls, 'text-right')}>Buget</th>
                <th className={thCls}>{tab === 'pierduti' ? 'Motiv' : 'Următoarea acțiune'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const days = l.nextActionAt ? daysFromToday(l.nextActionAt) : null;
                return (
                  <LinkRow key={l.id} href={`/clienti/${l.id}`}>
                    <td className={cn(tdCls, 'text-[13.5px] font-semibold')}>
                      {l.name}
                      <div className="text-[11.5px] font-normal text-muted-foreground">
                        {CLIENT_STAGE_LABELS[l.stage as ClientStage] ?? l.stage}
                        {l.remarketing && tab !== 'remarketing' && ' · remarketing'}
                      </div>
                    </td>
                    <td className={cn(tdCls, 'font-mono text-[12.5px]')}>{l.phone ?? '—'}</td>
                    <td className={tdCls}>{l.source ?? '—'}</td>
                    <td className={cn(tdCls, 'max-w-[260px]')}>{l.wants ?? '—'}</td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{l.budgetEstimate != null ? fmtLei(l.budgetEstimate) : '—'}</td>
                    <td className={tdCls}>
                      {tab === 'pierduti' ? (
                        <span className="text-muted-foreground">{l.lostReason ?? '—'}{l.lostNote ? ` · ${l.lostNote}` : ''}</span>
                      ) : l.nextActionAt ? (
                        <>
                          <span className={cn('font-mono text-[12px]', days != null && days < 0 ? 'text-red-600' : days === 0 ? 'text-amber-700' : '')}>
                            {fmtDate.format(l.nextActionAt)}
                          </span>
                          {l.nextActionNote && <span className="text-muted-foreground"> {l.nextActionNote}</span>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </LinkRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
