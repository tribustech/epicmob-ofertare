'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { parseMoneyInput } from '@/lib/finance/money';
import { splitEqual, unallocated } from '@/lib/finance/documents';
import { Button } from '@/components/ui/button';

export interface AllocationRow { projectId: string; amount: string; categoryId: string }
type Option = { value: string; label: string };

const inputCls = 'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * Pasul 2 din „Adaugă cheltuială": rânduri proiect + sumă + categorie, cu butoane rapide
 * („tot pe X", „împarte egal", „restul pe X") și „nealocat" calculat live. Câmpurile se numesc
 * alloc.N.* și sunt citite de acțiunea server.
 */
export function AllocationRows({ projects, categories, total, defaultCategoryId, initial, defaultProjectId }: {
  projects: Option[];
  categories: Option[];
  total: number;           // suma documentului (din pasul 1), pentru nealocat
  defaultCategoryId: string;
  initial?: AllocationRow[];
  defaultProjectId?: string;
}) {
  const [rows, setRows] = useState<AllocationRow[]>(
    initial && initial.length > 0 ? initial : defaultProjectId ? [{ projectId: defaultProjectId, amount: '', categoryId: defaultCategoryId }] : [],
  );
  const parsed = useMemo(() => rows.map((r) => ({ amount: r.amount.trim() ? parseMoneyInput(r.amount) : 0 })), [rows]);
  const allocated = parsed.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0);
  const rest = unallocated(total, parsed.map((r) => ({ amount: Number.isFinite(r.amount) ? r.amount : 0 })));
  const set = (i: number, patch: Partial<AllocationRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const fmtAmt = (n: number) => n.toFixed(2).replace('.', ',');
  const selected = rows.filter((r) => r.projectId);

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && (
        <p className="text-[12.5px] text-muted-foreground">Fără alocare, toată suma e cheltuială indirectă (pe categoria implicită).</p>
      )}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1.5fr)_110px_minmax(0,1fr)_28px] items-center gap-2">
          <select name={`alloc.${i}.projectId`} value={r.projectId} onChange={(e) => set(i, { projectId: e.target.value })} className={inputCls}>
            <option value="">— proiect —</option>
            {projects.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <input name={`alloc.${i}.amount`} value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} inputMode="decimal" placeholder="0,00" className={cn(inputCls, 'text-right font-mono')} />
          <select name={`alloc.${i}.categoryId`} value={r.categoryId} onChange={(e) => set(i, { categoryId: e.target.value })} className={inputCls}>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="h-8 text-center text-[16px] text-muted-foreground hover:text-destructive" aria-label="Șterge rândul">×</button>
        </div>
      ))}

      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="xs" onClick={() => setRows((rs) => [...rs, { projectId: '', amount: '', categoryId: defaultCategoryId }])}>+ rând</Button>
        {selected.length === 1 && total > 0 && (
          <Button type="button" variant="outline" size="xs" onClick={() => setRows((rs) => rs.map((r) => (r.projectId ? { ...r, amount: fmtAmt(total) } : r)))}>
            tot pe {projects.find((p) => p.value === selected[0].projectId)?.label.split(' · ')[0]}
          </Button>
        )}
        {selected.length >= 2 && total > 0 && (
          <Button type="button" variant="outline" size="xs" onClick={() => {
            const parts = splitEqual(total, selected.length);
            let k = 0;
            setRows((rs) => rs.map((r) => (r.projectId ? { ...r, amount: fmtAmt(parts[k++]) } : r)));
          }}>împarte egal</Button>
        )}
        {rest > 0.005 && selected.length >= 1 && (
          <Button type="button" variant="outline" size="xs" onClick={() => {
            const last = rows.map((r, i) => (r.projectId ? i : -1)).filter((i) => i >= 0).pop()!;
            setRows((rs) => rs.map((r, i) => (i === last ? { ...r, amount: fmtAmt((parseMoneyInput(r.amount) || 0) + rest) } : r)));
          }}>restul pe {projects.find((p) => p.value === selected[selected.length - 1].projectId)?.label.split(' · ')[0]}</Button>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-[12.5px]">
        <span>
          nealocat: <b className={cn('font-mono', rest < -0.005 && 'text-red-600')}>{fmtLei(rest)}</b>
          {rest > 0.005 && <span className="text-muted-foreground"> → indirect, categoria implicită</span>}
          {rest < -0.005 && <span className="text-red-600"> · depășește suma documentului</span>}
        </span>
        <span className="font-mono text-muted-foreground">alocat {fmtLei(allocated)} / {fmtLei(total)}</span>
      </div>
    </div>
  );
}
