import { prisma } from '@/lib/db';
import { createMaterial, deactivateMaterial, updateMaterial } from '@/lib/catalog/actions';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { DeleteButton } from '@/components/DeleteButton';
import { ActionForm } from '@/components/ActionForm';

export const dynamic = 'force-dynamic';

const KIND_OPTIONS = [
  { value: 'PAL', label: 'PAL melaminat' },
  { value: 'MDF_MELAMINAT', label: 'MDF melaminat' },
  { value: 'MDF_INFOLIAT', label: 'MDF înfoliat' },
  { value: 'MDF_VOPSIT', label: 'MDF vopsit' },
  { value: 'PFL', label: 'PFL / HDF' },
];
const PRICING_OPTIONS = [
  { value: 'PER_SHEET', label: 'Preț per foaie' },
  { value: 'PER_SQM', label: 'Preț per m²' },
];

function MaterialFields({ m }: { m?: {
  name: string; kind: string; thicknessMm: number; sheetLengthMm: number;
  sheetWidthMm: number; pricingMode: string; pricePerSheet: number | null; pricePerSqm: number | null;
} }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-8">
      <div className="col-span-2"><TextInput name="name" label="Denumire" defaultValue={m?.name} /></div>
      <Select name="kind" label="Tip" options={KIND_OPTIONS} defaultValue={m?.kind ?? 'PAL'} />
      <NumberInput name="thicknessMm" label="Grosime (mm)" defaultValue={m?.thicknessMm ?? 18} />
      <NumberInput name="sheetLengthMm" label="Lungime foaie" defaultValue={m?.sheetLengthMm ?? 2800} />
      <NumberInput name="sheetWidthMm" label="Lățime foaie" defaultValue={m?.sheetWidthMm ?? 2070} />
      <Select name="pricingMode" label="Mod preț" options={PRICING_OPTIONS} defaultValue={m?.pricingMode ?? 'PER_SHEET'} />
      <div className="space-y-1">
        <NumberInput name="pricePerSheet" label="Lei/foaie" defaultValue={m?.pricePerSheet} required={false} />
        <NumberInput name="pricePerSqm" label="Lei/m²" defaultValue={m?.pricePerSqm} required={false} />
      </div>
    </div>
  );
}

export default async function MaterialePage() {
  const materials = await prisma.material.findMany({ where: { active: true }, orderBy: { name: 'asc' } });

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Materiale plăci</h1>

      <ul className="space-y-4">
        {materials.map((m) => (
          <li key={m.id} className="rounded border bg-white p-3">
            <div className="flex items-end gap-3">
              <ActionForm action={updateMaterial.bind(null, m.id)} className="grow space-y-2">
                <MaterialFields m={m} />
                <SubmitButton>Salvează</SubmitButton>
              </ActionForm>
              <DeleteButton action={deactivateMaterial.bind(null, m.id)} />
            </div>
          </li>
        ))}
      </ul>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Adaugă material</h2>
        <ActionForm action={createMaterial} className="space-y-2">
          <MaterialFields />
          <SubmitButton>Adaugă</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
