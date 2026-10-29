import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { fmtDate } from '@/lib/crm/dates';
import { DOCUMENT_KIND_LABELS, type DocumentKind } from '@/lib/finance/constants';
import { loadExpenseFormOptions } from '@/lib/finance/document-queries';
import { PAYMENT_METHOD_LABELS } from '@/lib/inbox/receipt';
import { loadSubmission, loadSubmissions, reviewDefaults } from '@/lib/inbox/review-queries';
import { approveSubmission, rejectSubmission } from '@/lib/inbox/review-actions';
import { LinkRow } from '@/components/crm/LinkRow';
import { ListCard, ListCards } from '@/components/crm/ListCard';
import { EmptyState, microLabelCls, tableWrapCls, tdCls, thCls } from '@/components/crm/ui';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton, TextInput } from '@/components/forms';
import { ExpenseForm } from '@/components/finance/ExpenseForm';
import { DocumentSheet } from '@/components/finance/DocumentSheet';

export const dynamic = 'force-dynamic';

type SP = { vezi?: string; id?: string };

const STATUS_PILL: Record<string, string> = {
  DE_VALIDAT: 'border border-amber-200 bg-amber-50 text-amber-800',
  APROBAT: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  RESPINS: 'border border-red-200 bg-red-50 text-red-700',
};
const STATUS_LABEL: Record<string, string> = { DE_VALIDAT: 'De validat', APROBAT: 'Validat', RESPINS: 'Respins' };
const payLabel = (m: string | null) => (m ? PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS] ?? m : '—');
const kindLabel = (k: string | null) => (k ? DOCUMENT_KIND_LABELS[k as DocumentKind] ?? k : 'Document');

/** Bonurile/facturile trimise prin bot, care așteaptă validarea (devin cheltuieli la aprobare). */
export default async function DeValidatPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = sp.vezi === 'istoric' ? 'istoric' : 'pending';
  const [rows, options, sub] = await Promise.all([
    loadSubmissions(view),
    loadExpenseFormOptions(),
    sp.id ? loadSubmission(sp.id) : Promise.resolve(null),
  ]);
  const base = `/finante/de-validat${view === 'istoric' ? '?vezi=istoric' : ''}`;
  const withId = (id: string) => `${base}${view === 'istoric' ? '&' : '?'}id=${id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['pending', 'istoric'] as const).map((v) => (
          <Link key={v} href={v === 'pending' ? '/finante/de-validat' : '/finante/de-validat?vezi=istoric'}
            className={cn('rounded-lg border px-2 py-1 text-[12.5px]', view === v ? 'border-foreground bg-foreground text-background' : 'border-input text-muted-foreground hover:text-foreground')}>
            {v === 'pending' ? 'De validat' : 'Istoric'}
          </Link>
        ))}
        <span className="text-[12.5px] text-muted-foreground">Trimise de colegi pe Telegram. La validare devin cheltuieli, cu poza atașată.</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={view === 'pending' ? 'Nimic de validat' : 'Niciun bon procesat încă'} text="Colegii trimit bonurile botului de Telegram; contul se conectează din Setări." />
      ) : (
        <>
          <ListCards>
            {rows.map((r) => (
              <ListCard
                key={r.id}
                href={withId(r.id)}
                title={r.counterparty ?? 'necitit'}
                subtitle={`${r.issuedAt ? fmtDate.format(r.issuedAt) : fmtDate.format(r.createdAt)} · ${kindLabel(r.kind)} · ${r.sender ?? '—'}`}
                badge={<span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_PILL[r.status])}>{STATUS_LABEL[r.status]}</span>}
                meta={<span>{r.project ?? 'proiect nedecis'} · {payLabel(r.paymentMethod)}</span>}
                right={r.amount != null ? fmtLei(r.amount) : '—'}
              />
            ))}
          </ListCards>
          <div className={cn(tableWrapCls, 'hidden sm:block')}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>Primit</th>
                  <th className={thCls}>De la</th>
                  <th className={thCls}>Furnizor</th>
                  <th className={cn(thCls, 'text-right')}>Sumă</th>
                  <th className={thCls}>Proiect</th>
                  <th className={thCls}>Plată</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <LinkRow key={r.id} href={withId(r.id)}>
                    <td className={cn(tdCls, 'whitespace-nowrap font-mono text-[12px]')}>{fmtDate.format(r.createdAt)}</td>
                    <td className={cn(tdCls, 'text-[12.5px]')}>{r.sender ?? '—'}</td>
                    <td className={cn(tdCls, 'font-semibold')}>
                      {r.counterparty ?? <span className="font-normal text-muted-foreground">necitit</span>}
                      <div className="text-[11.5px] font-normal text-muted-foreground">{kindLabel(r.kind)}{r.number && ` ${r.number}`}{r.attachments > 0 && ` · ${r.attachments} fișier(e)`}</div>
                    </td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold')}>{r.amount != null ? fmtLei(r.amount) : '—'}</td>
                    <td className={cn(tdCls, 'text-[12.5px]')}>{r.project ?? <span className="text-muted-foreground">nedecis</span>}</td>
                    <td className={cn(tdCls, 'text-[12.5px]')}>{payLabel(r.paymentMethod)}</td>
                    <td className={tdCls}>
                      <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_PILL[r.status])}>{STATUS_LABEL[r.status]}</span>
                      {r.reviewedBy && <div className="mt-0.5 text-[11px] text-muted-foreground">{r.reviewedBy}</div>}
                    </td>
                  </LinkRow>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sub && (
        <DocumentSheet title={`${kindLabel(sub.kind)} · ${sub.counterparty ?? 'necitit'}`} closeHref={base}>
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-2">
              <div className={microLabelCls}>Trimis de {sub.sender?.name ?? '—'} · {fmtDate.format(sub.createdAt)}</div>
              {sub.text && <div className="rounded-lg bg-muted px-3 py-2 text-[13px]">„{sub.text}"</div>}
              {sub.extractError && <div className="text-[12.5px] text-red-700">AI-ul nu a putut citi documentul: {sub.extractError}</div>}
              {sub.attachments.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {sub.attachments.map((a) => (
                    <a key={a.id} href={`/api/fisiere/${a.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-border">
                      {a.mime.startsWith('image/')
                        ? <img src={`/api/fisiere/${a.id}`} alt="document" className="h-48 w-full bg-muted object-contain" />
                        : <div className="flex h-24 items-center justify-center bg-muted text-[13px] font-medium">PDF · deschide</div>}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-[12.5px] text-muted-foreground">Fără fișier: plată descrisă doar în text.</div>
              )}
            </section>

            {sub.status === 'DE_VALIDAT' ? (
              <>
                <ExpenseForm
                  key={sub.id}
                  options={options}
                  action={approveSubmission.bind(null, sub.id)}
                  defaults={reviewDefaults(sub, options)}
                  submitLabel="Validează → cheltuială"
                />
                <ActionForm action={rejectSubmission.bind(null, sub.id)} className="flex items-end gap-2 border-t pt-4">
                  <div className="flex-1"><TextInput name="reason" label="Respinge (motivul ajunge la coleg)" placeholder="ex. poză neclară, e cheltuială personală" /></div>
                  <SubmitButton>Respinge</SubmitButton>
                </ActionForm>
              </>
            ) : (
              <div className="text-[13px]">
                {sub.status === 'APROBAT' && sub.documentId && <Link className="font-medium underline" href={`/finante/cheltuieli?luna=toate&doc=${sub.documentId}`}>Vezi cheltuiala creată</Link>}
                {sub.status === 'RESPINS' && <span>Respins: {sub.rejectReason}</span>}
              </div>
            )}
          </div>
        </DocumentSheet>
      )}
    </div>
  );
}
