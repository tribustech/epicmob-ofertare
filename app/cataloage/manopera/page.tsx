import { prisma } from '@/lib/db';
import { updateLaborRate } from '@/lib/catalog/actions';
import { NumberInput, SubmitButton } from '@/components/forms';
import { ActionForm } from '@/components/ActionForm';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  BAZA: 'Corp bază', SUSPENDAT: 'Corp suspendat', INALT: 'Corp înalt',
  SERTARE: 'Corp cu sertare', COLT: 'Corp de colț',
};

export default async function ManoperaPage() {
  const rates = await prisma.laborRate.findMany({ orderBy: { cabinetType: 'asc' } });
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Manoperă per tip de corp</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tip corp</TableHead>
              <TableHead>Tarif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((r) => (
              <TableRow key={r.cabinetType}>
                <TableCell className="font-medium">{TYPE_LABELS[r.cabinetType] ?? r.cabinetType}</TableCell>
                <TableCell>
                  <ActionForm action={updateLaborRate.bind(null, r.cabinetType)} className="flex items-end gap-3">
                    <div className="w-40">
                      <NumberInput name="price" label="Lei/corp" defaultValue={r.price} />
                    </div>
                    <SubmitButton>Salvează</SubmitButton>
                  </ActionForm>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
