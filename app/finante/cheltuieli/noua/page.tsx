import Link from 'next/link';
import { loadExpenseFormOptions } from '@/lib/finance/document-queries';
import { createExpense } from '@/lib/finance/document-actions';
import { ExpenseForm } from '@/components/finance/ExpenseForm';

export const dynamic = 'force-dynamic';

/** Varianta verticală (telefon) a formularului „Adaugă cheltuială": bonul se pozează la magazin. */
export default async function CheltuialaNouaPage({ searchParams }: { searchParams: Promise<{ proiect?: string }> }) {
  const [{ proiect }, options] = await Promise.all([searchParams, loadExpenseFormOptions()]);
  // venit dintr-un proiect → după salvare / anulare ne întoarcem la proiect, nu în Finanțe
  const backHref = proiect ? `/proiecte/${proiect}?tab=costuri` : '/finante/cheltuieli';
  return (
    <div className="mx-auto max-w-[520px] space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-bold">Cheltuială nouă</div>
        <Link href={backHref} className="text-[13px] font-medium text-muted-foreground hover:text-foreground">Anulează</Link>
      </div>
      <div className="rounded-xl bg-card p-5 ring-1 ring-border">
        <ExpenseForm options={options} action={createExpense} defaultProjectId={proiect} redirectTo={proiect ? backHref : undefined} stacked />
      </div>
    </div>
  );
}
