import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, Copy } from 'lucide-react';
import type { Assembly } from '@prisma/client';
import { legHeightByCabinet, loadQuote, toQuoteInput, tryComputeQuote, type LoadedCabinet } from '@/lib/quote/load';
import type { CabinetIssue } from '@/lib/quote/compute';
import { getQuoteBasis } from '@/lib/quote/basis';
import { HANDLE_TYPE_OPTIONS } from '@/lib/quote/handle';
import { prisma } from '@/lib/db';
import {
  addAssembly, addCabinet, addFreeLine, addLoosePanel, copyAssemblyToQuote, deleteAssembly, deleteCabinet, deleteQuote,
  duplicateCabinet, refreshFrozenPrices, removeFreeLine, removeLoosePanel, updateAssembly, updateQuoteDetails, updateQuoteSettings,
} from '@/lib/quote/actions';
import { ASSEMBLY_LEG_HEIGHT_PRESETS, ASSEMBLY_NAME_PRESETS } from '@/lib/quote/assembly-presets';
import { isCabinetInputComplete } from '@/lib/quote/cabinet-form';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { AssemblyKindFields } from '@/components/AssemblyKindFields';
import { AssemblyAddModal, AssemblyCardShell } from '@/components/AssemblyShell';
import type { MaterialPickerItem } from '@/components/MaterialPicker';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtLei, fmtNum } from '@/lib/format';
import { CabinetRow } from './CabinetRow';
import {
  BulkCabinetEditor, type BulkFrontModel, type BulkFrontSupplier,
} from '@/components/BulkCabinetEditor';
import { getRalColors } from '@/lib/ral';
import { loadQuoteContext } from '@/lib/crm/project-queries';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  BAZA: 'Bază', SUSPENDAT: 'Suspendat', INALT: 'Înalt', COLT: 'Colț', BLAT: 'Blat',
};
// ACCEPTATA se setează doar din pagina proiectului („Acceptă oferta"), unde se îngheață și prețul
const STATUS_OPTIONS = [
  { value: 'CIORNA', label: 'Ciornă' },
  { value: 'TRIMISA', label: 'Trimisă' },
  { value: 'RESPINSA', label: 'Respinsă' },
];
const STATUS_LABELS: Record<string, string> = { CIORNA: 'Ciornă', TRIMISA: 'Trimisă', ACCEPTATA: 'Acceptată', RESPINSA: 'Respinsă' };
const CATEGORY_LABELS: [key: string, label: string][] = [
  ['boards', 'Plăci'], ['edging', 'Cant ABS'], ['cuttingService', 'Debitare'],
  ['hardware', 'Feronerie'], ['labor', 'Manoperă'], ['freeLines', 'Linii libere'],
];
const EDGE_MODE_OPTIONS = [
  { value: 'NONE', label: 'Fără cant' },
  { value: 'L1', label: '1 latură lungă' },
  { value: 'L2', label: '2 laturi lungi' },
  { value: 'ALL', label: 'Jur-împrejur (4 laturi)' },
];
const EDGE_MODE_LABEL: Record<string, string> = { L1: '1 latură', L2: '2 laturi lungi', ALL: 'jur-împrejur' };
const NAME_PRESET_OPTIONS = ASSEMBLY_NAME_PRESETS.map((v) => ({ value: v, label: v }));
const LEG_HEIGHT_PRESET_OPTIONS = ASSEMBLY_LEG_HEIGHT_PRESETS.map((v) => ({ value: v, label: `${v} mm` }));
const PLINTH_MODE_OPTIONS = [
  { value: 'NONE', label: 'Fără plintă' },
  { value: 'ASSEMBLY', label: 'Plintă pe tot ansamblul' },
  { value: 'CABINETS', label: 'Plintă doar pe corpurile selectate' },
];

/** Motivele problemelor unui corp (incomplet / feronerie nerezolvată / avertismente). */
function cabinetReasons(issue: CabinetIssue | undefined, incomplete: boolean): string[] {
  if (incomplete) return ['incomplet'];
  if (!issue) return [];
  const cats = new Set(issue.unresolvedHardware.map((s) => s.category));
  const reasons: string[] = [];
  if (cats.has('MANER')) reasons.push('mâner neales');
  if ([...cats].some((c) => c !== 'MANER')) reasons.push('feronerie de configurat');
  if (issue.warnings.length > 0) reasons.push('avertismente');
  return reasons;
}

/** Detaliul problemelor unui corp, cu cantități — pentru numărul roșu + popover pe rând. */
function cabinetProblems(issue: CabinetIssue | undefined, incomplete: boolean): { label: string; qty: number }[] {
  if (incomplete) return [{ label: 'Corp incomplet — completează dimensiunile', qty: 1 }];
  if (!issue) return [];
  const byName = new Map<string, number>();
  for (const s of issue.unresolvedHardware) byName.set(s.name, (byName.get(s.name) ?? 0) + s.qty);
  const items = [...byName.entries()].map(([label, qty]) => ({ label, qty }));
  for (const w of issue.warnings) items.push({ label: w.message, qty: 1 });
  return items;
}

export default async function ProiectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadQuote(id);
  if (!data) notFound();
  const { quote: quoteRow, assemblies, cabinets } = data;
  const ctx = await loadQuoteContext(id);
  const legHeightMap = legHeightByCabinet(assemblies, cabinets);
  const freeLines = JSON.parse(quoteRow.freeLinesJson) as { name: string; amount: number; inCommission?: boolean }[];
  const loosePanels = JSON.parse(quoteRow.loosePanelsJson ?? '[]') as { name?: string; materialId: string; lengthMm: number; widthMm: number; qty: number; edgeBandId?: string; edgeMode?: 'NONE' | 'L1' | 'L2' | 'ALL' }[];
  const [handleProducts, blatMaterials, bulkMaterials, frontSuppliers, frontModels, edgeBands, otherQuotes] = await Promise.all([
    prisma.hardwareItem.findMany({
      where: { active: true, category: { in: ['MANER', 'ACCESORIU'] } },
      orderBy: { name: 'asc' },
    }),
    prisma.material.findMany({
      where: { active: true, category: 'BLAT' },
      orderBy: { name: 'asc' },
    }),
    prisma.material.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    }),
    prisma.frontSupplier.findMany({
      where: { active: true, productType: 'VOPSIT' }, orderBy: { name: 'asc' },
    }),
    prisma.frontModel.findMany({
      where: { active: true, supplier: { active: true, productType: 'VOPSIT' } },
      orderBy: [{ tier: 'asc' }, { code: 'asc' }],
    }),
    prisma.edgeBand.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.quote.findMany({ where: { id: { not: id } }, select: { id: true, name: true }, orderBy: { updatedAt: 'desc' } }),
  ]);
  const blatMaterialItems = blatMaterials.map((m) => ({
    id: m.id, name: m.name, kind: m.kind, thicknessMm: m.thicknessMm, brand: m.brand,
    category: m.category, imageUrl: m.imageUrl, decorCode: m.decorCode,
    pricePerSheet: m.pricePerSheet, pricePerSqm: m.pricePerSqm, pricingMode: m.pricingMode, active: m.active,
  }));
  const bulkMaterialItems: MaterialPickerItem[] = bulkMaterials.filter((m) => m.category !== 'BLAT').map((m) => ({
    id: m.id, name: m.name, kind: m.kind, thicknessMm: m.thicknessMm, brand: m.brand,
    category: m.category, imageUrl: m.imageUrl, decorCode: m.decorCode,
    pricePerSheet: m.pricePerSheet, pricePerSqm: m.pricePerSqm, pricingMode: m.pricingMode, active: m.active,
  }));
  const bulkFrontSuppliers: BulkFrontSupplier[] = frontSuppliers.map((supplier) => ({
    id: supplier.id, name: supplier.name,
  }));
  const bulkEdgeBands = edgeBands.map((b) => ({ id: b.id, name: b.name, thicknessMm: b.thicknessMm }));
  const bulkFrontModels: BulkFrontModel[] = frontModels.map((model) => ({
    id: model.id, supplierId: model.supplierId, code: model.code, name: model.name, tier: model.tier,
    collection: model.collection, shapeFamily: model.shapeFamily, imageUrl: model.imageUrl,
  }));
  const ralColors = getRalColors().map((color) => ({
    code: color.code, num: color.num, name_en: color.name_en, hex: color.hex,
    vivid: color.vivid, black: color.black,
  }));

  const basis = await getQuoteBasis(quoteRow);
  const computed = basis.kind !== 'MISSING'
    ? tryComputeQuote(toQuoteInput(quoteRow, cabinets, legHeightMap, assemblies), basis.snapshot)
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

  const issueByCabinetId = new Map<string, CabinetIssue>();
  for (const it of quote?.cabinetIssues ?? []) issueByCabinetId.set(it.cabinetId, it);

  return (
    <div className="space-y-6">
      <div className="flex gap-1.5 text-[12.5px] text-muted-foreground">
        <Link href="/proiecte" className="hover:text-foreground">Proiecte</Link>
        {ctx?.project?.client && (
          <><span>›</span><Link href={`/clienti/${ctx.project.client.id}`} className="hover:text-foreground">{ctx.project.client.name}</Link></>
        )}
        {ctx?.project && (
          <><span>›</span><Link href={`/proiecte/${ctx.project.id}`} className="hover:text-foreground">{ctx.project.name}</Link></>
        )}
        <span>›</span>
        <span className="text-foreground">Oferta v{ctx?.version ?? quoteRow.version}</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            {quoteRow.name}
            <span className="ml-2 font-mono text-[13px] font-medium text-muted-foreground">v{quoteRow.version}</span>
            {quoteRow.label && <span className="ml-1.5 text-[13px] font-medium text-muted-foreground">· {quoteRow.label}</span>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ctx?.project?.client?.name ?? quoteRow.clientName ?? 'Fără client'}
            {!ctx?.project && quoteRow.clientContact ? ` · ${quoteRow.clientContact}` : ''}
            {' · '}{STATUS_LABELS[quoteRow.status] ?? quoteRow.status}
            {quoteRow.status === 'ACCEPTATA' && quoteRow.acceptedPrice != null && ` · preț contract ${fmtLei(quoteRow.acceptedPrice.toNumber())}`}
          </p>
        </div>
        <DeleteButton action={deleteQuote.bind(null, quoteRow.id)} label="Șterge oferta" confirmMessage="Sigur ștergi această ofertă, cu toate corpurile ei?" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-semibold">Ansambluri</h2>
            {assemblies.map((a) => (
              <AssemblyCard
                key={a.id}
                quoteId={quoteRow.id}
                assembly={a}
                cabinets={cabinetsByAssembly.get(a.id) ?? []}
                issues={issueByCabinetId}
                blatMaterials={blatMaterialItems}
                bulkMaterials={bulkMaterialItems}
                bulkFrontSuppliers={bulkFrontSuppliers}
                bulkFrontModels={bulkFrontModels}
                ralColors={ralColors}
                otherQuotes={otherQuotes}
                edgeBands={bulkEdgeBands}
              />
            ))}
            {assemblies.length === 0 && (
              <p className="text-sm text-muted-foreground">Niciun ansamblu încă — adaugă primul mai jos.</p>
            )}

            <AssemblyAddModal>
              <ActionForm action={addAssembly.bind(null, quoteRow.id)} className="grid items-end gap-3 sm:grid-cols-2">
                <Select name="namePreset" label="Tip (preselecție)" options={NAME_PRESET_OPTIONS} defaultValue={NAME_PRESET_OPTIONS[0].value} />
                <TextInput name="name" label="Nume liber (opțional)" required={false} />
                <Select name="legHeightPreset" label="Picioare (preselecție)" options={LEG_HEIGHT_PRESET_OPTIONS} defaultValue={LEG_HEIGHT_PRESET_OPTIONS[0].value} />
                <NumberInput name="legHeightMm" label="Picioare — valoare liberă (mm)" required={false} step="1" />
                <Select name="plinthMode" label="Plintă (100 mm)" options={PLINTH_MODE_OPTIONS} defaultValue="NONE" />
                <AssemblyKindFields blatMaterials={blatMaterialItems} />
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Regulă: dacă un câmp liber e completat, el câștigă; altfel se folosește preselecția
                  (pentru nume, „Altul" cere numele liber).
                </p>
                <div className="sm:col-span-2"><SubmitButton>Adaugă ansamblu</SubmitButton></div>
              </ActionForm>
            </AssemblyAddModal>
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
                  <CabinetsTable quoteId={quoteRow.id} cabinets={unassigned} issues={issueByCabinetId} />
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
                      <span className="grow">
                        {l.name} — {fmtLei(l.amount)}
                        {l.inCommission && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            în comision
                          </span>
                        )}
                      </span>
                      <DeleteButton action={removeFreeLine.bind(null, quoteRow.id, i)} label="Șterge" />
                    </li>
                  ))}
                  {freeLines.length === 0 && <li className="text-muted-foreground">Nicio linie liberă.</li>}
                </ul>
                <ActionForm action={addFreeLine.bind(null, quoteRow.id)} className="grid grid-cols-2 items-end gap-2 md:grid-cols-4">
                  <TextInput name="name" label="Denumire" />
                  <NumberInput name="amount" label="Suma (lei)" />
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" name="inCommission" className="h-4 w-4 rounded border-input" />
                    <span>În comision (adaos)</span>
                  </label>
                  <div><SubmitButton>Adaugă</SubmitButton></div>
                </ActionForm>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card>
              <CardHeader><CardTitle>Plăci libere (PAL/MDF)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm">
                  {loosePanels.map((pnl, i) => {
                    const mat = bulkMaterialItems.find((m) => m.id === pnl.materialId);
                    const bandName = pnl.edgeBandId ? edgeBands.find((b) => b.id === pnl.edgeBandId)?.name : null;
                    const cant = bandName && pnl.edgeMode && pnl.edgeMode !== 'NONE'
                      ? ` · cant ${bandName} (${EDGE_MODE_LABEL[pnl.edgeMode]})` : '';
                    return (
                      <li key={i} className="flex items-center gap-3">
                        <span className="grow">
                          {pnl.name ? `${pnl.name} · ` : ''}{mat?.name ?? pnl.materialId} — {pnl.lengthMm}×{pnl.widthMm} mm × {pnl.qty} buc{cant}
                        </span>
                        <DeleteButton action={removeLoosePanel.bind(null, quoteRow.id, i)} label="Șterge" />
                      </li>
                    );
                  })}
                  {loosePanels.length === 0 && <li className="text-muted-foreground">Nicio placă liberă.</li>}
                </ul>
                <ActionForm action={addLoosePanel.bind(null, quoteRow.id)} className="grid grid-cols-2 items-end gap-2 md:grid-cols-6">
                  <div className="col-span-2"><Select name="materialId" label="Material" options={bulkMaterialItems.map((m) => ({ value: m.id, label: m.name }))} /></div>
                  <NumberInput name="lengthMm" label="Lungime (mm)" step="1" />
                  <NumberInput name="widthMm" label="Lățime (mm)" step="1" />
                  <NumberInput name="qty" label="Buc" step="1" defaultValue={1} />
                  <TextInput name="name" label="Denumire (opțional)" required={false} />
                  <div className="col-span-2"><Select name="edgeBandId" label="Cant (ABS)" options={edgeBands.map((b) => ({ value: b.id, label: b.name }))} allowEmpty /></div>
                  <div className="col-span-2"><Select name="edgeMode" label="Laturi cant" options={EDGE_MODE_OPTIONS} defaultValue="NONE" /></div>
                  <div className="col-span-2 md:col-span-6"><SubmitButton>Adaugă placă</SubmitButton></div>
                </ActionForm>
                <p className="text-xs text-muted-foreground">Plăcile libere intră în ofertă la „Plăci" — cotate din catalog și așezate pe plăci împreună cu piesele corpurilor. Cantul intră la „Cant ABS".</p>
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Detaliile proiectului</CardTitle></CardHeader>
            <CardContent>
              <ActionForm action={updateQuoteDetails.bind(null, quoteRow.id)} className="grid gap-3">
                <TextInput name="name" label="Numele proiectului" defaultValue={quoteRow.name} />
                <p className="text-[12px] text-muted-foreground">Clientul se administrează pe proiect, nu pe ofertă.</p>
                <div className="grid gap-1">
                  <label htmlFor="observatii" className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Observații (apar în ofertă)</label>
                  <textarea id="observatii" name="observatii" rows={4} defaultValue={quoteRow.observatii ?? ''}
                    placeholder="Note pentru client: termene speciale, ce nu e inclus, condiții de plată suplimentare, etc."
                    className="w-full rounded-lg border border-input bg-transparent p-2.5 text-sm outline-none focus-visible:border-ring" />
                </div>
                <div><SubmitButton>Salvează detaliile</SubmitButton></div>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Setările proiectului</CardTitle></CardHeader>
            <CardContent>
              <ActionForm action={updateQuoteSettings.bind(null, quoteRow.id)} className="grid grid-cols-2 items-end gap-2">
                <NumberInput name="laborPct" label="Manoperă (%)" defaultValue={quoteRow.laborPct} />
                <NumberInput name="yieldFactor" label="Factor utilizare foaie (doar estimarea per corp)" defaultValue={quoteRow.yieldFactor} step="0.01" />
                {quoteRow.status === 'ACCEPTATA' ? (
                  <div className="grid gap-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Stare</div>
                    <div className="text-sm">Acceptată <span className="text-muted-foreground">· prețul e înghețat; se schimbă din proiect</span></div>
                    <input type="hidden" name="status" value="TRIMISA" />
                  </div>
                ) : (
                  <Select name="status" label="Stare" options={STATUS_OPTIONS} defaultValue={quoteRow.status} />
                )}
                <Select
                  name="handleType" label="Tip mâner (proiect)"
                  options={HANDLE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  defaultValue={quoteRow.handleType}
                />
                <Select
                  name="handleItemId" label="Produs mâner implicit"
                  options={handleProducts.map((h) => ({ value: h.id, label: `${h.name} (${h.pricePerUnit} lei)` }))}
                  defaultValue={quoteRow.handleItemId}
                  allowEmpty
                />
                <div><SubmitButton>Salvează</SubmitButton></div>
              </ActionForm>
              <p className="mt-2 text-xs text-muted-foreground">Corpurile fără excepție de mâner moștenesc tipul proiectului.</p>
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
                    <ActionForm action={refreshFrozenPrices.bind(null, quoteRow.id)} className="mt-2">
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
                  {quote.cabinetIssues.length > 0 && (
                    <div className="rounded border border-amber-300 bg-amber-50 p-2">
                      <p className="text-xs font-medium text-amber-800">
                        ⚠ {quote.cabinetIssues.length} {quote.cabinetIssues.length === 1 ? 'corp necesită' : 'corpuri necesită'} atenție
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {quote.cabinetIssues.map((issue) => (
                          <li key={issue.cabinetId}>
                            <Link
                              href={`/oferte/${quoteRow.id}/corp/${issue.cabinetId}`}
                              className="text-xs text-amber-900 hover:underline"
                            >
                              → {issue.label} · {cabinetReasons(issue, issue.incomplete).join(' · ') || 'necesită atenție'}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
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
                        <div className="text-xs text-muted-foreground">Preț de vânzare (manoperă {fmtNum(quoteRow.laborPct)}%)</div>
                        <div className="text-xl font-bold">{fmtLei(quote.costs.sellPrice)}</div>
                      </CardContent>
                    </Card>
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
                          {materialName(b.materialId)}: {fmtNum(b.totalAreaSqm)} m²
                          {b.sheets !== null ? ` → ${b.sheets} ${b.sheets === 1 ? 'placă' : 'plăci'} (pierdere ${fmtNum(b.wastePct ?? 0, 1)}%)` : ' (la m²)'}
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
                      <Link href={`/oferte/${quoteRow.id}/oferta`}>Ofertă pentru client (print/PDF)</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/oferte/${quoteRow.id}/plan-debitare`}>Plan debitare (print/PDF)</Link>
                    </Button>
                    {quote.cutList.map((f) => (
                      <Button key={f.materialId} asChild variant="outline" size="sm">
                        <a href={`/oferte/${quoteRow.id}/export/debitare/${f.materialId}`}>CSV debitare: {f.materialName}</a>
                      </Button>
                    ))}
                    {quote.glassFrontList.map((f) => (
                      <Button key={`glass-${f.materialId}`} asChild variant="outline" size="sm">
                        <a href={`/oferte/${quoteRow.id}/export/debitare/${f.materialId}`}>CSV fronturi sticlă: {f.materialName}</a>
                      </Button>
                    ))}
                    {quote.glassShelfList.map((f) => (
                      <Button key={`glass-shelf-${f.materialId}`} asChild variant="outline" size="sm">
                        <a href={`/oferte/${quoteRow.id}/export/debitare/${f.materialId}`}>CSV polițe sticlă: {f.materialName}</a>
                      </Button>
                    ))}
                    <Button asChild variant="outline" size="sm">
                      <a href={`/oferte/${quoteRow.id}/export/feronerie`}>CSV feronerie</a>
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

const ASSEMBLY_KIND_LABELS: Record<string, string> = {
  FARA_BLAT: '', CU_BLAT: 'cu blat', BUCATARIE: 'bucătărie',
};

function AssemblyCard({
  quoteId, assembly, cabinets, issues, blatMaterials,
  bulkMaterials, bulkFrontSuppliers, bulkFrontModels, ralColors, otherQuotes, edgeBands,
}: {
  quoteId: string; assembly: Assembly; cabinets: LoadedCabinet[]; issues: Map<string, CabinetIssue>;
  blatMaterials: MaterialPickerItem[];
  bulkMaterials: MaterialPickerItem[];
  bulkFrontSuppliers: BulkFrontSupplier[];
  bulkFrontModels: BulkFrontModel[];
  ralColors: { code: string; num: string; name_en: string; hex: string; vivid: boolean; black: boolean }[];
  otherQuotes: { id: string; name: string }[];
  edgeBands: { id: string; name: string; thicknessMm: number }[];
}) {
  const kindLabel = ASSEMBLY_KIND_LABELS[assembly.kind] ?? '';
  const blatSummary = assembly.kind !== 'FARA_BLAT' && assembly.baseHeightMm != null && assembly.blatDepthMm != null
    ? ` · ${kindLabel}: bază ${fmtNum(assembly.baseHeightMm, 0)} / blat A${fmtNum(assembly.blatDepthMm, 0)} mm`
    : kindLabel ? ` · ${kindLabel}` : '';
  const editForm = (
    <ActionForm action={updateAssembly.bind(null, assembly.id)} className="grid items-end gap-3 sm:grid-cols-2">
      <TextInput name="name" label="Nume" defaultValue={assembly.name} />
      <NumberInput name="legHeightMm" label="Picioare (mm)" defaultValue={assembly.legHeightMm} step="1" />
      <Select name="plinthMode" label="Plintă (100 mm)" options={PLINTH_MODE_OPTIONS} defaultValue={assembly.plinthMode} />
      <AssemblyKindFields
        blatMaterials={blatMaterials}
        defaults={{
          kind: assembly.kind,
          baseHeightMm: assembly.baseHeightMm,
          blatMaterialId: assembly.blatMaterialId,
          blatDepthMm: assembly.blatDepthMm,
          upperHeightMm: assembly.upperHeightMm,
        }}
      />
      <div className="sm:col-span-2"><SubmitButton>Salvează</SubmitButton></div>
    </ActionForm>
  );
  return (
    <AssemblyCardShell
      name={assembly.name}
      metaText={`· picioare ${fmtNum(assembly.legHeightMm, 0)} mm · ${PLINTH_MODE_OPTIONS.find((option) => option.value === assembly.plinthMode)?.label.toLowerCase() ?? 'fără plintă'}${blatSummary}`}
      threeDSlot={(
        <Button asChild variant="outline" size="sm" title="Așezare 3D a corpurilor">
          <Link href={`/oferte/${quoteId}/ansamblu/${assembly.id}/asezare`}>
            <Boxes /> Așezare 3D
          </Link>
        </Button>
      )}
      deleteSlot={(
        <DeleteButton
          action={deleteAssembly.bind(null, assembly.id)}
          label="Șterge ansamblul"
          confirmMessage={cabinets.length > 0
            ? `Ștergi ansamblul „${assembly.name}" și cele ${cabinets.length} ${cabinets.length === 1 ? 'corp' : 'corpuri'} din el? Acțiunea nu poate fi anulată.`
            : `Ștergi ansamblul „${assembly.name}"?`}
        />
      )}
      editForm={editForm}
    >
      <BulkCabinetEditor
        assemblyId={assembly.id}
        eligibleIds={cabinets.filter((cabinet) => cabinet.input.type !== 'BLAT').map((cabinet) => cabinet.id)}
        materials={bulkMaterials}
        suppliers={bulkFrontSuppliers}
        models={bulkFrontModels}
        ralColors={ralColors}
        edgeBands={edgeBands}
      >
        <CabinetsTable quoteId={quoteId} cabinets={cabinets} issues={issues} bulkSelectable />
      </BulkCabinetEditor>

      <div className="flex gap-2">
        <ActionForm action={addCabinet.bind(null, quoteId, assembly.id, 'BAZA')}>
          <SubmitButton>Adaugă corp</SubmitButton>
        </ActionForm>
        <ActionForm action={addCabinet.bind(null, quoteId, assembly.id, 'BLAT')}>
          <SubmitButton>Adaugă blat</SubmitButton>
        </ActionForm>
      </div>

      {otherQuotes.length > 0 && (
        <ActionForm action={copyAssemblyToQuote.bind(null, assembly.id)} className="flex flex-wrap items-end gap-2 border-t pt-3">
          <Select
            name="targetQuoteId" label="Copiază ansamblul în proiectul"
            options={otherQuotes.map((p) => ({ value: p.id, label: p.name }))}
          />
          <SubmitButton>Copiază</SubmitButton>
        </ActionForm>
      )}
    </AssemblyCardShell>
  );
}

function CabinetsTable({ quoteId, cabinets, issues, bulkSelectable = false }: {
  quoteId: string; cabinets: LoadedCabinet[]; issues: Map<string, CabinetIssue>;
  bulkSelectable?: boolean;
}) {
  if (cabinets.length === 0) {
    return <p className="text-sm text-muted-foreground">Niciun corp încă.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {bulkSelectable && <TableHead className="w-10"><span className="sr-only">Selectare</span></TableHead>}
          <TableHead>Corp</TableHead>
          <TableHead>Tip</TableHead>
          <TableHead>Dimensiuni (L×H×A mm)</TableHead>
          <TableHead>Stare</TableHead>
          <TableHead className="text-right">Acțiuni</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cabinets.map((c) => {
          const incomplete = !isCabinetInputComplete(c.input);
          return (
          <CabinetRow
            key={c.id}
            cabinetId={c.id}
            showSelection={bulkSelectable}
            selectable={bulkSelectable && c.input.type !== 'BLAT'}
            href={`/oferte/${quoteId}/corp/${c.id}`}
            label={c.input.label}
            typeLabel={TYPE_LABELS[c.input.type] ?? c.input.type}
            dims={incomplete
              ? '—'
              : c.input.type === 'BLAT'
                ? `${c.input.widthMm}×${c.input.depthMm}`
                : `${c.input.widthMm}×${c.input.heightMm}×${c.input.depthMm}`}
            problems={cabinetProblems(issues.get(c.id), incomplete)}
            actions={
              <>
                <ActionForm action={duplicateCabinet.bind(null, c.id)} confirm="Sigur duplici acest corp?">
                  <Button type="submit" variant="ghost" size="icon-sm" title="Duplică" aria-label="Duplică">
                    <Copy />
                  </Button>
                </ActionForm>
                <DeleteButton action={deleteCabinet.bind(null, c.id)} label="Șterge corpul" iconOnly />
              </>
            }
          />
          );
        })}
      </TableBody>
    </Table>
  );
}
