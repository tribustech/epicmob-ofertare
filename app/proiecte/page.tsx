import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { deadlineParts } from '@/lib/crm/dates';
import { countProjectTabs, loadClientOptions, loadProjectsList, type ProjectTab } from '@/lib/crm/project-queries';
import { createProject } from '@/lib/crm/project-actions';
import { ActionForm } from '@/components/ActionForm';
import { Select, SubmitButton, TextArea, TextInput } from '@/components/forms';
import { FormModal } from '@/components/FormModal';
import { LinkRow } from '@/components/crm/LinkRow';
import { EmptyState, PageHeader, ProjectStatusPill, tableWrapCls, tdCls, thCls } from '@/components/crm/ui';

export const dynamic = 'force-dynamic';

const TABS: { key: ProjectTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'montate', label: 'Montate' },
  { key: 'inchise', label: 'Închise' },
  { key: 'pierdute', label: 'Pierdute' },
];

export default async function ProiectePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab: ProjectTab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as ProjectTab) : 'active';
  const [rows, counts, clients] = await Promise.all([loadProjectsList(tab), countProjectTabs(), loadClientOptions()]);

  return (
    <div className="space-y-5">
      <PageHeader title="Proiecte">
        <FormModal trigger="Proiect nou" title="Proiect nou">
          <ActionForm action={createProject} className="grid gap-4">
            <Select name="clientId" label="Client" options={clients} allowEmpty />
            <TextInput name="name" label="Nume proiect" placeholder="Apartament Pipera" />
            <TextArea name="description" label="Descriere" rows={2} />
            <TextInput name="deadlineAt" label="Deadline promis (dacă e știut)" type="date" required={false} mono />
            <p className="text-[12px] text-muted-foreground">Clientul lipsește din listă? Creează-l întâi din Leaduri.</p>
            <div><SubmitButton>Creează proiectul</SubmitButton></div>
          </ActionForm>
        </FormModal>
      </PageHeader>

      <div className="flex items-center justify-between border-b border-[#d9d7d0]">
        <div className="flex gap-5">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/proiecte?tab=${t.key}`}
              className={cn(
                '-mb-px border-b-2 px-0.5 pb-2.5 pt-2 text-[13.5px] font-medium',
                t.key === tab ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label} <span className="font-mono text-[11.5px] text-muted-foreground">{counts[t.key]}</span>
            </Link>
          ))}
        </div>
        <div className="pb-1.5 text-[12px] text-muted-foreground">sortat după deadline</div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Niciun proiect aici" text={tab === 'active' ? 'Creează un proiect de pe un lead sau cu butonul „Proiect nou".' : undefined} />
      ) : (
        <div className={tableWrapCls}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Proiect</th>
                <th className={thCls}>Client</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Deadline</th>
                <th className={cn(thCls, 'text-right')}>Contract</th>
                <th className={cn(thCls, 'text-right')}>Încasat</th>
                <th className={cn(thCls, 'text-right')}>Cheltuit</th>
                <th className={cn(thCls, 'text-right')}>Contribuție la zi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const dl = deadlineParts(p.deadlineAt);
                return (
                  <LinkRow key={p.id} href={`/proiecte/${p.id}`}>
                    <td className={cn(tdCls, 'text-[13.5px] font-bold')}>{p.name}</td>
                    <td className={cn(tdCls, 'text-[#52525b]')}>{p.client?.name ?? <span className="text-muted-foreground">fără client</span>}</td>
                    <td className={tdCls}><ProjectStatusPill status={p.status} /></td>
                    <td className={cn(tdCls, 'whitespace-nowrap font-mono text-[12.5px]', dl.cls)}>
                      {dl.label}{dl.sub && <span className="ml-1.5 font-sans text-[11.5px] text-muted-foreground">{dl.sub}</span>}
                    </td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold')}>
                      {p.contract > 0 ? fmtLei(p.contract) : '—'}
                      <div className="font-sans text-[11px] font-normal text-muted-foreground">{p.quoteCount} {p.quoteCount === 1 ? 'ofertă' : 'oferte'}</div>
                    </td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px] text-accent-blue-foreground')}>{p.received > 0 ? fmtLei(p.received) : '—'}</td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{p.spent > 0 ? fmtLei(p.spent) : '—'}</td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold', p.contract > 0 && (p.contribution < 0 ? 'text-red-600' : 'text-emerald-700'))}>
                      {p.contract > 0 ? <>{fmtLei(p.contribution)}{p.contributionPct != null && <span className="ml-1 font-normal text-muted-foreground">{p.contributionPct}%</span>}</> : '—'}
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
