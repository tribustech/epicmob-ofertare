import Link from 'next/link';
import { prisma } from '@/lib/db';
import { createProject, deleteProject, duplicateProject } from '@/lib/quote/actions';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { SubmitButton, TextInput } from '@/components/forms';

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

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Proiect nou</h2>
        <ActionForm action={createProject} className="grid grid-cols-1 items-end gap-2 md:grid-cols-4">
          <TextInput name="name" label="Nume proiect" />
          <TextInput name="clientName" label="Client" required={false} />
          <TextInput name="clientContact" label="Contact (telefon/email)" required={false} />
          <div><SubmitButton>Creează</SubmitButton></div>
        </ActionForm>
      </section>

      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center gap-4 rounded border bg-white p-3">
            <div className="grow">
              <Link href={`/proiecte/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
              <div className="text-sm text-neutral-600">
                {p.clientName ?? 'Fără client'} · {p._count.cabinets} corpuri · {STATUS_LABELS[p.status] ?? p.status}
              </div>
            </div>
            <ActionForm action={duplicateProject.bind(null, p.id)}>
              <button type="submit" className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-50">Duplică</button>
            </ActionForm>
            <DeleteButton action={deleteProject.bind(null, p.id)} />
          </li>
        ))}
        {projects.length === 0 && <li className="text-sm text-neutral-500">Niciun proiect încă.</li>}
      </ul>
    </div>
  );
}
