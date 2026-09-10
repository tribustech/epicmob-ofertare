import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { fmtDate } from '@/lib/crm/dates';
import { monthKey, monthLabel, parseMonthKey, shiftMonth } from '@/lib/finance/month';
import { loadMonthFigures, loadMonthSeries } from '@/lib/finance/month-report';
import { generateExpectedDocuments } from '@/lib/finance/recurring-generate';
import { MonthChart } from '@/components/finance/MonthChart';
import { microLabelCls, tableWrapCls, tdCls, thCls } from '@/components/crm/ui';

export const dynamic = 'force-dynamic';

export default async function LunaPage({ searchParams }: { searchParams: Promise<{ luna?: string }> }) {
  const sp = await searchParams;
  const key = parseMonthKey(sp.luna)?.key ?? monthKey();
  await generateExpectedDocuments();
  const [f, series] = await Promise.all([loadMonthFigures(key), loadMonthSeries(12, parseMonthKey(key)!.start)]);
  const isCurrent = key === monthKey();
  const big = 'mt-1 font-mono text-2xl font-semibold tracking-tight';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Luna</h1>
        <div className="flex items-center gap-2 text-[13.5px]">
          <Link href={`/luna?luna=${shiftMonth(key, -1)}`} className="rounded-lg border border-input px-2 py-1 hover:bg-muted">←</Link>
          <span className="min-w-[150px] text-center font-semibold">{monthLabel(key)}</span>
          <Link href={`/luna?luna=${shiftMonth(key, 1)}`} className="rounded-lg border border-input px-2 py-1 hover:bg-muted">→</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-card p-5 ring-1 ring-border">
          <div className={microLabelCls}>Venit recunoscut</div>
          <div className={big}>{fmtLei(f.revenue)}</div>
          <div className="text-[12px] text-muted-foreground">{f.mountedCount} {f.mountedCount === 1 ? 'proiect montat' : 'proiecte montate'}</div>
        </div>
        <div className="rounded-xl bg-card p-5 ring-1 ring-border">
          <div className={microLabelCls}>Contribuție</div>
          <div className={cn(big, f.contribution < 0 && 'text-red-600')}>{fmtLei(f.contribution)}</div>
          <div className="text-[12px] text-muted-foreground">− directe {fmtLei(f.direct)}</div>
        </div>
        <div className="rounded-xl bg-card p-5 ring-1 ring-border">
          <div className={microLabelCls}>Cheltuieli fixe</div>
          <div className={big}>{fmtLei(f.fixed)}</div>
          <div className="text-[12px] text-muted-foreground">inclusiv așteptate neconfirmate</div>
        </div>
        <div className={cn('rounded-xl p-5 ring-1', f.net >= 0 ? 'bg-emerald-50 ring-emerald-200' : 'bg-red-50 ring-red-200')}>
          <div className={microLabelCls}>Net lună</div>
          <div className={cn(big, f.net >= 0 ? 'text-emerald-700' : 'text-red-700')}>{fmtLei(f.net)}</div>
          <div className="text-[12px] text-muted-foreground">{isCurrent ? 'luna e în curs · se recalculează mereu' : 'contribuție − fixe'}</div>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className={tableWrapCls}>
          <div className="border-b px-5 py-3.5 text-[15px] font-bold">Proiecte montate în lună</div>
          {f.projects.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Niciun proiect montat în {monthLabel(key)}. Venitul intră în raport la starea „Montat".</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>Proiect</th>
                  <th className={cn(thCls, 'text-right')}>Contract</th>
                  <th className={cn(thCls, 'text-right')}>Direct</th>
                  <th className={cn(thCls, 'text-right')}>Contribuție</th>
                </tr>
              </thead>
              <tbody>
                {f.projects.map((p) => (
                  <tr key={p.id}>
                    <td className={tdCls}>
                      <Link href={`/proiecte/${p.id}?tab=costuri`} className="font-semibold hover:underline">{p.name}</Link>
                      <div className="text-[11.5px] text-muted-foreground">{p.client ?? 'fără client'}{p.mountedAt && ` · montat ${fmtDate.format(p.mountedAt)}`}</div>
                    </td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{fmtLei(p.contract)}</td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px]')}>{fmtLei(p.direct)}</td>
                    <td className={cn(tdCls, 'text-right font-mono text-[12.5px] font-semibold', p.contribution < 0 ? 'text-red-600' : 'text-emerald-700')}>
                      {fmtLei(p.contribution)}{p.contributionPct != null && <span className="ml-1 font-normal text-muted-foreground">{p.contributionPct}%</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="border-t px-5 py-2.5 text-[11.5px] text-muted-foreground">venit = Σ preț contract cu montaj în lună; direct = Σ alocări ale acelor proiecte, indiferent de data facturii</div>
        </div>

        <div className={tableWrapCls}>
          <div className="border-b px-5 py-3.5 text-[15px] font-bold">Cheltuieli fixe pe categorie</div>
          {f.fixedByCategory.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Nicio cheltuială indirectă în lună.</div>
          ) : (
            <ul className="divide-y">
              {f.fixedByCategory.map((c) => (
                <li key={c.category} className="flex items-center justify-between px-5 py-2.5 text-[13px]"><span>{c.category}</span><span className="font-mono font-semibold">{fmtLei(c.amount)}</span></li>
              ))}
              <li className="flex items-center justify-between px-5 py-2.5 text-[13px] font-semibold"><span>Total</span><span className="font-mono">{fmtLei(f.fixed)}</span></li>
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-card p-5 ring-1 ring-border">
        <div className="mb-3 text-[15px] font-bold">Ultimele 12 luni</div>
        <MonthChart points={series.map((s) => ({ key: s.key, contribution: s.contribution, fixed: s.fixed, net: s.net }))} />
        <details className="mt-3 text-[12.5px]">
          <summary className="cursor-pointer text-muted-foreground">Vezi ca tabel</summary>
          <table className="mt-2 w-full border-collapse">
            <thead><tr><th className={thCls}>Luna</th><th className={cn(thCls, 'text-right')}>Venit</th><th className={cn(thCls, 'text-right')}>Contribuție</th><th className={cn(thCls, 'text-right')}>Fixe</th><th className={cn(thCls, 'text-right')}>Net</th></tr></thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.key}>
                  <td className={tdCls}><Link href={`/luna?luna=${s.key}`} className="hover:underline">{monthLabel(s.key)}</Link></td>
                  <td className={cn(tdCls, 'text-right font-mono')}>{fmtLei(s.revenue)}</td>
                  <td className={cn(tdCls, 'text-right font-mono')}>{fmtLei(s.contribution)}</td>
                  <td className={cn(tdCls, 'text-right font-mono')}>{fmtLei(s.fixed)}</td>
                  <td className={cn(tdCls, 'text-right font-mono font-semibold', s.net < 0 && 'text-red-600')}>{fmtLei(s.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>

      <div className="rounded-xl bg-card p-5 ring-1 ring-border">
        <div className="flex items-center gap-2 text-[15px] font-bold">Cash-flow-ul lunii <span className="rounded-full bg-muted px-2 py-px text-[10.5px] font-semibold text-muted-foreground">nu e profit</span></div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div><div className={microLabelCls}>Intrări</div><div className="mt-1 font-mono text-xl font-semibold text-emerald-700">{fmtLei(f.cashIn)}</div></div>
          <div><div className={microLabelCls}>Ieșiri</div><div className="mt-1 font-mono text-xl font-semibold">− {fmtLei(f.cashOut)}</div></div>
          <div><div className={microLabelCls}>Net cash</div><div className={cn('mt-1 font-mono text-xl font-semibold', f.cashIn - f.cashOut < 0 && 'text-red-600')}>{fmtLei(f.cashIn - f.cashOut)}</div></div>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">Avansurile intră aici, dar nu sunt venit. Transferurile și ajustările sunt excluse.</p>
      </div>
    </div>
  );
}
