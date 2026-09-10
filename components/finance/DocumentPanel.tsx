import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { fmtDate, toDateInput } from '@/lib/crm/dates';
import { DOCUMENT_KIND_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_PILL, type DocumentKind } from '@/lib/finance/constants';
import type { loadDocument, ExpenseFormOptions } from '@/lib/finance/document-queries';
import { addPayment, deleteExpense, deletePayment, replaceProforma, setAllocations, updateExpense } from '@/lib/finance/document-actions';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { FormModal } from '@/components/FormModal';
import { Select, SubmitButton, TextInput } from '@/components/forms';
import { microLabelCls } from '@/components/crm/ui';
import { AllocationRows } from './AllocationRows';

type Doc = NonNullable<Awaited<ReturnType<typeof loadDocument>>>;

/** Conținutul panoului unui document: antet + editare, alocări editabile, plăți, înlocuire proformă, ștergere. */
export function DocumentPanel({ doc, options }: { doc: Doc; options: ExpenseFormOptions }) {
  const kindOptions = Object.entries(DOCUMENT_KIND_LABELS).map(([value, label]) => ({ value, label }));
  const direct = options.categories.filter((c) => c.scope === 'DIRECT');
  const categoryOptions = options.categories.map((c) => ({ value: c.value, label: `${c.label} (${c.scope === 'DIRECT' ? 'directă' : 'indirectă'})` }));
  const today = toDateInput(new Date());

  return (
    <div className="flex flex-col gap-5">
      {/* antet */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[17px] font-bold">{doc.counterparty}</div>
          <div className="text-[12.5px] text-muted-foreground">
            {DOCUMENT_KIND_LABELS[doc.kind as DocumentKind] ?? doc.kind}{doc.number && ` ${doc.number}`} · {fmtDate.format(doc.issuedAt)}
            {doc.dueAt && ` · scadent ${fmtDate.format(doc.dueAt)}`}
            {doc.categoryName && ` · ${doc.categoryName}`}
            {doc.expected && ' · așteptat (recurent)'}
          </div>
          {doc.replacesDocument && <div className="mt-1 text-[12px] text-muted-foreground">înlocuiește proforma {doc.replacesDocument.number ?? ''} de la {doc.replacesDocument.counterparty}</div>}
          {doc.note && <div className="mt-1 text-[13px]">{doc.note}</div>}
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-semibold tracking-tight">{fmtLei(doc.amount)}</div>
          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold', PAYMENT_STATUS_PILL[doc.status])}>{PAYMENT_STATUS_LABELS[doc.status]}</span>
          {doc.vatPct != null && <div className="mt-1 text-[11.5px] text-muted-foreground">TVA {doc.vatPct}% {doc.vatIncluded ? 'inclus' : 'adăugat'}</div>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FormModal trigger="Editează documentul" title="Editează documentul" variant="outline" size="sm">
          <ActionForm action={updateExpense.bind(null, doc.id)} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Select name="kind" label="Tip" options={kindOptions} defaultValue={doc.kind} />
              <TextInput name="issuedAt" label="Data" type="date" defaultValue={toDateInput(doc.issuedAt)} mono />
            </div>
            <TextInput name="counterparty" label="Furnizor" defaultValue={doc.counterparty} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput name="amount" label="Sumă (lei)" defaultValue={doc.amount.toFixed(2).replace('.', ',')} mono />
              <TextInput name="number" label="Nr. document" defaultValue={doc.number} required={false} mono />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select name="categoryId" label="Categorie implicită" options={categoryOptions} defaultValue={doc.categoryId} allowEmpty />
              <TextInput name="dueAt" label="Scadență" type="date" defaultValue={toDateInput(doc.dueAt)} required={false} mono />
            </div>
            {options.vatPayer && (
              <div className="grid grid-cols-2 gap-3">
                <Select name="vatMode" label="TVA" options={[{ value: 'INCLUS', label: 'Inclus în sumă' }, { value: 'ADAUGAT', label: 'Se adaugă' }, { value: 'FARA', label: 'Fără TVA' }]} defaultValue={doc.vatPct == null ? 'FARA' : doc.vatIncluded ? 'INCLUS' : 'ADAUGAT'} />
                <TextInput name="vatPct" label="Cotă (%)" defaultValue={doc.vatPct != null ? String(doc.vatPct) : String(options.vatDefaultPct)} required={false} mono />
              </div>
            )}
            <TextInput name="note" label="Notă" defaultValue={doc.note} required={false} />
            <div><SubmitButton>Salvează</SubmitButton></div>
          </ActionForm>
        </FormModal>
        {doc.kind === 'PROFORMA' && !doc.replacedBy && (
          <FormModal trigger="Înlocuiește cu factură" title="Factura finală" variant="outline" size="sm">
            <ActionForm action={replaceProforma.bind(null, doc.id)} className="grid gap-3">
              <p className="text-[12.5px] text-muted-foreground">Factura preia alocările și plățile proformei. Proforma rămâne în istoric ca înlocuită.</p>
              <div className="grid grid-cols-2 gap-3">
                <TextInput name="number" label="Nr. factură" required={false} mono />
                <TextInput name="issuedAt" label="Data facturii" type="date" defaultValue={today} mono />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextInput name="amount" label="Sumă (dacă diferă)" defaultValue={doc.amount.toFixed(2).replace('.', ',')} required={false} mono />
                <TextInput name="dueAt" label="Scadență" type="date" required={false} mono />
              </div>
              <div><SubmitButton>Creează factura</SubmitButton></div>
            </ActionForm>
          </FormModal>
        )}
        <DeleteButton action={deleteExpense.bind(null, doc.id)} label="Șterge documentul" confirmMessage="Ștergi documentul cu alocările și plățile lui? Banii se întorc în conturi." />
      </div>

      {/* alocări */}
      <section className="flex flex-col gap-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <div className={microLabelCls}>Alocări pe proiecte</div>
          <span className="text-[12px] text-muted-foreground">nealocat {fmtLei(doc.unallocated)} → indirect</span>
        </div>
        <ActionForm action={setAllocations.bind(null, doc.id)} className="flex flex-col gap-2">
          <AllocationRows
            projects={options.projects}
            categories={direct}
            total={doc.amount}
            defaultCategoryId={direct[0]?.value ?? ''}
            initial={doc.allocations.map((a) => ({ projectId: a.projectId, amount: a.amount.toFixed(2).replace('.', ','), categoryId: a.categoryId }))}
          />
          <div><SubmitButton>Salvează alocările</SubmitButton></div>
        </ActionForm>
      </section>

      {/* plăți */}
      <section className="flex flex-col gap-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <div className={microLabelCls}>Plăți</div>
          <span className="text-[12px] text-muted-foreground">plătit {fmtLei(doc.paid)} · rest {fmtLei(doc.remaining)}</span>
        </div>
        {doc.payments.length === 0 ? (
          <div className="text-[12.5px] text-muted-foreground">Nicio plată încă.</div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {doc.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                <span><span className="mr-2 font-mono text-[11.5px] text-muted-foreground">{fmtDate.format(p.date)}</span>{p.account.name}{p.user && <span className="text-muted-foreground"> · {p.user}</span>}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{fmtLei(p.amount)}</span>
                  <DeleteButton action={deletePayment.bind(null, p.id)} iconOnly label="Șterge plata" confirmMessage="Ștergi această plată? Banii se întorc în cont." />
                </span>
              </li>
            ))}
          </ul>
        )}
        {doc.remaining > 0 && (
          <ActionForm action={addPayment.bind(null, doc.id)} className="grid grid-cols-[minmax(0,1.4fr)_120px_110px_auto] items-end gap-2 rounded-lg bg-muted p-3">
            <Select name="accountId" label="Din contul" options={options.accounts.map((a) => ({ value: a.value, label: a.label }))} />
            <TextInput name="date" label="Data" type="date" defaultValue={today} mono />
            <TextInput name="amount" label="Sumă" defaultValue={doc.remaining.toFixed(2).replace('.', ',')} mono />
            <SubmitButton>Plătește</SubmitButton>
          </ActionForm>
        )}
      </section>

      <section className="border-t pt-4">
        <div className={microLabelCls}>Poză</div>
        <div className="mt-1 text-[12.5px] text-muted-foreground">
          {doc.attachments.length > 0 ? `${doc.attachments.length} fișier(e)` : 'Fără poză. Upload-ul vine după conectarea la Cloudflare R2.'}
        </div>
      </section>

      <div className="text-[11.5px] text-muted-foreground">adăugat de {doc.createdBy ?? 'sistem'} · {fmtDate.format(doc.createdAt)}</div>
    </div>
  );
}
