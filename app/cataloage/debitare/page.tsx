import { prisma } from '@/lib/db';
import { createCuttingRate, deleteCuttingRate, updateCuttingRate } from '@/lib/catalog/actions';
import { NumberInput, SubmitButton } from '@/components/forms';
import { DeleteButton } from '@/components/DeleteButton';

function RateFields({ r }: { r?: { maxThicknessMm: number; pricePerSheet: number } }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberInput name="maxThicknessMm" label="Până la grosimea (mm)" defaultValue={r?.maxThicknessMm} />
      <NumberInput name="pricePerSheet" label="Lei/foaie debitată" defaultValue={r?.pricePerSheet} />
    </div>
  );
}

export default async function DebitarePage() {
  const rates = await prisma.cuttingRate.findMany({ orderBy: { maxThicknessMm: 'asc' } });
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Tarife debitare (per foaie)</h1>
      <p className="text-sm text-neutral-600">
        Se aplică tariful cu cea mai mică grosime maximă care acoperă grosimea plăcii.
      </p>
      <ul className="space-y-4">
        {rates.map((r) => (
          <li key={r.id} className="rounded border bg-white p-3">
            <div className="flex items-end gap-3">
              <form action={updateCuttingRate.bind(null, r.id)} className="grow space-y-2">
                <RateFields r={r} />
                <SubmitButton>Salvează</SubmitButton>
              </form>
              <DeleteButton action={deleteCuttingRate.bind(null, r.id)} />
            </div>
          </li>
        ))}
      </ul>
      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Adaugă tarif</h2>
        <form action={createCuttingRate} className="space-y-2">
          <RateFields />
          <SubmitButton>Adaugă</SubmitButton>
        </form>
      </section>
    </div>
  );
}
