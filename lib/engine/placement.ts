// Plasarea 3D a bucăților: atașează `placement` (poziție + dimensiuni în spațiul corpului)
// pe fiecare PieceInstance cu poziție semantică. Sistem de coordonate: vezi PiecePlacement
// (types.ts) — x: 0→W stânga→dreapta, y: 0→înălțimea carcasei jos→sus (0 = baza carcasei,
// piciorul nu se randează), z: 0→D spate→față (fronturile la z=D, adâncime FRONT_THICKNESS_MM).
import { LEGGED_TYPES } from './constants';
import { findMaterial } from './carcass';
import { drawerFrontHeights, resolveFalseFronts } from './fronts';
import { pickSlideNominal } from './drawers';
import { FRONT_THICKNESS_MM } from './costing';
import type { CabinetInput, Catalogs, ConstructionConstants, PieceInstance } from './types';

export function assignPlacements(
  pieces: PieceInstance[], input: CabinetInput, catalogs: Catalogs,
  cc: ConstructionConstants, legHeightMm?: number,
): void {
  if (input.type === 'BLAT') return;
  const { widthMm: W, heightMm: H, depthMm: D } = input;
  const t = findMaterial(catalogs, input.carcassMaterialId).thicknessMm;
  const legDeduct = legHeightMm && LEGGED_TYPES.has(input.type) ? legHeightMm : 0;
  const carcassH = H - legDeduct;
  const mountTop = input.mount?.top ?? 'INCADRAT';
  const mountBottom = input.mount?.bottom ?? 'INCADRAT';
  const aplicatBottom = mountBottom === 'APLICAT' ? t : 0;
  const backMat = input.back.enabled && input.back.materialId
    ? findMaterial(catalogs, input.back.materialId) : null;
  const hasPfl = backMat?.kind === 'PFL';
  const zBack = (hasPfl ? backMat!.thicknessMm : 0) + (hasPfl ? cc.screwAllowanceMm : 0);
  const g = cc.outerGapMm;
  const thick = (pc: PieceInstance) => findMaterial(catalogs, pc.materialId).thicknessMm;

  // geometria fronturilor (aceeași logică ca lib/iso/geometry.ts, redusă la poziții)
  const isVopsit = input.frontKind === 'MDF_VOPSIT' && !!input.mdfFront;
  const hasFronts = (input.frontMaterialId !== null || isVopsit)
    && (input.doors > 0 || (input.drawers?.count ?? 0) > 0);
  const { stangaMm: fS, dreaptaMm: fD } = hasFronts
    ? resolveFalseFronts(input, cc) : { stangaMm: 0, dreaptaMm: 0 };
  // ușile/sertarele încep după piesa de fals (nominal − gap/2) + luftul spre ea
  const frontX0 = fS > 0 ? fS + cc.frontGapMm / 2 : g;
  const isGola = input.handle?.type === 'GOLA';
  const frontTopY = carcassH - g - (isGola ? cc.golaFrontDeductMm : 0);

  for (const pc of pieces) {
    const th = thick(pc);
    switch (true) {
      case pc.key === 'laterala:0':
        pc.placement = { x: 0, y: aplicatBottom, z: zBack, w: th, h: pc.lengthMm, d: pc.widthMm };
        break;
      case pc.key === 'laterala:1':
        pc.placement = { x: W - th, y: aplicatBottom, z: zBack, w: th, h: pc.lengthMm, d: pc.widthMm };
        break;
      case pc.key === 'blat-corp':
        pc.placement = {
          x: mountTop === 'APLICAT' ? 0 : t, y: carcassH - th, z: zBack,
          w: pc.lengthMm, h: th, d: pc.widthMm,
        };
        break;
      case pc.key === 'pazie-fata':
        pc.placement = {
          x: mountTop === 'APLICAT' ? 0 : t, y: carcassH - th, z: D - pc.widthMm,
          w: pc.lengthMm, h: th, d: pc.widthMm,
        };
        break;
      case pc.key === 'pazie-spate':
        pc.placement = {
          x: mountTop === 'APLICAT' ? 0 : t, y: carcassH - th, z: zBack,
          w: pc.lengthMm, h: th, d: pc.widthMm,
        };
        break;
      case pc.key === 'fund-corp':
        pc.placement = {
          x: mountBottom === 'APLICAT' ? 0 : t, y: 0, z: zBack,
          w: pc.lengthMm, h: th, d: pc.widthMm,
        };
        break;
      case /^polita:\d+$/.test(pc.key): {
        const i = Number(pc.key.split(':')[1]);
        const n = input.shelves;
        const isFB = input.shelf?.decorAxis === 'FB';
        pc.placement = {
          x: t, y: (carcassH * (i + 1)) / (n + 1), z: zBack,
          w: isFB ? pc.widthMm : pc.lengthMm, h: th, d: isFB ? pc.lengthMm : pc.widthMm,
        };
        break;
      }
      case pc.key === 'spate':
        pc.placement = {
          x: (W - pc.widthMm) / 2, y: 0, z: 0,
          w: pc.widthMm, h: pc.lengthMm, d: th,
        };
        break;
      case pc.key === 'fals:stanga':
        pc.placement = { x: 0, y: frontTopY - pc.lengthMm, z: D, w: pc.widthMm, h: pc.lengthMm, d: FRONT_THICKNESS_MM };
        break;
      case pc.key === 'fals:dreapta':
        pc.placement = { x: W - pc.widthMm, y: frontTopY - pc.lengthMm, z: D, w: pc.widthMm, h: pc.lengthMm, d: FRONT_THICKNESS_MM };
        break;
      case /^usa:\d+$/.test(pc.key): {
        const i = Number(pc.key.split(':')[1]);
        pc.placement = {
          x: frontX0 + i * (pc.widthMm + cc.frontGapMm),
          y: frontTopY - pc.lengthMm, z: D,
          w: pc.widthMm, h: pc.lengthMm, d: FRONT_THICKNESS_MM,
        };
        break;
      }
      case /^front-sertar:\d+(:\d+)?$/.test(pc.key): {
        const seg = pc.key.split(':');
        const i = Number(seg[1]);
        const c = seg.length > 2 ? Number(seg[2]) : 0; // index coloană
        const heights = drawerFrontHeights(input, cc, legDeduct);
        let topY = carcassH - g;
        for (let k = 0; k < i; k++) topY -= heights[k] + cc.frontGapMm;
        if (isGola) topY -= cc.golaFrontDeductMm; // profilul fiecărui sertar e deasupra frontului
        pc.placement = {
          // pc.widthMm e deja lățimea pe coloană → offset orizontal per coloană
          x: frontX0 + c * (pc.widthMm + cc.frontGapMm), y: topY - pc.lengthMm, z: D,
          w: pc.widthMm, h: pc.lengthMm, d: FRONT_THICKNESS_MM,
        };
        break;
      }
      case pc.key.startsWith('sertar:'): {
        const seg = pc.key.split(':');
        const i = Number(seg[1]);
        const c = Number(seg[2]);   // cheile cutiilor includ mereu index-ul de coloană
        const partName = seg[3];    // laterala | fata | spate | fund
        const heights = drawerFrontHeights(input, cc, legDeduct);
        let topY = carcassH - g;
        for (let k = 0; k < i; k++) topY -= heights[k] + cc.frontGapMm;
        const boxBottom = Math.max(0, topY - heights[i] + 20); // cutia stă pe glisieră, aproximativ
        const { nominalMm } = pickSlideNominal(D, cc);
        const cols = Math.max(1, input.drawers?.columns ?? 1);
        const innerW = W - 2 * t;
        const colRegion = (innerW - (cols - 1) * cc.frontGapMm) / cols;
        const colX = t + c * (colRegion + cc.frontGapMm); // marginea stângă interioară a coloanei
        if (partName === 'laterala') {
          const j = Number(seg[4]);
          const x = j === 0 ? colX + cc.palBoxSlideAllowanceMm / 2 : colX + colRegion - cc.palBoxSlideAllowanceMm / 2 - th;
          pc.placement = { x, y: boxBottom, z: D - nominalMm, w: th, h: pc.widthMm, d: pc.lengthMm };
        } else if (partName === 'fata' || partName === 'spate') {
          pc.placement = {
            x: colX + cc.palBoxSlideAllowanceMm / 2 + th, y: boxBottom,
            z: partName === 'fata' ? D - th : D - nominalMm,
            w: pc.lengthMm, h: pc.widthMm, d: th,
          };
        } else { // fund
          pc.placement = {
            x: colX + cc.palBoxSlideAllowanceMm / 2, y: boxBottom, z: D - nominalMm,
            w: pc.widthMm, h: th, d: pc.lengthMm,
          };
        }
        break;
      }
      // piese libere: fără placement
    }
  }
}
