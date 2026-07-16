import { prisma } from '@/lib/db';
import { createHardware, deactivateHardware, updateHardware } from '@/lib/catalog/actions';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { DeleteButton } from '@/components/DeleteButton';
import { ActionForm } from '@/components/ActionForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const CATEGORY_OPTIONS = [
  { value: 'BALAMA', label: 'Balama' },
  { value: 'SERTAR', label: 'Sertar / glisiere' },
  { value: 'MANER', label: 'Mâner' },
  { value: 'PICIOR', label: 'Picior' },
  { value: 'SINA_SUSPENDARE', label: 'Șină suspendare' },
  { value: 'SUPORT_POLITA', label: 'Suport poliță' },
  { value: 'CLEMA_SOCLU', label: 'Clemă soclu' },
  { value: 'PISTON_AVENTOS', label: 'Aventos / piston' },
  { value: 'ACCESORIU', label: 'Accesoriu' },
];

function HardwareFields({ h }: { h?: {
  name: string; category: string; pricePerUnit: number;
  nominalLengthMm: number | null; loadClassKg: number | null; boxHeightMm: number | null;
} }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
      <div className="col-span-2"><TextInput name="name" label="Denumire" defaultValue={h?.name} /></div>
      <Select name="category" label="Categorie" options={CATEGORY_OPTIONS} defaultValue={h?.category ?? 'BALAMA'} />
      <NumberInput name="pricePerUnit" label="Lei/buc (set)" defaultValue={h?.pricePerUnit} />
      <NumberInput name="nominalLengthMm" label="Nominală (mm)" defaultValue={h?.nominalLengthMm} required={false} />
      <NumberInput name="loadClassKg" label="Clasă (kg)" defaultValue={h?.loadClassKg} required={false} />
      <NumberInput name="boxHeightMm" label="Laterală box (mm)" defaultValue={h?.boxHeightMm} required={false} />
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
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Feronerie</h1>
        <p className="text-sm text-muted-foreground">
          La sertare/glisiere completează lungimea nominală — aplicația alege automat setul după adâncimea corpului. La seturile Tandembox completează și înălțimea lateralei (83/115/192/224).
        </p>
      </div>
      <div className="space-y-3">
        {items.map((h) => (
          <Card key={h.id}>
            <CardContent className="flex items-end gap-3">
              <ActionForm action={updateHardware.bind(null, h.id)} className="grow space-y-2">
                <HardwareFields h={h} />
                <SubmitButton>Salvează</SubmitButton>
              </ActionForm>
              <DeleteButton action={deactivateHardware.bind(null, h.id)} />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Adaugă feronerie</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createHardware} className="space-y-2">
            <HardwareFields />
            <SubmitButton>Adaugă</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
