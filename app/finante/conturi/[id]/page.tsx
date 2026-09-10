import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { prisma } from '@/lib/db';
import { fmtDate } from '@/lib/crm/dates';
import { ACCOUNT_KIND_LABELS, MOVEMENT_TYPE_LABELS, type AccountKind, type MovementType } from '@/lib/finance/constants';
import { loadBalances, loadMovements } from '@/lib/finance/account-queries';
import { monthKey, monthLabel, recentMonthKeys } from '@/lib/finance/month';
import { balanceOf } from '@/lib/finance/balance';
import { MovementText, SignedAmount } from '@/components/finance/MovementLabel';
import { ParamSelect } from '@/components/crm/ParamSelect';
import { tableWrapCls, tdCls, thCls } from '@/components/crm/ui';

export const dynamic = 'force-dynamic';

export default async function RegistruContPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ luna?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) notFound();
  const luna = sp.luna === 'toate' ? null : sp.luna || monthKey();
  const [rows, balances] = await Promise.all([loadMovements(id, luna), loadBalances()]);
  const balance = balances.get(id) ?? 0;
  const periodNet = balanceOf(rows);
  const monthOptions = [{ value: 'toate', label: 'Toate lunile' }, ...recentMonthKeys(18).map((k) => ({ value: k, label: monthLabel(k) }))];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 text-[12.5px] text-muted-foreground">
        <Link href="/finante" className="hover:text-foreground">Conturi</Link><span>›</span><span className="text-foreground">{account.name}</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xl font-bold tracking-tight">{account.name}</div>
          <div className="text-[12.5px] text-muted-foreground">
            {ACCOUNT_KIND_LABELS[account.kind as AccountKind] ?? account.kind}{account.personal && ' · personal'} · sold curent{' '}
            <span className={cn('font-mono font-semibold text-foreground', balance < 0 && 'text-red-600')}>{fmtLei(balance)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] text-muted-foreground">
            {luna ? monthLabel(luna) : 'toate lunile'}: net <SignedAmount type={periodNet >= 0 ? 'IN' : 'OUT'} amount={Math.abs(periodNet)} className="text-[12.5px] font-semibold" />
          </span>
          <ParamSelect param="luna" options={monthOptions} allLabel={monthLabel(monthKey())} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-10 text-center text-[13px] text-muted-foreground">Nicio mișcare în perioada aleasă.</div>
      ) : (
        <div className={tableWrapCls}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Data</th>
                <th className={thCls}>Tip</th>
                <th className={thCls}>Explicație</th>
                <th className={cn(thCls, 'text-right')}>Sumă</th>
                <th className={thCls}>Notă</th>
                <th className={thCls}>Utilizator</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className={cn(tdCls, 'whitespace-nowrap font-mono text-[12px]')}>{fmtDate.format(m.date)}</td>
                  <td className={cn(tdCls, 'text-[12.5px]')}>{MOVEMENT_TYPE_LABELS[m.type as MovementType] ?? m.type}</td>
                  <td className={tdCls}><MovementText m={m} /></td>
                  <td className={cn(tdCls, 'text-right')}><SignedAmount type={m.type} amount={m.amount} className="text-[12.5px] font-semibold" /></td>
                  <td className={cn(tdCls, 'max-w-[260px] text-[12.5px] text-muted-foreground')}>{m.type === 'ADJUSTMENT' ? '' : m.note ?? ''}</td>
                  <td className={cn(tdCls, 'text-[12.5px] text-muted-foreground')}>{m.user ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
