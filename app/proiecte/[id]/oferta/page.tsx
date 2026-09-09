import Link from 'next/link';
import { notFound } from 'next/navigation';
import { legHeightByCabinet, loadProject, toQuoteInput, tryComputeQuote, type LoadedCabinet } from '@/lib/quote/load';
import { getQuoteBasis } from '@/lib/quote/basis';
import { PrintButton } from '@/components/PrintButton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { NoPriceBadge } from '@/components/NoPriceBadge';
import { materialHasNoPrice } from '@/lib/quote/material-price';
import { fmtLei } from '@/lib/format';

export const dynamic = 'force-dynamic';

const CUI = '54806005';

const TYPE_LABELS: Record<string, string> = {
  BAZA: 'Corp bază', SUSPENDAT: 'Corp suspendat', INALT: 'Corp înalt',
  COLT: 'Corp de colț', BLAT: 'Blat',
};

const OFFER_CSS = `
.oferta {
  --o-sheet:#fff; --o-fg:#232322; --o-muted:#6b6b67; --o-faint:#9b9b96;
  --o-line:#e9e8e5; --o-line2:#d6d5d1; --o-accent:#97612b; --o-accent-ink:#7c4f22; --o-accent-soft:#f6eee1;
  color:var(--o-fg); font-size:14px; line-height:1.5;
}
.oferta .sheet { max-width:830px; margin:0 auto; background:var(--o-sheet); color:var(--o-fg);
  border:1px solid var(--o-line); border-radius:4px; box-shadow:0 1px 2px rgba(20,20,18,.04),0 18px 42px -26px rgba(20,20,18,.22);
  padding:clamp(22px,5vw,52px); }
.oferta .mast { display:flex; justify-content:space-between; align-items:flex-start; gap:22px; flex-wrap:wrap; }
.oferta .wordmark { font-family:'Fraunces',Georgia,serif; font-weight:600; font-size:clamp(24px,5vw,32px); letter-spacing:-.015em; line-height:1; margin:0; }
.oferta .wordmark b { color:var(--o-accent); font-weight:600; }
.oferta .tag { font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:var(--o-muted); margin-top:8px; }
.oferta .cui { font-size:11.5px; color:var(--o-faint); margin-top:4px; letter-spacing:.02em; }
.oferta .meta { text-align:right; display:grid; gap:3px; }
.oferta .meta .row { font-size:12.5px; color:var(--o-muted); font-variant-numeric:tabular-nums; }
.oferta .meta .row span { color:var(--o-fg); }
.oferta .rule-accent { height:2px; border:0; background:linear-gradient(90deg,var(--o-accent) 0 60px,var(--o-line) 60px); margin:18px 0 24px; }
.oferta .band { display:grid; grid-template-columns:1.3fr 1fr; gap:20px 40px; }
@media (max-width:560px){ .oferta .band { grid-template-columns:1fr; } }
.oferta .eyebrow { font-size:10.5px; letter-spacing:.2em; text-transform:uppercase; color:var(--o-faint); margin:0 0 6px; }
.oferta .party .name { font-size:16px; font-weight:600; }
.oferta .party .sub { font-size:13px; color:var(--o-muted); margin-top:2px; }
.oferta .tiles { display:grid; grid-template-columns:repeat(2,1fr); gap:1px; background:var(--o-line);
  border:1px solid var(--o-line); border-radius:4px; overflow:hidden; margin:24px 0 4px; }
.oferta .tile { background:var(--o-sheet); padding:13px 16px; }
.oferta .tile .k { font-size:10.5px; letter-spacing:.16em; text-transform:uppercase; color:var(--o-faint); }
.oferta .tile .v { font-family:'Fraunces',Georgia,serif; font-weight:500; font-size:22px; margin-top:3px; font-variant-numeric:tabular-nums; }
.oferta .section { margin-top:32px; }
.oferta .section-head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding-bottom:8px; border-bottom:1px solid var(--o-line2); break-inside:avoid; break-after:avoid; }
.oferta tbody tr { break-inside:avoid; }
.oferta .section-head h2 { font-family:'Fraunces',Georgia,serif; font-weight:500; font-size:18px; margin:0; letter-spacing:-.01em; }
.oferta .section-head .count { font-size:12px; color:var(--o-muted); }
.oferta table { width:100%; border-collapse:collapse; }
.oferta thead th { font-size:10px; letter-spacing:.13em; text-transform:uppercase; color:var(--o-faint); text-align:left; font-weight:500; padding:12px 10px 8px; }
.oferta tbody td { padding:10px; border-top:1px solid var(--o-line); font-size:13px; vertical-align:top; }
.oferta tbody tr:nth-child(even) td { background:rgba(35,35,34,.025); }
.oferta td.corp { font-weight:500; }
.oferta td.corp small { display:block; font-weight:400; color:var(--o-faint); font-size:11.5px; margin-top:1px; }
.oferta td.dim { font-family:var(--font-mono),ui-monospace,monospace; font-size:12px; color:var(--o-muted); font-variant-numeric:tabular-nums; white-space:nowrap; }
.oferta .mat { font-size:12.5px; }
.oferta .mat .code { font-family:var(--font-mono),monospace; font-size:11px; color:var(--o-accent-ink); letter-spacing:.01em; }
.oferta .muted { color:var(--o-faint); }
.oferta .lists { margin-top:8px; font-size:13px; }
.oferta .lists li { border-top:1px solid var(--o-line); padding:8px 0; list-style:none; }
.oferta ul.plain { margin:0; padding:0; }
.oferta .totals { margin-top:32px; display:grid; grid-template-columns:1fr minmax(260px,320px); gap:24px; align-items:end; }
@media (max-width:620px){ .oferta .totals { grid-template-columns:1fr; } }
.oferta .obs { white-space:pre-line; font-size:13px; color:var(--o-fg); line-height:1.6; margin-top:10px; }
.oferta .note-incl { font-size:12px; color:var(--o-muted); line-height:1.6; }
.oferta .note-incl b { color:var(--o-fg); font-weight:600; }
.oferta .sumcard { border:1px solid var(--o-line2); border-radius:6px; overflow:hidden; }
.oferta .grand { background:var(--o-accent-soft); padding:16px; display:flex; justify-content:space-between; align-items:baseline; gap:12px; }
.oferta .grand .lbl { color:var(--o-accent-ink); font-weight:600; font-size:12px; letter-spacing:.05em; text-transform:uppercase; }
.oferta .grand .val { font-family:var(--font-sans),system-ui,sans-serif; font-weight:700; font-size:29px; letter-spacing:-.02em; color:var(--o-accent-ink); font-variant-numeric:tabular-nums; }
.oferta .terms { margin-top:34px; display:grid; grid-template-columns:repeat(2,1fr); gap:14px 40px; }
@media (max-width:560px){ .oferta .terms { grid-template-columns:1fr; } }
.oferta .term { display:flex; gap:12px; align-items:flex-start; break-inside:avoid; }
.oferta .term .n { font-family:var(--font-mono),monospace; font-size:11px; color:var(--o-accent); padding-top:2px; min-width:16px; }
.oferta .term .t b { display:block; font-size:13px; font-weight:600; }
.oferta .term .t p { margin:2px 0 0; font-size:12.5px; color:var(--o-muted); line-height:1.5; }
.oferta .sign { margin-top:38px; display:grid; grid-template-columns:1fr 1fr; gap:46px; }
@media (max-width:480px){ .oferta .sign { grid-template-columns:1fr; gap:28px; } }
.oferta .slot { border-top:1px solid var(--o-line2); padding-top:8px; }
.oferta .slot .role { font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--o-faint); }
.oferta .slot .who { font-size:13px; margin-top:3px; color:var(--o-muted); }
.oferta footer { margin-top:38px; padding-top:16px; border-top:1px solid var(--o-line); display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; font-size:11.5px; color:var(--o-faint); }
.oferta footer .dot { color:var(--o-line2); padding:0 6px; }
@media print {
  html, body { background:#fff !important; }
  main { max-width:none !important; padding:0 !important; margin:0 !important; }
  .oferta .sheet { box-shadow:none; border:0; max-width:none; border-radius:0; padding:0; }
}
`;

export default async function OfertaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  if (!data) notFound();
  const { project, assemblies, cabinets } = data;

  const basis = await getQuoteBasis(project);
  if (basis.kind === 'MISSING') {
    return (
      <p className="text-sm">
        Proiectul e într-o stare înghețată dar nu are un calcul salvat — <Link href={`/proiecte/${id}`} className="underline">înapoi la proiect</Link> și comută starea pentru a genera un calcul.
      </p>
    );
  }
  const snapshot = basis.snapshot;
  const { quote, error } = tryComputeQuote(toQuoteInput(project, cabinets, legHeightByCabinet(assemblies, cabinets), assemblies), snapshot);
  if (!quote) return <p className="text-sm text-red-700">Eroare de calcul: {error}</p>;

  const materialById = (mid: string | null | undefined) =>
    mid ? snapshot.materials.find((m) => m.id === mid) : undefined;
  const idHasNoPrice = (mid: string | null | undefined) => {
    const m = materialById(mid);
    return !!m && materialHasNoPrice(m);
  };
  // materialul + codul de decor (ex. „PAL alb W980 · H3146 ST19"); codul apare doar dacă nu e deja în nume
  const matLabel = (mid: string | null | undefined): { name: string; code: string | null } => {
    const m = materialById(mid);
    if (!m) return { name: '—', code: null };
    const code = m.decorCode && !m.name.includes(m.decorCode) ? m.decorCode : null;
    return { name: m.name, code };
  };

  const FINISH_LABELS: Record<string, string> = { MAT: 'mat', LUCIOS: 'lucios' };
  // materialul carcasei (la blat: materialul blatului) — cu cod de culoare
  const carcassCell = (c: LoadedCabinet) =>
    matLabel(c.input.type === 'BLAT' ? c.input.blat?.materialId : c.input.carcassMaterialId);
  // materialul frontului (blatul nu are front)
  const frontCell = (c: LoadedCabinet): { name: string; code: string | null } => {
    if (c.input.type === 'BLAT') return { name: '—', code: null };
    if (c.input.frontKind === 'MDF_VOPSIT' && c.input.mdfFront) {
      const mdf = c.input.mdfFront;
      const model = snapshot.frontModels.find((m) => m.id === mdf.modelId);
      const parts = ['MDF vopsit'];
      if (model?.code) parts.push(model.code);
      parts.push(FINISH_LABELS[mdf.finish] ?? mdf.finish);
      return { name: parts.join(' · '), code: mdf.ralCode || null };
    }
    if (c.input.frontMaterialId == null) return { name: 'Fără front', code: null };
    return matLabel(c.input.frontMaterialId);
  };

  const noPriceNames = [
    ...new Map(
      cabinets
        .flatMap((c) => [
          c.input.carcassMaterialId, c.input.frontMaterialId, c.input.blat?.materialId,
          c.input.back?.materialId, c.input.drawers?.bottomMaterialId,
          ...c.extraParts.map((p) => p.materialId),
        ])
        .map((mid) => materialById(mid))
        .filter((m): m is NonNullable<typeof m> => !!m && materialHasNoPrice(m))
        .map((m) => [m.id, m.name] as const),
    ).values(),
  ];

  const cabinetsByAssembly = new Map<string, LoadedCabinet[]>();
  for (const c of cabinets) {
    if (!c.assemblyId) continue;
    const list = cabinetsByAssembly.get(c.assemblyId) ?? [];
    list.push(c);
    cabinetsByAssembly.set(c.assemblyId, list);
  }
  const unassigned = cabinets.filter((c) => !c.assemblyId);
  const assemblyCount = assemblies.filter((a) => (cabinetsByAssembly.get(a.id)?.length ?? 0) > 0).length
    + (unassigned.length > 0 ? 1 : 0);

  const freeLines = JSON.parse(project.freeLinesJson) as { name: string; amount: number }[];
  const loosePanels = JSON.parse(project.loosePanelsJson ?? '[]') as { name?: string; materialId: string; lengthMm: number; widthMm: number; qty: number; edgeBandId?: string; edgeMode?: 'NONE' | 'L1' | 'L2' | 'ALL' }[];
  const EDGE_MODE_LABEL: Record<string, string> = { L1: '1 latură', L2: '2 laturi lungi', ALL: 'jur-împrejur' };
  const cantLabel = (pnl: { edgeBandId?: string; edgeMode?: string }) => {
    if (!pnl.edgeBandId || !pnl.edgeMode || pnl.edgeMode === 'NONE') return '';
    const band = snapshot.edgeBands.find((b) => b.id === pnl.edgeBandId);
    return band ? ` · cant ${band.name} (${EDGE_MODE_LABEL[pnl.edgeMode] ?? ''})` : '';
  };

  const cabTable = (list: LoadedCabinet[]) => (
    <table>
      <thead>
        <tr><th>Corp</th><th>Dimensiuni</th><th>Corp (material)</th><th>Front</th></tr>
      </thead>
      <tbody>
        {list.map((c) => {
          const corp = carcassCell(c);
          const front = frontCell(c);
          return (
            <tr key={c.id}>
              <td className="corp">{c.input.label}<small>{TYPE_LABELS[c.input.type] ?? c.input.type}</small></td>
              <td className="dim">{c.input.widthMm} × {c.input.heightMm} × {c.input.depthMm}</td>
              <td className="mat">
                {corp.name}{corp.code && <> · <span className="code">{corp.code}</span></>}
                {idHasNoPrice(c.input.type === 'BLAT' ? c.input.blat?.materialId : c.input.carcassMaterialId) && <> <NoPriceBadge /></>}
              </td>
              <td className="mat">
                {front.name === '—' ? <span className="muted">—</span> : front.name}
                {front.code && <> · <span className="code">{front.code}</span></>}
                {idHasNoPrice(c.input.frontMaterialId) && <> <NoPriceBadge /></>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const today = new Date().toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="oferta">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap" rel="stylesheet" />
      <style>{OFFER_CSS}</style>

      <div className="mb-4 flex items-center justify-end gap-2 print:hidden">
        {basis.kind === 'LIVE' && (
          <Badge className="bg-green-600 text-white hover:bg-green-600">Prețuri live</Badge>
        )}
        {basis.kind === 'FROZEN' && (
          <Badge variant="outline" className="border-amber-500 text-amber-700">
            Prețuri înghețate la {new Date(basis.snapshot.takenAt).toLocaleDateString('ro-RO')}
          </Badge>
        )}
        <PrintButton />
      </div>

      {noPriceNames.length > 0 && (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-800 print:hidden">
          <AlertDescription>
            Atenție: unele materiale nu au preț și apar cu 0 lei — totalul e subevaluat: {noPriceNames.join(', ')}.
          </AlertDescription>
        </Alert>
      )}

      <div className="sheet">
        <header className="mast">
          <div>
            <h1 className="wordmark">Epic<b>Mob</b></h1>
            <div className="tag">Mobilă la comandă · proiectare &amp; montaj</div>
            <div className="cui">EpicMob SRL · CUI {CUI}</div>
          </div>
          <div className="meta">
            <div className="row">Ofertă de preț</div>
            <div className="row">Emisă <span>{today}</span></div>
            <div className="row">Valabilă <span>30 de zile</span></div>
          </div>
        </header>

        <hr className="rule-accent" />

        <div className="band">
          <div className="party">
            <p className="eyebrow">Către</p>
            <div className="name">{project.clientName || 'Beneficiar'}</div>
            {project.clientContact && <div className="sub">{project.clientContact}</div>}
          </div>
          <div className="party">
            <p className="eyebrow">Proiect</p>
            <div className="name">{project.name}</div>
            <div className="sub">Prețuri valabile la data emiterii</div>
          </div>
        </div>

        <div className="tiles">
          <div className="tile"><div className="k">Corpuri</div><div className="v">{cabinets.length}</div></div>
          <div className="tile"><div className="k">Ansambluri</div><div className="v">{assemblyCount}</div></div>
        </div>

        {assemblies.map((a) => {
          const list = cabinetsByAssembly.get(a.id) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={a.id} className="section">
              <div className="section-head"><h2>{a.name}</h2><div className="count">{list.length} corpuri</div></div>
              {cabTable(list)}
            </section>
          );
        })}

        {unassigned.length > 0 && (
          <section className="section">
            <div className="section-head"><h2>Alte corpuri</h2><div className="count">{unassigned.length} corpuri</div></div>
            {cabTable(unassigned)}
          </section>
        )}

        {(loosePanels.length > 0 || freeLines.length > 0) && (
          <section className="section">
            <div className="section-head"><h2>Plăci &amp; accesorii</h2></div>
            <ul className="plain lists">
              {loosePanels.map((pnl, i) => (
                <li key={`p${i}`}>
                  {pnl.name ? `${pnl.name} · ` : ''}{matLabel(pnl.materialId).name} — <span className="dim">{pnl.lengthMm} × {pnl.widthMm} mm</span> × {pnl.qty} buc{cantLabel(pnl)}
                </li>
              ))}
              {freeLines.map((l, i) => (<li key={`f${i}`}>{l.name}</li>))}
            </ul>
          </section>
        )}

        <div className="totals">
          <div className="note-incl">
            <b>Prețul include</b> materiale, feronerie, debitare și cant, manoperă de atelier și
            <b> montaj la domiciliu</b>. Decorurile se aleg împreună cu beneficiarul.
          </div>
          <div className="sumcard">
            <div className="grand"><span className="lbl">Total lucrare</span><span className="val">{fmtLei(quote.costs.sellPrice)}</span></div>
          </div>
        </div>

        <section className="section">
          <div className="section-head"><h2>Condiții</h2></div>
          <div className="terms">
            <div className="term"><span className="n">01</span><div className="t"><b>Avans</b><p>50% la comandă, diferența la livrare, înainte de montaj.</p></div></div>
            <div className="term"><span className="n">02</span><div className="t"><b>Termen de execuție</b><p>40 de zile lucrătoare de la confirmarea decorurilor.</p></div></div>
            <div className="term"><span className="n">03</span><div className="t"><b>Măsurători</b><p>Cotele finale se verifică la fața locului înainte de debitare.</p></div></div>
          </div>
        </section>

        {project.observatii && (
          <section className="section">
            <div className="section-head"><h2>Observații</h2></div>
            <p className="obs">{project.observatii}</p>
          </section>
        )}

        <div className="sign">
          <div className="slot"><div className="role">Furnizor</div><div className="who">EpicMob SRL · CUI {CUI}</div></div>
          <div className="slot"><div className="role">Beneficiar</div><div className="who">{project.clientName || '—'}</div></div>
        </div>

        <footer>
          <span>EpicMob SRL · CUI {CUI}</span>
          <span>contact@epicmob.ro <span className="dot">·</span> +40 750 402 027</span>
        </footer>
      </div>
    </div>
  );
}
