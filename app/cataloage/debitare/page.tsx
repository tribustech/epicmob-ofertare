import { prisma } from '@/lib/db';
import { createCuttingRate, deleteCuttingRate, updateCuttingRate } from '@/lib/catalog/actions';
import { NumberInput, SubmitButton } from '@/components/forms';
import { DeleteButton } from '@/components/DeleteButton';
import { ActionForm } from '@/components/ActionForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

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
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tarife debitare (per foaie)</h1>
        <p className="text-sm text-muted-foreground">
          Se aplică tariful cu cea mai mică grosime maximă care acoperă grosimea plăcii.
        </p>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarif</TableHead>
              <TableHead className="w-px">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <ActionForm action={updateCuttingRate.bind(null, r.id)} className="flex items-end gap-3">
                    <RateFields r={r} />
                    <SubmitButton>Salvează</SubmitButton>
                  </ActionForm>
                </TableCell>
                <TableCell>
                  <DeleteButton action={deleteCuttingRate.bind(null, r.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Adaugă tarif</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createCuttingRate} className="space-y-2">
            <RateFields />
            <SubmitButton>Adaugă</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
