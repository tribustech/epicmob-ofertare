import Link from 'next/link';
import { prisma } from '@/lib/db';
import { createProject, deleteProject, duplicateProject } from '@/lib/quote/actions';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { SubmitButton, TextInput } from '@/components/forms';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  CIORNA: 'Ciornă', TRIMISA: 'Trimisă', ACCEPTATA: 'Acceptată',
};

export default async function ProiectePage() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { cabinets: true } } },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Proiecte</h1>

      <Card>
        <CardHeader><CardTitle>Proiect nou</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={createProject} className="grid grid-cols-1 items-end gap-2 md:grid-cols-4">
            <TextInput name="name" label="Nume proiect" />
            <TextInput name="clientName" label="Client" required={false} />
            <TextInput name="clientContact" label="Contact (telefon/email)" required={false} />
            <div><SubmitButton>Creează</SubmitButton></div>
          </ActionForm>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>
                  <Link href={`/proiecte/${p.id}`} className="hover:underline">{p.name}</Link>
                </CardTitle>
                <Badge variant={p.status === 'ACCEPTATA' ? 'default' : p.status === 'TRIMISA' ? 'secondary' : 'outline'}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {p.clientName ?? 'Fără client'} · {p._count.cabinets} corpuri
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionForm action={duplicateProject.bind(null, p.id)}>
                  <Button type="submit" variant="outline" size="sm">Duplică</Button>
                </ActionForm>
                <DeleteButton action={deleteProject.bind(null, p.id)} />
              </div>
            </CardContent>
          </Card>
        ))}
        {projects.length === 0 && <p className="text-sm text-muted-foreground">Niciun proiect încă.</p>}
      </div>
    </div>
  );
}
