// Plasarea 3D a bucăților: atașează `placement` (poziție + dimensiuni în spațiul corpului)
// pe fiecare PieceInstance cu poziție semantică. Sistem de coordonate: vezi PiecePlacement
// (types.ts) — x: 0→W stânga→dreapta, y: 0→înălțimea carcasei jos→sus (0 = baza carcasei,
// piciorul nu se randează), z: 0→D spate→față (fronturile la z=D, adâncime FRONT_THICKNESS_MM).
import { LEGGED_TYPES } from './constants';
import { findMaterial } from './carcass';
import { drawerFrontHeights } from './fronts';
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
  const blindW = input.type === 'COLT' && hasFronts
    ? (input.blindPanelWidthMm ?? cc.blindPanelDefaultWidthMm) : 0;
  const frontX0 = g + blindW;
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
      case pc.key === 'panou-orb':
        pc.placement = { x: g, y: frontTopY - pc.lengthMm, z: D, w: pc.widthMm, h: pc.lengthMm, d: FRONT_THICKNESS_MM };
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
      case /^front-sertar:\d+$/.test(pc.key): {
        const i = Number(pc.key.split(':')[1]);
        const heights = drawerFrontHeights(input, cc, legDeduct);
        let topY = carcassH - g;
        for (let k = 0; k < i; k++) topY -= heights[k] + cc.frontGapMm;
        if (isGola) topY -= cc.golaFrontDeductMm; // profilul fiecărui sertar e deasupra frontului
        pc.placement = {
          x: frontX0, y: topY - pc.lengthMm, z: D,
          w: pc.widthMm, h: pc.lengthMm, d: FRONT_THICKNESS_MM,
        };
        break;
      }
      case pc.key.startsWith('sertar:'): {
        const i = Number(pc.key.split(':')[1]);
        const heights = drawerFrontHeights(input, cc, legDeduct);
        let topY = carcassH - g;
        for (let k = 0; k < i; k++) topY -= heights[k] + cc.frontGapMm;
        const boxBottom = Math.max(0, topY - heights[i] + 20); // cutia stă pe glisieră, aproximativ
        const { nominalMm } = pickSlideNominal(D, cc);
        const part = pc.key.split(':')[2];
        if (part === 'laterala') {
          const j = Number(pc.key.split(':')[3]);
          const x = j === 0 ? t + cc.palBoxSlideAllowanceMm / 2 : W - t - cc.palBoxSlideAllowanceMm / 2 - th;
          pc.placement = { x, y: boxBottom, z: D - nominalMm, w: th, h: pc.widthMm, d: pc.lengthMm };
        } else if (part === 'fata' || part === 'spate') {
          pc.placement = {
            x: t + cc.palBoxSlideAllowanceMm / 2 + th, y: boxBottom,
            z: part === 'fata' ? D - th : D - nominalMm,
            w: pc.lengthMm, h: pc.widthMm, d: th,
          };
        } else { // fund
          pc.placement = {
            x: t + cc.palBoxSlideAllowanceMm / 2, y: boxBottom, z: D - nominalMm,
            w: pc.widthMm, h: th, d: pc.lengthMm,
          };
        }
        break;
      }
      // piese libere: fără placement
    }
  }
}
