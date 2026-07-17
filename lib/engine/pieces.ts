import type { Catalogs, EdgeSide, Part, PartEdges, PieceInstance, PiecesConfig } from './types';
import { EDGE_SIDES } from './types';

function assertBand(catalogs: Catalogs, id: string) {
  if (!catalogs.edgeBands.some((b) => b.id === id)) {
    throw new Error(`Cant inexistent în catalog: ${id}`);
  }
}

/** Aplică abaterile utilizatorului: canturi/material/dimensiuni/eliminare per bucată
 *  + piesele libere. Cheile care nu mai există se ignoră silențios. */
export function applyPiecesConfig(
  pieces: PieceInstance[],
  cfg: PiecesConfig | undefined,
  catalogs: Catalogs,
  cabinetLabel: string,
): PieceInstance[] {
  if (!cfg) return pieces;
  const out: PieceInstance[] = [];
  for (const pc of pieces) {
    const ov = cfg.overrides?.[pc.key];
    if (!ov) { out.push(pc); continue; }
    if (ov.removed) continue;
    const next: PieceInstance = { ...pc, edges: { ...pc.edges }, manual: { ...pc.manual } };
    if (ov.edges) {
      const touched: EdgeSide[] = [];
      for (const [side, band] of Object.entries(ov.edges) as [EdgeSide, string | null][]) {
        if (next.edgeAxis[side] === undefined) continue; // latură neaplicabilă piesei
        if (band === null) delete next.edges[side];
        else { assertBand(catalogs, band); next.edges[side] = band; }
        touched.push(side);
      }
      if (touched.length > 0) next.manual = { ...next.manual, edges: touched };
    }
    if (ov.materialId) {
      if (!catalogs.materials.some((m) => m.id === ov.materialId)) {
        throw new Error(`Material inexistent în catalog: ${ov.materialId}`);
      }
      next.materialId = ov.materialId;
      next.manual = { ...next.manual, material: true };
    }
    if (ov.lengthMm !== undefined) {
      if (ov.lengthMm <= 0) throw new Error(`Corpul ${cabinetLabel}: lungime manuală imposibilă (${ov.lengthMm}mm)`);
      next.lengthMm = ov.lengthMm;
      next.manual = { ...next.manual, lengthMm: true };
      delete next.calc; // formula nu mai descrie valoarea manuală
    }
    if (ov.widthMm !== undefined) {
      if (ov.widthMm <= 0) throw new Error(`Corpul ${cabinetLabel}: lățime manuală imposibilă (${ov.widthMm}mm)`);
      next.widthMm = ov.widthMm;
      next.manual = { ...next.manual, widthMm: true };
      delete next.calc;
    }
    out.push(next);
  }
  for (const fp of cfg.free ?? []) {
    if (!catalogs.materials.some((m) => m.id === fp.materialId)) {
      throw new Error(`Material inexistent în catalog: ${fp.materialId}`);
    }
    const edges: PieceInstance['edges'] = {};
    for (const [side, band] of Object.entries(fp.edges ?? {}) as [EdgeSide, string | null][]) {
      if (band) { assertBand(catalogs, band); edges[side] = band; }
    }
    for (let i = 0; i < Math.max(1, Math.trunc(fp.qty)); i++) {
      out.push({
        key: `libera:${fp.id}${fp.qty > 1 ? `:${i}` : ''}`,
        cabinetLabel, name: fp.name,
        label: fp.qty > 1 ? `${fp.name} ${i + 1}` : fp.name,
        lengthMm: fp.lengthMm, widthMm: fp.widthMm, materialId: fp.materialId,
        edges, edgeAxis: { fata: 'L', spate: 'L', stanga: 'W', dreapta: 'W' },
        free: true,
      });
    }
  }
  return out;
}

/** Regrupează bucățile identice în rânduri de debitare (Part cu qty), mapând
 *  muchiile semantice pe laturile l1/l2/w1/w2 după edgeAxis. Ordinea laturilor
 *  e EDGE_SIDES — prima muchie cu axă L devine l1, a doua l2; la fel w1/w2. */
export function toParts(pieces: PieceInstance[]): Part[] {
  const out: Part[] = [];
  for (const pc of pieces) {
    const edges: PartEdges = {};
    for (const side of EDGE_SIDES) {
      const band = pc.edges[side];
      const axis = pc.edgeAxis[side];
      if (!band || !axis) continue;
      if (axis === 'L') {
        if (!edges.l1) edges.l1 = band;
        else edges.l2 = band;
      } else {
        if (!edges.w1) edges.w1 = band;
        else edges.w2 = band;
      }
    }
    const sig = (e: PartEdges) => `${e.l1 ?? ''}|${e.l2 ?? ''}|${e.w1 ?? ''}|${e.w2 ?? ''}`;
    const same = out.find(
      (q) => q.cabinetLabel === pc.cabinetLabel && q.name === pc.name
        && q.lengthMm === pc.lengthMm && q.widthMm === pc.widthMm
        && q.materialId === pc.materialId && sig(q.edges) === sig(edges),
    );
    if (same) same.qty += 1;
    else out.push({
      cabinetLabel: pc.cabinetLabel, name: pc.name,
      lengthMm: pc.lengthMm, widthMm: pc.widthMm, qty: 1,
      materialId: pc.materialId, edges,
      ...(pc.calc ? { calc: pc.calc } : {}),
    });
  }
  return out;
}
