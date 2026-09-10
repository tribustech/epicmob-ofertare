import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { prisma } from '@/lib/db';
import { daysFromToday, fmtDate, toDateInput } from '@/lib/crm/dates';
import { FREQUENCY_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_PILL } from '@/lib/finance/constants';
import { paymentStatus } from '@/lib/finance/documents';
import { monthKey, monthLabel, parseMonthKey } from '@/lib/finance/month';
import { generateExpectedDocuments } from '@/lib/finance/recurring-generate';
import { createRecurring, dismissExpected, setRecurringActive, updateRecurring } from '@/lib/finance/recurring-actions';
import { addPayment } from '@/lib/finance/document-actions';
import { loadAccountOptions } from '@/lib/finance/account-queries';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { FormModal } from '@/components/FormModal';
import { Select, SubmitButton, TextInput } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { EmptyState, microLabelCls, tableWrapCls, tdCls, thCls } from '@/components/crm/ui';

export const dynamic = 'force-dynamic';

const dec = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

export default async function RecurentePage() {
  await generateExpectedDocuments();
  const month = parseMonthKey(monthKey())!;
  const [templates, expected, categories, accounts] = await Promise.all([
    prisma.recurringExpense.findMany({ orderBy: [{ active: 'desc' }, { dayOfMonth: 'asc' }, { name: 'asc' }], include: { category: { select: { name: true } } } }),
    prisma.document.findMany({
      where: { recurringId: { not: null }, replacedBy: null, OR: [{ expected: true }, { issuedAt: { gte: month.start, lt: month.end } }] },
      orderBy: [{ dueAt: 'asc' }],
      include: { category: { select: { name: true } }, movements: { select: { amount: true } }, recurring: { select: { name: true } } },
    }),
    prisma.costCategory.findMany({ where: { active: true }, orderBy: [{ scope: 'desc' }, { sortOrder: 'asc' }] }),
    loadAccountOptions(),
  ]);
  const rows = expected.map((d) => {
    const amount = dec(d.amount); const paid = d.movements.reduce((s, m) => s + dec(m.amount), 0);
    return { id: d.id, name: d.recurring?.name ?? d.counterparty, counterparty: d.counterparty, category: d.category?.name ?? '—', dueAt: d.dueAt, amount, paid, status: paymentStatus(amount, paid), expected: d.expected, periodKey: d.periodKey };
  });
  const expectedTotal = rows.filter((r) => r.status !== 'PLATIT').reduce((s, r) => s + r.amount - r.paid, 0);
  const categoryOptions = categories.map((c) => ({ value: c.id, label: `${c.name} (${c.scope === 'DIRECT' ? 'directă' : 'indirectă'})` }));
  const accountOptions = accounts.map((a) => ({ value: a.value, label: `${a.label} · ${fmtLei(a.balance)}` }));
  const freqOptions = Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value, label }));
  const today = toDateInput(new Date());

  const TemplateForm = ({ t }: { t?: (typeof templates)[number] }) => (
    <ActionForm action={t ? updateRecurring.bind(null, t.id) : createRecurring} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <TextInput name="name" label="Nume" defaultValue={t?.name} placeholder="Chirie atelier" />
        <TextInput name="counterparty" label="Furnizor / persoană" defaultValue={t?.counterparty} required={false} placeholder="opțional" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextInput name="amount" label="Sumă (lei)" defaultValue={t ? dec(t.amount).toFixed(2).replace('.', ',') : ''} placeholder="3000" mono />
        <Select name="categoryId" label="Categorie" options={categoryOptions} defaultValue={t?.categoryId} allowEmpty />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Select name="frequency" label="Frecvență" options={freqOptions} defaultValue={t?.frequency ?? 'LUNAR'} />
        <TextInput name="dayOfMonth" label="Ziua din lună" defaultValue={String(t?.dayOfMonth ?? 5)} mono />
        <TextInput name="startsAt" label="Începe din" type="date" defaultValue={t ? toDateInput(t.startsAt) : today} mono />
      </div>
      <TextInput name="endsAt" label="Se termină la (opțional)" type="date" defaultValue={toDateInput(t?.endsAt)} required={false} mono />
      {t && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={t.active} className="size-4" /> Activ</label>}
      <p className="text-[12px] text-muted-foreground">Salariile se pun per persoană, categoria Salarii, plus o recurentă „Taxe salariale" la Taxe stat.</p>
      <div><SubmitButton>{t ? 'Salvează' : 'Creează șablonul'}</SubmitButton></div>
    </ActionForm>
  );

  return (
    <div className="space-y-5">
      <div className={tableWrapCls}>
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <div className="text-[15px] font-bold">Așteptate luna asta <span className="ml-1.5 font-medium text-muted-foreground">· {monthLabel(month.key)}</span></div>
          <span className={cn('font-mono text-[13px] font-semibold', expectedTotal > 0 && 'text-red-600')}>{fmtLei(expectedTotal)}</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Nimic așteptat. Creează un șablon mai jos (chirie, salarii, contabilitate…).</div>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => {
              const d = r.dueAt ? daysFromToday(r.dueAt) : null;
              return (
                <li key={r.id} className="grid grid-cols-[minmax(0,1.6fr)_120px_130px_110px_auto] items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold">{r.name}{r.counterparty !== r.name && <span className="font-normal text-muted-foreground"> · {r.counterparty}</span>}</div>
                    <div className="text-[11.5px] text-muted-foreground">{r.category}{r.periodKey && ` · ${monthLabel(r.periodKey)}`}</div>
                  </div>
                  <span className={cn('font-mono text-[12px]', d != null && d < 0 && r.status !== 'PLATIT' ? 'text-red-600' : 'text-muted-foreground')}>{r.dueAt ? fmtDate.format(r.dueAt) : '—'}</span>
                  <span className="text-right font-mono text-[12.5px] font-semibold">{fmtLei(r.amount)}</span>
                  <span className={cn('inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold', PAYMENT_STATUS_PILL[r.status])}>{PAYMENT_STATUS_LABELS[r.status]}</span>
                  <div className="flex items-center justify-end gap-1.5">
                    {r.status !== 'PLATIT' && (
                      <FormModal trigger="Confirmă plata" title={`Plată · ${r.name}`} size="sm">
                        <ActionForm action={addPayment.bind(null, r.id)} className="grid gap-3">
                          <Select name="accountId" label="Din contul" options={accountOptions} allowEmpty />
                          <div className="grid grid-cols-2 gap-3">
                            <TextInput name="amount" label="Sumă (lei)" defaultValue={(r.amount - r.paid).toFixed(2).replace('.', ',')} mono />
                            <TextInput name="date" label="Data" type="date" defaultValue={today} mono />
                          </div>
                          <div><SubmitButton>Confirmă</SubmitButton></div>
                        </ActionForm>
                      </FormModal>
                    )}
                    {r.expected && r.paid === 0 && (
                      <DeleteButton action={dismissExpected.bind(null, r.id)} iconOnly label="Nu a fost luna asta" confirmMessage="Ștergi documentul așteptat? Se regenerează doar dacă modifici șablonul." />
                    )}
                    <Button asChild variant="ghost" size="sm"><Link href={`/finante/cheltuieli?luna=toate&doc=${r.id}`}>Deschide</Link></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={tableWrapCls}>
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <div className="text-[15px] font-bold">Șabloane</div>
          <FormModal trigger="Șablon nou" title="Cheltuială recurentă" size="sm"><TemplateForm /></FormModal>
        </div>
        {templates.length === 0 ? (
          <EmptyState title="Niciun șablon" text="Chirie, utilități, contabilitate, salarii per persoană, abonamente." />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Nume</th>
                <th className={cn(thCls, 'text-right')}>Sumă</th>
                <th className={thCls}>Frecvență</th>
                <th className={thCls}>Ziua</th>
                <th className={thCls}>Categorie</th>
                <th className={thCls}>Activ</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className={cn(!t.active && 'text-muted-foreground')}>
                  <td className={cn(tdCls, 'font-semibold')}>{t.name}{t.counterparty && <div className="text-[11.5px] font-normal text-muted-foreground">{t.counterparty}</div>}</td>
                  <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{fmtLei(dec(t.amount))}</td>
                  <td className={cn(tdCls, 'text-[12.5px]')}>{FREQUENCY_LABELS[t.frequency as keyof typeof FREQUENCY_LABELS] ?? t.frequency}</td>
                  <td className={cn(tdCls, 'font-mono text-[12.5px]')}>{t.dayOfMonth}</td>
                  <td className={cn(tdCls, 'text-[12.5px]')}>{t.category.name}</td>
                  <td className={tdCls}><span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', t.active ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground')}>{t.active ? 'Activ' : 'Inactiv'}</span></td>
                  <td className={cn(tdCls, 'text-right')}>
                    <div className="flex items-center justify-end gap-1.5">
                      <FormModal trigger="Editează" title={`Editează „${t.name}"`} variant="outline" size="sm"><TemplateForm t={t} /></FormModal>
                      <ActionForm action={setRecurringActive.bind(null, t.id, !t.active)} confirm={t.active ? 'Dezactivezi șablonul? Documentele așteptate neplătite se șterg.' : undefined}>
                        <Button type="submit" variant="ghost" size="sm" className={cn(t.active && 'text-destructive')}>{t.active ? 'Dezactivează' : 'Activează'}</Button>
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className={cn(microLabelCls, 'normal-case tracking-normal')}>Documentele așteptate se generează automat la deschiderea acestei pagini sau a Dashboard-ului, pentru fiecare perioadă lipsă.</p>
    </div>
  );
}
