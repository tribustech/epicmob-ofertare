import { prisma } from '@/lib/db';
import { updateLaborRate } from '@/lib/catalog/actions';
import { NumberInput, SubmitButton } from '@/components/forms';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  BAZA: 'Corp bază', SUSPENDAT: 'Corp suspendat', INALT: 'Corp înalt',
  SERTARE: 'Corp cu sertare', COLT: 'Corp de colț',
};

export default async function ManoperaPage() {
  const rates = await prisma.laborRate.findMany({ orderBy: { cabinetType: 'asc' } });
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Manoperă per tip de corp</h1>
      <ul className="space-y-4">
        {rates.map((r) => (
          <li key={r.cabinetType} className="rounded border bg-white p-3">
            <form action={updateLaborRate.bind(null, r.cabinetType)} className="flex items-end gap-3">
              <div className="w-48 text-sm font-medium">{TYPE_LABELS[r.cabinetType] ?? r.cabinetType}</div>
              <div className="w-40"><NumberInput name="price" label="Lei/corp" defaultValue={r.price} /></div>
              <SubmitButton>Salvează</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
