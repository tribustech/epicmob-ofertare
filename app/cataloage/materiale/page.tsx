import { prisma } from '@/lib/db';
import { createMaterial, deactivateMaterial, updateMaterial } from '@/lib/catalog/actions';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { DeleteButton } from '@/components/DeleteButton';
import { ActionForm } from '@/components/ActionForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MaterialeGalerie, type MaterialCard } from '@/components/MaterialeGalerie';

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
  hasGrain?: boolean;
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
      <label className="col-span-2 flex items-center gap-2 self-end pb-1.5 text-sm">
        <input type="checkbox" name="hasGrain" defaultChecked={m?.hasGrain ?? false} className="h-4 w-4 rounded border-input" />
        Decor cu direcție (nu e UNI)
      </label>
    </div>
  );
}

export default async function MaterialePage() {
  const materials = await prisma.material.findMany({
    where: { active: true },
    orderBy: [{ brand: 'asc' }, { name: 'asc' }],
  });

  const cards: MaterialCard[] = materials.map((m) => ({
    id: m.id,
    name: m.name,
    kind: m.kind,
    thicknessMm: m.thicknessMm,
    brand: m.brand,
    category: m.category,
    imageUrl: m.imageUrl,
    decorCode: m.decorCode,
    pricePerSheet: m.pricePerSheet,
    pricePerSqm: m.pricePerSqm,
    pricingMode: m.pricingMode,
  }));

  // Only hand-created materials (no brand) are editable inline; the seeded
  // catalog is managed via the read-only gallery above.
  const manual = materials.filter((m) => m.brand == null);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Materiale plăci</h1>

      <MaterialeGalerie materials={cards} />

      <section className="space-y-3">
        <h2 className="text-lg font-medium tracking-tight">Materiale manuale</h2>
        <p className="text-sm text-muted-foreground">
          Materialele adăugate manual (fără brand din catalog) pot fi editate sau șterse aici.
        </p>

        {manual.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex items-end gap-3">
              <ActionForm action={updateMaterial.bind(null, m.id)} className="grow space-y-2">
                <MaterialFields m={m} />
                <SubmitButton>Salvează</SubmitButton>
              </ActionForm>
              <DeleteButton action={deactivateMaterial.bind(null, m.id)} />
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Adaugă material</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createMaterial} className="space-y-2">
              <MaterialFields />
              <SubmitButton>Adaugă</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
