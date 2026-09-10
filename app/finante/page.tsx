import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { fmtDate, toDateInput } from '@/lib/crm/dates';
import { ACCOUNT_KIND_LABELS, type AccountKind } from '@/lib/finance/constants';
import { loadAccountsOverview } from '@/lib/finance/account-queries';
import { adjust, createAccount, transfer, updateAccount } from '@/lib/finance/account-actions';
import { ActionForm } from '@/components/ActionForm';
import { Select, SubmitButton, TextArea, TextInput } from '@/components/forms';
import { FormModal } from '@/components/FormModal';
import { MovementText, SignedAmount } from '@/components/finance/MovementLabel';
import { microLabelCls } from '@/components/crm/ui';

export const dynamic = 'force-dynamic';

export default async function ConturiPage() {
  const accounts = await loadAccountsOverview();
  const active = accounts.filter((a) => a.active);
  const total = active.filter((a) => !a.personal).reduce((s, a) => s + a.balance, 0);
  const accountOptions = active.map((a) => ({ value: a.id, label: `${a.name} · ${fmtLei(a.balance)}` }));
  const kindOptions = Object.entries(ACCOUNT_KIND_LABELS).map(([value, label]) => ({ value, label }));
  const today = toDateInput(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-muted-foreground">
          Total conturi firmă: <span className="font-mono font-semibold text-foreground">{fmtLei(total)}</span>
          <span className="ml-1.5">· soldurile sunt calculate din mișcări</span>
        </div>
        <div className="flex gap-2">
          <FormModal trigger="Cont nou" title="Cont nou" variant="outline" size="sm">
            <ActionForm action={createAccount} className="grid gap-3">
              <TextInput name="name" label="Nume" placeholder="Cont firmă BT" />
              <Select name="kind" label="Tip" options={kindOptions} defaultValue="BANCA" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="personal" className="size-4" />
                Bani personali (ex. cardul lui Andrew) — soldul negativ apare la Datorii
              </label>
              <div><SubmitButton>Creează</SubmitButton></div>
            </ActionForm>
          </FormModal>
          <FormModal trigger="Transfer" title="Transfer între conturi" variant="outline" size="sm">
            <ActionForm action={transfer} className="grid gap-3">
              <Select name="fromAccountId" label="Din contul" options={accountOptions} allowEmpty />
              <Select name="toAccountId" label="În contul" options={accountOptions} allowEmpty />
              <div className="grid grid-cols-2 gap-3">
                <TextInput name="amount" label="Sumă (lei)" placeholder="1000" mono />
                <TextInput name="date" label="Data" type="date" defaultValue={today} mono />
              </div>
              <TextInput name="note" label="Notă" required={false} />
              <div><SubmitButton>Transferă</SubmitButton></div>
            </ActionForm>
          </FormModal>
          <FormModal trigger="Ajustare" title="Ajustare de sold" size="sm">
            <ActionForm action={adjust} className="grid gap-3">
              <Select name="accountId" label="Cont" options={accountOptions} allowEmpty />
              <div className="grid grid-cols-2 gap-3">
                <TextInput name="countedBalance" label="Sold real numărat (lei)" placeholder="0" mono />
                <TextInput name="date" label="Data" type="date" defaultValue={today} mono />
              </div>
              <TextArea name="reason" label="Motiv (obligatoriu)" rows={2} placeholder="ex. bon pierdut, diferență la numărare" required />
              <p className="text-[12px] text-muted-foreground">Aplicația calculează diferența față de soldul curent și o înregistrează ca ajustare. Toate ajustările apar în lista „Ajustări".</p>
              <div><SubmitButton>Înregistrează ajustarea</SubmitButton></div>
            </ActionForm>
          </FormModal>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => (
          <div key={a.id} className={cn('flex flex-col rounded-xl bg-card p-5 ring-1 ring-border', !a.active && 'opacity-60')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-bold">{a.name}</div>
                <div className="text-[12px] text-muted-foreground">
                  {ACCOUNT_KIND_LABELS[a.kind as AccountKind] ?? a.kind}{a.personal && ' · personal'}{!a.active && ' · inactiv'}
                </div>
              </div>
              <div className={cn('font-mono text-xl font-semibold tracking-tight', a.balance < 0 && 'text-red-600')}>{fmtLei(a.balance)}</div>
            </div>
            <div className={cn(microLabelCls, 'mt-4')}>Ultimele mișcări</div>
            {a.recent.length === 0 ? (
              <div className="mt-1 text-[12.5px] text-muted-foreground">nicio mișcare</div>
            ) : (
              <ul className="mt-1 divide-y">
                {a.recent.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-1.5 text-[12.5px]">
                    <span className="min-w-0 truncate">
                      <span className="mr-2 font-mono text-[11px] text-muted-foreground">{fmtDate.format(m.date)}</span>
                      <MovementText m={m} />
                    </span>
                    <SignedAmount type={m.type} amount={m.amount} className="text-[12.5px]" />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto flex items-center justify-between pt-4">
              <Link href={`/finante/conturi/${a.id}`} className="text-[12.5px] font-medium text-accent-blue-foreground hover:underline">Registru complet →</Link>
              <FormModal trigger="Editează" title={`Editează „${a.name}"`} variant="ghost" size="sm">
                <ActionForm action={updateAccount.bind(null, a.id)} className="grid gap-3">
                  <TextInput name="name" label="Nume" defaultValue={a.name} />
                  <Select name="kind" label="Tip" options={kindOptions} defaultValue={a.kind} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="personal" defaultChecked={a.personal} className="size-4" /> Bani personali</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={a.active} className="size-4" /> Activ</label>
                  <div><SubmitButton>Salvează</SubmitButton></div>
                </ActionForm>
              </FormModal>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
