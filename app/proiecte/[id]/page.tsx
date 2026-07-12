import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Assembly } from '@prisma/client';
import { legHeightByCabinet, loadProject, toQuoteInput, tryComputeQuote, type LoadedCabinet } from '@/lib/quote/load';
import { getQuoteBasis } from '@/lib/quote/basis';
import {
  addAssembly, addCabinet, addFreeLine, deleteAssembly, deleteCabinet, deleteProject,
  duplicateCabinet, refreshFrozenPrices, removeFreeLine, updateAssembly, updateProjectSettings,
} from '@/lib/quote/actions';
import { ASSEMBLY_LEG_HEIGHT_PRESETS, ASSEMBLY_NAME_PRESETS } from '@/lib/quote/assembly-presets';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtLei, fmtNum } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  BAZA: 'Bază', SUSPENDAT: 'Suspendat', INALT: 'Înalt', SERTARE: 'Sertare', COLT: 'Colț',
};
const STATUS_OPTIONS = [
  { value: 'CIORNA', label: 'Ciornă' },
  { value: 'TRIMISA', label: 'Trimisă' },
  { value: 'ACCEPTATA', label: 'Acceptată' },
];
const CATEGORY_LABELS: [key: string, label: string][] = [
  ['boards', 'Plăci'], ['edging', 'Cant ABS'], ['cuttingService', 'Debitare'],
  ['hardware', 'Feronerie'], ['labor', 'Manoperă'], ['freeLines', 'Linii libere'],
];
const NAME_PRESET_OPTIONS = ASSEMBLY_NAME_PRESETS.map((v) => ({ value: v, label: v }));
const LEG_HEIGHT_PRESET_OPTIONS = ASSEMBLY_LEG_HEIGHT_PRESETS.map((v) => ({ value: v, label: `${v} mm` }));

export default async function ProiectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  if (!data) notFound();
  const { project, assemblies, cabinets } = data;
  const legHeightMap = legHeightByCabinet(assemblies, cabinets);
  const freeLines = JSON.parse(project.freeLinesJson) as { name: string; amount: number }[];

  const basis = await getQuoteBasis(project);
  const computed = basis.kind !== 'MISSING'
    ? tryComputeQuote(toQuoteInput(project, cabinets, legHeightMap), basis.snapshot)
    : null;
  const quote = computed?.quote ?? null;
  const snapshot = basis.kind !== 'MISSING' ? basis.snapshot : null;
  const materialName = (mid: string) =>
    snapshot?.materials.find((m) => m.id === mid)?.name ?? mid;
  const bandLabel = (bid: string) =>
    snapshot?.edgeBands.find((b) => b.id === bid)?.name ?? bid;

  const cabinetsByAssembly = new Map<string, LoadedCabinet[]>();
  for (const c of cabinets) {
    if (!c.assemblyId) continue;
    const list = cabinetsByAssembly.get(c.assemblyId) ?? [];
    list.push(c);
    cabinetsByAssembly.set(c.assemblyId, list);
  }
  const unassigned = cabinets.filter((c) => !c.assemblyId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.clientName ?? 'Fără client'} {project.clientContact ? `· ${project.clientContact}` : ''}
          </p>
        </div>
        <DeleteButton action={deleteProject.bind(null, project.id)} label="Șterge proiectul" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-semibold">Ansambluri</h2>
            {assemblies.map((a) => (
              <AssemblyCard
                key={a.id}
                projectId={project.id}
                assembly={a}
                cabinets={cabinetsByAssembly.get(a.id) ?? []}
              />
            ))}
            {assemblies.length === 0 && (
              <p className="text-sm text-muted-foreground">Niciun ansamblu încă — adaugă primul mai jos.</p>
            )}

            <Card>
              <CardHeader><CardTitle>Ansamblu nou</CardTitle></CardHeader>
              <CardContent>
                <ActionForm action={addAssembly.bind(null, project.id)} className="grid grid-cols-2 items-end gap-2 md:grid-cols-4">
                  <Select name="namePreset" label="Tip (preselecție)" options={NAME_PRESET_OPTIONS} defaultValue={NAME_PRESET_OPTIONS[0].value} />
                  <TextInput name="name" label="Nume liber (opțional)" required={false} />
                  <Select name="legHeightPreset" label="Picioare (preselecție)" options={LEG_HEIGHT_PRESET_OPTIONS} defaultValue={LEG_HEIGHT_PRESET_OPTIONS[0].value} />
                  <NumberInput name="legHeightMm" label="Picioare — valoare liberă (mm)" required={false} step="1" />
                  <div className="col-span-2 md:col-span-4"><SubmitButton>Adaugă ansamblu</SubmitButton></div>
                </ActionForm>
                <p className="mt-2 text-xs text-muted-foreground">
                  Regulă: dacă un câmp liber e completat, el câștigă; altfel se folosește preselecția
                  (pentru nume, „Altul" cere numele liber).
                </p>
              </CardContent>
            </Card>
          </section>

          {unassigned.length > 0 && (
            <section>
              <Card>
                <CardHeader><CardTitle>Fără ansamblu</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Corpuri neasignate unui ansamblu (mutarea între ansambluri nu e încă disponibilă) —
                    le poți deschide, duplica sau șterge de aici.
                  </p>
                  <CabinetsTable projectId={project.id} cabinets={unassigned} />
                </CardContent>
              </Card>
            </section>
          )}

          <section>
            <Card>
              <CardHeader><CardTitle>Linii libere (blat, transport…)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm">
                  {freeLines.map((l, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="grow">{l.name} — {fmtLei(l.amount)}</span>
                      <DeleteButton action={removeFreeLine.bind(null, project.id, i)} label="Șterge" />
                    </li>
                  ))}
                  {freeLines.length === 0 && <li className="text-muted-foreground">Nicio linie liberă.</li>}
                </ul>
                <ActionForm action={addFreeLine.bind(null, project.id)} className="grid grid-cols-2 items-end gap-2 md:grid-cols-4">
                  <TextInput name="name" label="Denumire" />
                  <NumberInput name="amount" label="Suma (lei)" />
                  <div><SubmitButton>Adaugă</SubmitButton></div>
                </ActionForm>
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Setările proiectului</CardTitle></CardHeader>
            <CardContent>
              <ActionForm action={updateProjectSettings.bind(null, project.id)} className="grid grid-cols-2 items-end gap-2">
                <NumberInput name="markupPct" label="Adaos (%)" defaultValue={project.markupPct} />
                <NumberInput name="yieldFactor" label="Factor utilizare foaie (doar estimarea per corp)" defaultValue={project.yieldFactor} step="0.01" />
                <Select name="status" label="Stare" options={STATUS_OPTIONS} defaultValue={project.status} />
                <div><SubmitButton>Salvează</SubmitButton></div>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Rezumat</CardTitle>
                {basis.kind === 'LIVE' && (
                  <Badge className="bg-green-600 text-white hover:bg-green-600">Prețuri live</Badge>
                )}
                {basis.kind === 'FROZEN' && (
                  <Badge variant="outline" className="border-amber-500 text-amber-700">Prețuri înghețate</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {basis.kind === 'FROZEN' && (
                <Alert>
                  <AlertDescription>
                    Înghețate la {new Date(basis.snapshot.takenAt).toLocaleString('ro-RO')}.
                    <ActionForm action={refreshFrozenPrices.bind(null, project.id)} className="mt-2">
                      <SubmitButton>Reîmprospătează prețurile</SubmitButton>
                    </ActionForm>
                  </AlertDescription>
                </Alert>
              )}
              {basis.kind === 'MISSING' && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Proiectul e într-o stare înghețată dar nu are un calcul salvat — comută starea înapoi la
                    „Ciornă" și apoi la starea dorită pentru a genera un calcul.
                  </AlertDescription>
                </Alert>
              )}
              {computed?.error && (
                <Alert variant="destructive"><AlertDescription>{computed.error}</AlertDescription></Alert>
              )}

              {quote && snapshot && (
                <div className="space-y-4">
                  {quote.warnings.length > 0 && (
                    <ul className="space-y-1">
                      {quote.warnings.map((w, i) => (
                        <li key={i} className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                          ⚠ {w.cabinetLabel ? `${w.cabinetLabel}: ` : ''}{w.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  {quote.unresolvedHardware.length > 0 && (
                    <ul className="space-y-1">
                      {quote.unresolvedHardware.map((s, i) => (
                        <li key={i} className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                          ⚠ Feronerie fără produs implicit: {s.name} × {s.qty} — setează implicitul în Setări
                          sau editează feroneria corpului.
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Card size="sm">
                      <CardContent>
                        <div className="text-xs text-muted-foreground">Cost total</div>
                        <div className="text-xl font-bold">{fmtLei(quote.costs.totalCost)}</div>
                      </CardContent>
                    </Card>
                    <Card size="sm">
                      <CardContent>
                        <div className="text-xs text-muted-foreground">Preț de vânzare (adaos {fmtNum(project.markupPct)}%)</div>
                        <div className="text-xl font-bold">{fmtLei(quote.costs.sellPrice)}</div>
                      </CardContent>
                    </Card>
                    {quote.costs.leiPerMl !== null && (
                      <Card size="sm" className="col-span-2">
                        <CardContent>
                          <div className="text-xs text-muted-foreground">Echivalent lei/ml corpuri de bază</div>
                          <div className="text-lg font-semibold">{fmtNum(quote.costs.leiPerMl, 0)} lei/ml</div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <Table>
                    <TableBody>
                      {CATEGORY_LABELS.map(([key, label]) => (
                        <TableRow key={key}>
                          <TableCell className="text-muted-foreground">{label}</TableCell>
                          <TableCell className="text-right">{fmtLei(quote.costs.breakdown[key as keyof typeof quote.costs.breakdown])}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div>
                    <h3 className="mb-1 text-sm font-medium">Necesar de materiale</h3>
                    <ul className="text-sm">
                      {quote.costs.needs.boards.map((b) => (
                        <li key={b.materialId}>
                          {materialName(b.materialId)}: {fmtNum(b.totalAreaSqm)} m²{b.sheets !== null ? ` → ${b.sheets} foi` : ' (la m²)'}
                        </li>
                      ))}
                      {quote.costs.needs.edging.map((e) => (
                        <li key={e.edgeBandId}>{bandLabel(e.edgeBandId)}: {fmtNum(e.totalMl)} ml</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="mb-1 text-sm font-medium">Listă feronerie</h3>
                    <ul className="text-sm">
                      {quote.hardwareSummary.map((h) => (
                        <li key={h.name}>{h.qty} × {h.name}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/proiecte/${project.id}/oferta`}>Ofertă pentru client (print/PDF)</Link>
                    </Button>
                    {quote.cutList.map((f) => (
                      <Button key={f.materialId} asChild variant="outline" size="sm">
                        <a href={`/proiecte/${project.id}/export/debitare/${f.materialId}`}>CSV debitare: {f.materialName}</a>
                      </Button>
                    ))}
                    <Button asChild variant="outline" size="sm">
                      <a href={`/proiecte/${project.id}/export/feronerie`}>CSV feronerie</a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AssemblyCard({ projectId, assembly, cabinets }: {
  projectId: string; assembly: Assembly; cabinets: LoadedCabinet[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{assembly.name} <span className="font-normal text-muted-foreground">· picioare {fmtNum(assembly.legHeightMm, 0)} mm</span></CardTitle>
          <DeleteButton action={deleteAssembly.bind(null, assembly.id)} label="Șterge ansamblul" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ActionForm action={updateAssembly.bind(null, assembly.id)} className="grid grid-cols-2 items-end gap-2 md:grid-cols-4">
          <TextInput name="name" label="Nume" defaultValue={assembly.name} />
          <NumberInput name="legHeightMm" label="Picioare (mm)" defaultValue={assembly.legHeightMm} step="1" />
          <div><SubmitButton>Salvează</SubmitButton></div>
        </ActionForm>

        <CabinetsTable projectId={projectId} cabinets={cabinets} />

        <ActionForm action={addCabinet.bind(null, projectId, assembly.id)}>
          <SubmitButton>Adaugă corp</SubmitButton>
        </ActionForm>
      </CardContent>
    </Card>
  );
}

function CabinetsTable({ projectId, cabinets }: { projectId: string; cabinets: LoadedCabinet[] }) {
  if (cabinets.length === 0) {
    return <p className="text-sm text-muted-foreground">Niciun corp încă.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Corp</TableHead>
          <TableHead>Tip</TableHead>
          <TableHead>Dimensiuni (L×H×A mm)</TableHead>
          <TableHead></TableHead>
          <TableHead className="text-right">Acțiuni</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cabinets.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <Link href={`/proiecte/${projectId}/corp/${c.id}`} className="font-medium hover:underline">
                {c.input.label}
              </Link>
            </TableCell>
            <TableCell>{TYPE_LABELS[c.input.type] ?? c.input.type}</TableCell>
            <TableCell>{c.input.widthMm}×{c.input.heightMm}×{c.input.depthMm}</TableCell>
            <TableCell>{c.hardwareOverrides ? <Badge variant="secondary">feronerie editată</Badge> : null}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <ActionForm action={duplicateCabinet.bind(null, c.id)}>
                  <Button type="submit" variant="outline" size="sm">Duplică</Button>
                </ActionForm>
                <DeleteButton action={deleteCabinet.bind(null, c.id)} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
