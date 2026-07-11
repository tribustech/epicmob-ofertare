import { prisma } from '@/lib/db';
import { createEdgeBand, deactivateEdgeBand, updateEdgeBand } from '@/lib/catalog/actions';
import { NumberInput, SubmitButton, TextInput } from '@/components/forms';
import { DeleteButton } from '@/components/DeleteButton';

export const dynamic = 'force-dynamic';

function EdgeBandFields({ e }: { e?: { name: string; thicknessMm: number; pricePerMl: number } }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <TextInput name="name" label="Denumire" defaultValue={e?.name} />
      <NumberInput name="thicknessMm" label="Grosime (mm)" defaultValue={e?.thicknessMm ?? 0.4} />
      <NumberInput name="pricePerMl" label="Lei/ml (aplicat)" defaultValue={e?.pricePerMl} />
    </div>
  );
}

export default async function CanturiPage() {
  const bands = await prisma.edgeBand.findMany({ where: { active: true }, orderBy: { thicknessMm: 'asc' } });
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Canturi ABS</h1>
      <ul className="space-y-4">
        {bands.map((e) => (
          <li key={e.id} className="rounded border bg-white p-3">
            <div className="flex items-end gap-3">
              <form action={updateEdgeBand.bind(null, e.id)} className="grow space-y-2">
                <EdgeBandFields e={e} />
                <SubmitButton>Salvează</SubmitButton>
              </form>
              <DeleteButton action={deactivateEdgeBand.bind(null, e.id)} />
            </div>
          </li>
        ))}
      </ul>
      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Adaugă cant</h2>
        <form action={createEdgeBand} className="space-y-2">
          <EdgeBandFields />
          <SubmitButton>Adaugă</SubmitButton>
        </form>
      </section>
    </div>
  );
}
