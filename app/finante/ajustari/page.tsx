import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { fmtDate } from '@/lib/crm/dates';
import { loadAdjustments } from '@/lib/finance/account-queries';
import { tableWrapCls, tdCls, thCls } from '@/components/crm/ui';

export const dynamic = 'force-dynamic';

export default async function AjustariPage() {
  const rows = await loadAdjustments();
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        Toate corecțiile de sold, doar pentru citire. Soldurile nu se editează direct: o diferență la numărare devine o ajustare cu motiv.
      </p>
      {rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-10 text-center text-[13px] text-muted-foreground">Nicio ajustare până acum.</div>
      ) : (
        <div className={tableWrapCls}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Data</th>
                <th className={thCls}>Cont</th>
                <th className={cn(thCls, 'text-right')}>Diferență</th>
                <th className={thCls}>Motiv</th>
                <th className={thCls}>Utilizator</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={cn(tdCls, 'whitespace-nowrap font-mono text-[12px]')}>{fmtDate.format(r.date)}</td>
                  <td className={cn(tdCls, 'font-medium')}>{r.account}</td>
                  <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold', r.amount < 0 ? 'text-red-600' : 'text-emerald-700')}>
                    {r.amount > 0 ? '+' : '−'}{fmtLei(Math.abs(r.amount))}
                  </td>
                  <td className={cn(tdCls, 'max-w-[420px]')}>{r.reason}</td>
                  <td className={cn(tdCls, 'text-[12.5px] text-muted-foreground')}>{r.user ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
