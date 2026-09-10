'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fieldLabelCls } from '@/components/forms';
import { analyzeSketchAction, createFromProposalAction, type CreateResult } from '@/lib/schita/actions';
import type { Proposal, ProposalCabinet } from '@/lib/schita/schema';

const SECTIONS = ['BAZA', 'SUSPENDAT', 'INALT', 'BLAT'] as const;
const ROLES = ['normal', 'chiuveta', 'masina_spalat', 'cuptor', 'frigider', 'cargo', 'blat'] as const;
const ROLE_LABEL: Record<string, string> = { normal: 'Normal', chiuveta: 'Chiuvetă', masina_spalat: 'Mașină spălat', cuptor: 'Cuptor', frigider: 'Frigider', cargo: 'Cargo Jolly', blat: 'Blat' };

type MatOpt = { id: string; name: string };

export function SchitaGenerator({ palMaterials, blatMaterials }: { palMaterials: MatOpt[]; blatMaterials: MatOpt[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [details, setDetails] = useState('');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [created, setCreated] = useState<CreateResult | null>(null);

  // opțiuni de generare
  const [clientName, setClientName] = useState('');
  const [vopsit, setVopsit] = useState(true);
  const [pal, setPal] = useState(true);
  const [addSoclu, setAddSoclu] = useState(true);
  const [cargoLine, setCargoLine] = useState(true);
  // culori / materiale (gol = material standard implicit)
  const [carcassMaterialId, setCarcassMaterialId] = useState('');
  const [frontPalMaterialId, setFrontPalMaterialId] = useState('');
  const [blatMaterialId, setBlatMaterialId] = useState('');
  const [vopsitRal, setVopsitRal] = useState('');
  const [vopsitFinish, setVopsitFinish] = useState<'MAT' | 'LUCIOS'>('MAT');

  function onPick(list: FileList | null) {
    setFiles(list ? Array.from(list) : []); setError(null);
  }

  function analyze() {
    if (files.length === 0) { setError('Încarcă cel puțin un fișier (poză sau PDF).'); return; }
    setError(null); setProposal(null); setCreated(null);
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    fd.set('details', details);
    start(async () => {
      const r = await analyzeSketchAction(fd);
      if (r.ok) { setProposal(r.proposal); setClientName(r.proposal.clientName ?? ''); }
      else setError(r.error);
    });
  }

  function patchCab(i: number, patch: Partial<ProposalCabinet>) {
    setProposal((p) => p && ({ ...p, cabinets: p.cabinets.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  }
  function removeCab(i: number) {
    setProposal((p) => p && ({ ...p, cabinets: p.cabinets.filter((_, j) => j !== i) }));
  }

  function create() {
    if (!proposal) return;
    setError(null);
    const variants = [vopsit && 'vopsit', pal && 'pal'].filter(Boolean) as ('vopsit' | 'pal')[];
    start(async () => {
      const r = await createFromProposalAction(proposal, {
        clientName, variants, addSoclu, cargoLine,
        carcassMaterialId: carcassMaterialId || undefined,
        frontPalMaterialId: frontPalMaterialId || undefined,
        blatMaterialId: blatMaterialId || undefined,
        vopsitRal: vopsitRal || undefined,
        vopsitFinish,
      });
      if (r.ok) setCreated(r); else setError(r.error);
    });
  }

  const num = 'h-8 w-16 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring';
  const sel = 'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring';

  return (
    <div className="space-y-6">
      {/* PAS 1 — încărcare */}
      {!created && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Label className={fieldLabelCls}>Fișiere (poze, PDF-uri…) — poți alege mai multe</Label>
            <Input type="file" accept="image/*,application/pdf,.txt,.md,.csv" multiple onChange={(e) => onPick(e.target.files)} />
            {files.length > 0 && (
              <ul className="space-y-1 text-sm">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {f.type.startsWith('image/')
                      ? <img src={URL.createObjectURL(f)} alt="" className="h-10 w-10 rounded border object-cover" />
                      : <span className="grid h-10 w-10 place-items-center rounded border text-[10px] text-muted-foreground">{f.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'FIȘ'}</span>}
                    <span className="grow truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-3">
            <Label className={fieldLabelCls}>Detalii extra (dimensiuni, cerințe, ce nu e pe schiță)</Label>
            <textarea
              value={details} onChange={(e) => setDetails(e.target.value)} rows={8}
              placeholder={'Ex: perete 310×225. Vreau ofertă și vopsit și PAL. Feronerie Blum. Frigiderul e liber, coloană pe stânga…'}
              className="w-full rounded-lg border border-input bg-transparent p-2.5 text-sm outline-none focus-visible:border-ring"
            />
            <Button onClick={analyze} disabled={pending || files.length === 0}>
              {pending && !proposal ? 'Analizez…' : 'Analizează'}
            </Button>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* PAS 2 — confirmare */}
      {proposal && !created && (
        <div className="space-y-4 rounded-xl border p-4">
          <div>
            <h3 className="text-sm font-semibold">Ce am înțeles din schiță</h3>
            <p className="mt-1 text-sm text-muted-foreground">{proposal.reasoning}</p>
            {proposal.finishHint && (
              <p className="mt-1 text-sm">Finisaj citit pe schiță: <b>{proposal.finishHint}</b> — alege materialul potrivit mai jos.</p>
            )}
            {proposal.questions.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700">
                {proposal.questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="p-1">Etichetă</th><th className="p-1">Secțiune</th><th className="p-1">Rol</th>
                  <th className="p-1">L</th><th className="p-1">H</th><th className="p-1">A</th>
                  <th className="p-1">Uși</th><th className="p-1">Sert.</th><th className="p-1">Polițe</th><th></th>
                </tr>
              </thead>
              <tbody>
                {proposal.cabinets.map((c, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1"><Input value={c.label} onChange={(e) => patchCab(i, { label: e.target.value })} className="h-8" /></td>
                    <td className="p-1"><select className={sel} value={c.section} onChange={(e) => patchCab(i, { section: e.target.value as ProposalCabinet['section'] })}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select></td>
                    <td className="p-1"><select className={sel} value={c.role} onChange={(e) => patchCab(i, { role: e.target.value as ProposalCabinet['role'] })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
                    <td className="p-1"><input type="number" className={num} value={c.widthMm} onChange={(e) => patchCab(i, { widthMm: +e.target.value })} /></td>
                    <td className="p-1"><input type="number" className={num} value={c.heightMm} onChange={(e) => patchCab(i, { heightMm: +e.target.value })} /></td>
                    <td className="p-1"><input type="number" className={num} value={c.depthMm} onChange={(e) => patchCab(i, { depthMm: +e.target.value })} /></td>
                    <td className="p-1"><input type="number" className={num} value={c.doors} onChange={(e) => patchCab(i, { doors: +e.target.value })} /></td>
                    <td className="p-1"><input type="number" className={num} value={c.drawers} onChange={(e) => patchCab(i, { drawers: +e.target.value })} /></td>
                    <td className="p-1"><input type="number" className={num} value={c.shelves} onChange={(e) => patchCab(i, { shelves: +e.target.value })} /></td>
                    <td className="p-1"><button onClick={() => removeCab(i)} className="text-red-600" title="Șterge">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* culori & materiale */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Culori & materiale (lasă gol pentru standard)</div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <Label className={fieldLabelCls}>Carcasă (corp)</Label>
                <select className={sel + ' w-full'} value={carcassMaterialId} onChange={(e) => setCarcassMaterialId(e.target.value)}>
                  <option value="">— standard alb —</option>
                  {palMaterials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="grid gap-1">
                <Label className={fieldLabelCls}>Front PAL (la varianta PAL)</Label>
                <select className={sel + ' w-full'} value={frontPalMaterialId} onChange={(e) => setFrontPalMaterialId(e.target.value)}>
                  <option value="">— la fel ca la carcasă —</option>
                  {palMaterials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="grid gap-1">
                <Label className={fieldLabelCls}>Blat</Label>
                <select className={sel + ' w-full'} value={blatMaterialId} onChange={(e) => setBlatMaterialId(e.target.value)}>
                  <option value="">— standard —</option>
                  {blatMaterials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className={fieldLabelCls}>Culoare vopsit (RAL)</Label>
                  <Input value={vopsitRal} onChange={(e) => setVopsitRal(e.target.value)} placeholder="ex. RAL 7016" />
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabelCls}>Finisaj vopsit</Label>
                  <select className={sel + ' w-full'} value={vopsitFinish} onChange={(e) => setVopsitFinish(e.target.value as 'MAT' | 'LUCIOS')}>
                    <option value="MAT">Mat</option>
                    <option value="LUCIOS">Lucios</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* opțiuni */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <Label className={fieldLabelCls}>Nume client</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client nou" />
            </div>
            <div className="flex flex-wrap items-end gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={vopsit} onChange={(e) => setVopsit(e.target.checked)} /> MDF vopsit</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={pal} onChange={(e) => setPal(e.target.checked)} /> PAL</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={addSoclu} onChange={(e) => setAddSoclu(e.target.checked)} /> Soclu</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={cargoLine} onChange={(e) => setCargoLine(e.target.checked)} /> Cargo Jolly</label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={create} disabled={pending || (!vopsit && !pal)}>
              {pending ? 'Creez proiectul…' : 'Creează proiect(e)'}
            </Button>
            <Button variant="outline" onClick={() => setProposal(null)} disabled={pending}>Renunță</Button>
          </div>
        </div>
      )}

      {/* PAS 3 — gata */}
      {created?.ok && (
        <div className="space-y-3 rounded-xl border border-green-300 bg-green-50 p-4">
          <h3 className="font-semibold text-green-900">Proiect(e) create ✓</h3>
          <ul className="space-y-1 text-sm">
            {created.quotes.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="grow">{p.name}</span>
                <Link href={`/oferte/${p.id}`} className="underline">Deschide oferta</Link>
                <Link href={`/oferte/${p.id}/oferta`} className="underline">Vezi oferta</Link>
              </li>
            ))}
          </ul>
          <Button variant="outline" onClick={() => { setCreated(null); setProposal(null); setFiles([]); setDetails(''); }}>Schiță nouă</Button>
        </div>
      )}
    </div>
  );
}
