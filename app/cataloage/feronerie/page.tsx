import { prisma } from '@/lib/db';
import { createHardware, deactivateHardware, updateHardware } from '@/lib/catalog/actions';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { DeleteButton } from '@/components/DeleteButton';
import { ActionForm } from '@/components/ActionForm';

export const dynamic = 'force-dynamic';

const CATEGORY_OPTIONS = [
  { value: 'BALAMA', label: 'Balama' },
  { value: 'SERTAR', label: 'Sertar / glisiere' },
  { value: 'MANER', label: 'Mâner' },
  { value: 'PICIOR', label: 'Picior' },
  { value: 'SINA_SUSPENDARE', label: 'Șină suspendare' },
  { value: 'ACCESORIU', label: 'Accesoriu' },
];

function HardwareFields({ h }: { h?: {
  name: string; category: string; pricePerUnit: number;
  nominalLengthMm: number | null; loadClassKg: number | null;
} }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
      <div className="col-span-2"><TextInput name="name" label="Denumire" defaultValue={h?.name} /></div>
      <Select name="category" label="Categorie" options={CATEGORY_OPTIONS} defaultValue={h?.category ?? 'BALAMA'} />
      <NumberInput name="pricePerUnit" label="Lei/buc (set)" defaultValue={h?.pricePerUnit} />
      <NumberInput name="nominalLengthMm" label="Nominală (mm)" defaultValue={h?.nominalLengthMm} required={false} />
      <NumberInput name="loadClassKg" label="Clasă (kg)" defaultValue={h?.loadClassKg} required={false} />
    </div>
  );
}

export default async function FeroneriePage() {
  const items = await prisma.hardwareItem.findMany({
    where: { active: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Feronerie</h1>
      <p className="text-sm text-neutral-600">
        La sertare/glisiere completează lungimea nominală — aplicația alege automat setul potrivit după adâncimea corpului.
      </p>
      <ul className="space-y-4">
        {items.map((h) => (
          <li key={h.id} className="rounded border bg-white p-3">
            <div className="flex items-end gap-3">
              <ActionForm action={updateHardware.bind(null, h.id)} className="grow space-y-2">
                <HardwareFields h={h} />
                <SubmitButton>Salvează</SubmitButton>
              </ActionForm>
              <DeleteButton action={deactivateHardware.bind(null, h.id)} />
            </div>
          </li>
        ))}
      </ul>
      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Adaugă feronerie</h2>
        <ActionForm action={createHardware} className="space-y-2">
          <HardwareFields />
          <SubmitButton>Adaugă</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
