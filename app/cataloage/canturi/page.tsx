import { prisma } from '@/lib/db';
import { createEdgeBand, deactivateEdgeBand, updateEdgeBand } from '@/lib/catalog/actions';
import { NumberInput, SubmitButton, TextInput } from '@/components/forms';
import { DeleteButton } from '@/components/DeleteButton';
import { ActionForm } from '@/components/ActionForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
      <h1 className="text-2xl font-semibold tracking-tight">Canturi ABS</h1>
      <div className="space-y-3">
        {bands.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex items-end gap-3">
              <ActionForm action={updateEdgeBand.bind(null, e.id)} className="grow space-y-2">
                <EdgeBandFields e={e} />
                <SubmitButton>Salvează</SubmitButton>
              </ActionForm>
              <DeleteButton action={deactivateEdgeBand.bind(null, e.id)} />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Adaugă cant</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createEdgeBand} className="space-y-2">
            <EdgeBandFields />
            <SubmitButton>Adaugă</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
