'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { fmtLei } from '@/lib/format';
import { parseMoneyInput } from '@/lib/finance/money';
import { netAmount } from '@/lib/finance/documents';
import { DOCUMENT_KIND_LABELS } from '@/lib/finance/constants';
import { toDateInput } from '@/lib/crm/dates';
import type { ExpenseFormOptions } from '@/lib/finance/document-queries';
import type { FormState } from '@/lib/forms/form-action';
import { ActionForm } from '@/components/ActionForm';
import { fieldLabelCls, SubmitButton } from '@/components/forms';
import { AllocationRows } from './AllocationRows';

const inputCls = 'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-[14px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn('grid gap-1', className)}><span className={fieldLabelCls}>{label}</span>{children}</div>;
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-5 items-center justify-center rounded-full bg-foreground font-mono text-[11px] font-semibold text-background">{n}</span>
      <span className="text-[13.5px] font-bold">{title}</span>
    </div>
  );
}

/**
 * „Adaugă cheltuială" — un singur formular, trei pași pe același ecran:
 * 1. documentul, 2. pe ce proiect (alocări), 3. plata. Merge și în panou lateral, și pe pagină (mobil).
 */
export function ExpenseForm({ options, action, defaultProjectId, redirectTo, stacked }: {
  options: ExpenseFormOptions;
  action: (fd: FormData) => Promise<FormState>;
  defaultProjectId?: string;
  redirectTo?: string;
  stacked?: boolean; // layout vertical (mobil)
}) {
  const [amount, setAmount] = useState('');
  const [vatMode, setVatMode] = useState<'INCLUS' | 'ADAUGAT' | 'FARA'>('INCLUS');
  const [vatPct, setVatPct] = useState(String(options.vatDefaultPct));
  const [payMode, setPayMode] = useState<'PAID' | 'UNPAID'>('PAID');
  const total = useMemo(() => { const n = parseMoneyInput(amount); return Number.isFinite(n) ? n : 0; }, [amount]);
  const direct = options.categories.filter((c) => c.scope === 'DIRECT');
  const defaultCategory = direct[0]?.value ?? options.categories[0]?.value ?? '';
  const today = toDateInput(new Date());
  const cols = stacked ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <ActionForm action={action} className="flex flex-col gap-6">
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      <section className="flex flex-col gap-3">
        <Step n={1} title="Documentul" />
        <div className="rounded-lg border border-dashed border-[#d4d4d0] px-3 py-2.5 text-[12px] text-muted-foreground">
          Poza bonului / facturii — după conectarea la Cloudflare R2.
        </div>
        <div className={cn('grid gap-3', cols)}>
          <Field label="Tip">
            <select name="kind" defaultValue="BON" className={inputCls}>
              {Object.entries(DOCUMENT_KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Data">
            <input name="issuedAt" type="date" defaultValue={today} className={cn(inputCls, 'font-mono')} />
          </Field>
          <Field label="Furnizor" className={stacked ? '' : 'col-span-2'}>
            <input name="counterparty" required placeholder="OMV, Darel Distribution…" className={inputCls} />
          </Field>
          <Field label="Sumă (lei)">
            <input name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} required inputMode="decimal" placeholder="240,00" className={cn(inputCls, 'font-mono text-base')} />
          </Field>
          <Field label="Nr. document">
            <input name="number" placeholder="opțional" className={cn(inputCls, 'font-mono')} />
          </Field>
          <Field label="Categorie implicită" className={stacked ? '' : 'col-span-2'}>
            <select name="categoryId" defaultValue={options.categories.find((c) => c.scope === 'INDIRECT')?.value ?? defaultCategory} className={inputCls}>
              <optgroup label="Indirecte (firmă)">
                {options.categories.filter((c) => c.scope === 'INDIRECT').map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </optgroup>
              <optgroup label="Directe (pe proiect)">
                {direct.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </optgroup>
            </select>
          </Field>
        </div>
        {options.vatPayer && (
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted p-3">
            <Field label="TVA">
              <select name="vatMode" value={vatMode} onChange={(e) => setVatMode(e.target.value as typeof vatMode)} className={cn(inputCls, 'bg-card')}>
                <option value="INCLUS">Inclus în sumă</option>
                <option value="ADAUGAT">Se adaugă</option>
                <option value="FARA">Fără TVA</option>
              </select>
            </Field>
            <Field label="Cotă (%)">
              <input name="vatPct" value={vatPct} onChange={(e) => setVatPct(e.target.value)} inputMode="decimal" className={cn(inputCls, 'bg-card font-mono')} disabled={vatMode === 'FARA'} />
            </Field>
            <Field label="Net calculat">
              <div className="flex h-8 items-center font-mono text-[13px]">
                {fmtLei(vatMode === 'INCLUS' ? netAmount(total, Number(vatPct) || 0, true) : total)}
              </div>
            </Field>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <Step n={2} title="Pe ce proiect" />
        <AllocationRows projects={options.projects} categories={direct} total={total} defaultCategoryId={defaultCategory} defaultProjectId={defaultProjectId} />
      </section>

      <section className="flex flex-col gap-3">
        <Step n={3} title="Plata" />
        <div className="flex gap-4 text-[13.5px]">
          <label className="flex items-center gap-1.5"><input type="radio" name="payMode" value="PAID" checked={payMode === 'PAID'} onChange={() => setPayMode('PAID')} /> Am plătit</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="payMode" value="UNPAID" checked={payMode === 'UNPAID'} onChange={() => setPayMode('UNPAID')} /> Neplătit / proformă</label>
        </div>
        {payMode === 'PAID' ? (
          <div className={cn('grid gap-3', stacked ? 'grid-cols-1' : 'grid-cols-3')}>
            <Field label="Din contul">
              <select name="accountId" defaultValue={options.accounts[0]?.value ?? ''} className={inputCls}>
                {options.accounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="Data plății"><input name="payDate" type="date" defaultValue={today} className={cn(inputCls, 'font-mono')} /></Field>
            <Field label="Sumă plătită"><input name="payAmount" placeholder={amount || 'toată suma'} inputMode="decimal" className={cn(inputCls, 'font-mono')} /></Field>
          </div>
        ) : (
          <div className={cn('grid gap-3', stacked ? 'grid-cols-1' : 'grid-cols-3')}>
            <Field label="Scadență (opțional)"><input name="dueAt" type="date" className={cn(inputCls, 'font-mono')} /></Field>
          </div>
        )}
        <Field label="Notă" className="mt-1"><input name="note" placeholder="opțional" className={inputCls} /></Field>
      </section>

      <div className="flex items-center gap-3 border-t pt-4">
        <SubmitButton>Salvează cheltuiala</SubmitButton>
        <span className="text-[12px] text-muted-foreground">{total > 0 ? fmtLei(total) : 'completează suma'}{payMode === 'PAID' ? ' · plătit' : ' · neplătit'}</span>
      </div>
    </ActionForm>
  );
}
