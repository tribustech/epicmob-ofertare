import { EDGE_SIDES, type EdgeSide, type Part, type PartEdges, type PieceInstance } from './types';

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
