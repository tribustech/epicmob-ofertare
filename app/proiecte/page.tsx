import Link from 'next/link';
import { prisma } from '@/lib/db';
import { createProject, deleteProject, duplicateProject } from '@/lib/quote/actions';
import { isFrozenStatus } from '@/lib/quote/basis';
import { buildSnapshot } from '@/lib/quote/snapshot';
import type { SnapshotData } from '@/lib/quote/compute';
import { legHeightByCabinet, loadProject, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';
import { fmtLei } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { NewProjectPanel } from '@/components/NewProjectPanel';
import { SubmitButton, TextInput } from '@/components/forms';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  CIORNA: 'Ciornă', TRIMISA: 'Trimisă', ACCEPTATA: 'Acceptată',
};

const STATUS_PILL_CLS: Record<string, string> = {
  CIORNA: 'bg-muted text-muted-foreground',
  TRIMISA: 'border border-accent-blue-border bg-accent-blue text-accent-blue-foreground',
  ACCEPTATA: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
};

const dateFmt = new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });

type ProjectRow = {
  id: string;
  name: string;
  clientName: string | null;
  status: string;
  cabinetCount: number;
  updatedAt: Date;
  totalCost: number | null;
  sellPrice: number | null;
};

async function loadRows(): Promise<ProjectRow[]> {
  const ids = await prisma.project.findMany({ orderBy: { updatedAt: 'desc' }, select: { id: true } });
  const liveSnapshot = ids.length > 0 ? await buildSnapshot() : null;
  const rows: ProjectRow[] = [];
  for (const { id } of ids) {
    const loaded = await loadProject(id);
    if (!loaded) continue;
    const { project, assemblies, cabinets } = loaded;
    let totalCost: number | null = null;
    let sellPrice: number | null = null;
    try {
      const snapshot: SnapshotData | null = isFrozenStatus(project.status)
        ? (project.snapshotJson ? (JSON.parse(project.snapshotJson) as SnapshotData) : null)
        : liveSnapshot;
      if (snapshot) {
        const { quote } = tryComputeQuote(
          toQuoteInput(project, cabinets, legHeightByCabinet(assemblies, cabinets), assemblies),
          snapshot,
        );
        if (quote) {
          totalCost = quote.costs.totalCost;
          sellPrice = quote.costs.sellPrice;
        }
      }
    } catch {
      // snapshot corupt sau altă eroare — prețurile rămân null → „—"
    }
    rows.push({
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      status: project.status,
      cabinetCount: cabinets.length,
      updatedAt: project.updatedAt,
      totalCost,
      sellPrice,
    });
  }
  return rows;
}

function PriceStat({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">{label}</div>
      <div className={cn('mt-0.5 font-mono text-base font-semibold tracking-tight', accent && 'text-accent-blue-foreground')}>
        {value != null ? fmtLei(value) : '—'}
      </div>
    </div>
  );
}

export default async function ProiectePage() {
  const rows = await loadRows();

  return (
    <div className="space-y-5">
      <NewProjectPanel
        form={
          <ActionForm action={createProject} className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
            <TextInput name="name" label="Nume proiect" />
            <TextInput name="clientName" label="Client" required={false} />
            <TextInput name="clientContact" label="Contact (telefon/email)" required={false} />
            <div><SubmitButton>Creează</SubmitButton></div>
          </ActionForm>
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center">
          <p className="text-[15px] font-bold">Niciun proiect încă</p>
          <p className="mt-1 text-sm text-muted-foreground">Creează primul proiect ca să începi oferta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-border">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/proiecte/${p.id}`} className="text-[15px] font-bold leading-snug hover:underline">
                  {p.name}
                </Link>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                    STATUS_PILL_CLS[p.status] ?? 'bg-muted text-muted-foreground',
                  )}
                >
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
              </div>
              <div className="text-[12.5px] text-muted-foreground">
                {p.clientName ?? 'Fără client'} · <span className="font-mono">{p.cabinetCount}</span>{' '}
                {p.cabinetCount === 1 ? 'corp' : 'corpuri'} · {dateFmt.format(p.updatedAt)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <PriceStat label="Cost materiale" value={p.totalCost} />
                <PriceStat label="Preț ofertă" value={p.sellPrice} accent />
              </div>
              <div className="mt-auto flex items-center gap-2 border-t pt-3">
                <ActionForm action={duplicateProject.bind(null, p.id)}>
                  <Button type="submit" variant="ghost" size="sm">Duplică</Button>
                </ActionForm>
                <DeleteButton action={deleteProject.bind(null, p.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
