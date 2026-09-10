import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { daysFromToday, fmtDate, toDateInput } from '@/lib/crm/dates';
import { loadLoans } from '@/lib/finance/loans';
import { loadAccountOptions } from '@/lib/finance/account-queries';
import { createLoan, deleteLoan, repayLoan, updateLoan } from '@/lib/finance/loan-actions';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { FormModal } from '@/components/FormModal';
import { Select, SubmitButton, TextInput } from '@/components/forms';
import { EmptyState, tableWrapCls, tdCls, thCls } from '@/components/crm/ui';

export const dynamic = 'force-dynamic';

export default async function ImprumuturiPage() {
  const [loans, accounts] = await Promise.all([loadLoans(), loadAccountOptions()]);
  const accountOptions = accounts.map((a) => ({ value: a.value, label: `${a.label} · ${fmtLei(a.balance)}` }));
  const open = loans.filter((l) => l.remaining > 0.005);
  const total = open.reduce((s, l) => s + l.remaining, 0);
  const today = toDateInput(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-muted-foreground">
          Total de returnat: <span className={cn('font-mono font-semibold text-foreground', total > 0 && 'text-red-600')}>{fmtLei(total)}</span>
          {open.length > 0 && <span className="ml-1.5">· {open.length} {open.length === 1 ? 'împrumut deschis' : 'împrumuturi deschise'}</span>}
        </div>
        <FormModal trigger="Împrumut primit" title="Împrumut primit">
          <ActionForm action={createLoan} className="grid gap-3">
            <TextInput name="lenderName" label="De la cine" placeholder="Mihai Popescu" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput name="principal" label="Sumă (lei)" placeholder="10.000" mono />
              <Select name="accountId" label="În contul" options={accountOptions} allowEmpty />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextInput name="receivedAt" label="Primit la" type="date" defaultValue={today} mono />
              <TextInput name="dueAt" label="Scadență (opțional)" type="date" required={false} mono />
            </div>
            <TextInput name="note" label="Notă" required={false} />
            <div><SubmitButton>Înregistrează</SubmitButton></div>
          </ActionForm>
        </FormModal>
      </div>

      {loans.length === 0 ? (
        <EmptyState title="Niciun împrumut" text="Banii luați de la o persoană sau firmă, de returnat. Primirea intră în cont, returnarea iese." />
      ) : (
        <div className={tableWrapCls}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>De la cine</th>
                <th className={thCls}>Primit</th>
                <th className={cn(thCls, 'text-right')}>Principal</th>
                <th className={cn(thCls, 'text-right')}>Returnat</th>
                <th className={cn(thCls, 'text-right')}>Rămas</th>
                <th className={thCls}>Scadență</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => {
                const d = l.dueAt ? daysFromToday(l.dueAt) : null;
                const closed = l.remaining <= 0.005;
                return (
                  <tr key={l.id} className={cn(closed && 'text-muted-foreground')}>
                    <td className={cn(tdCls, 'font-semibold')}>
                      {l.lenderName}
                      {l.note && <div className="text-[11.5px] font-normal text-muted-foreground">{l.note}</div>}
                      {l.receivedInto && <div className="text-[11.5px] font-normal text-muted-foreground">în {l.receivedInto}</div>}
                    </td>
                    <td className={cn(tdCls, 'whitespace-nowrap font-mono text-[12px]')}>{fmtDate.format(l.receivedAt)}</td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{fmtLei(l.principal)}</td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{fmtLei(l.returned)}</td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold', !closed && 'text-red-600')}>{closed ? 'returnat' : fmtLei(l.remaining)}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap font-mono text-[12px]', d != null && d < 30 && !closed && 'text-red-600')}>
                      {l.dueAt ? fmtDate.format(l.dueAt) : <span className="font-sans text-muted-foreground">fără scadență</span>}
                    </td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-right')}>
                      <div className="flex items-center justify-end gap-1.5">
                        {!closed && (
                          <FormModal trigger="Returnare" title={`Returnare către ${l.lenderName}`} variant="outline" size="sm">
                            <ActionForm action={repayLoan.bind(null, l.id)} className="grid gap-3">
                              <p className="text-[12.5px] text-muted-foreground">Rămas de returnat: <span className="font-mono font-semibold text-foreground">{fmtLei(l.remaining)}</span></p>
                              <Select name="accountId" label="Din contul" options={accountOptions} allowEmpty />
                              <div className="grid grid-cols-2 gap-3">
                                <TextInput name="amount" label="Sumă (lei)" defaultValue={l.remaining.toFixed(2).replace('.', ',')} mono />
                                <TextInput name="date" label="Data" type="date" defaultValue={today} mono />
                              </div>
                              <div><SubmitButton>Returnează</SubmitButton></div>
                            </ActionForm>
                          </FormModal>
                        )}
                        <FormModal trigger="Editează" title="Editează împrumutul" variant="ghost" size="sm">
                          <ActionForm action={updateLoan.bind(null, l.id)} className="grid gap-3">
                            <TextInput name="lenderName" label="De la cine" defaultValue={l.lenderName} />
                            <TextInput name="dueAt" label="Scadență" type="date" defaultValue={toDateInput(l.dueAt)} required={false} mono />
                            <TextInput name="note" label="Notă" defaultValue={l.note} required={false} />
                            {l.repayments.length > 0 && (
                              <div className="text-[12px] text-muted-foreground">
                                Returnări: {l.repayments.map((r) => `${fmtDate.format(r.date)} ${fmtLei(r.amount)} (${r.account})`).join(' · ')}
                              </div>
                            )}
                            <div><SubmitButton>Salvează</SubmitButton></div>
                          </ActionForm>
                        </FormModal>
                        <DeleteButton action={deleteLoan.bind(null, l.id)} iconOnly label="Șterge împrumutul" confirmMessage="Ștergi împrumutul cu primirea și returnările lui? Soldurile conturilor se refac." />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
