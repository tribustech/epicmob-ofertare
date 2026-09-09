import { describe, expect, it } from 'vitest';
import { expandCabinet } from '../index';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';
import type { CabinetInput } from '../types';

const cc = DEFAULT_CONSTRUCTION;

function sertareInput(columns?: number): CabinetInput {
  return bazaInput({
    label: 'S', type: 'BAZA', doors: 0, shelves: 0,
    drawers: { count: 2, columns, system: 'TANDEMBOX' },
    frontMaterialId: 'pal-alb',
    edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-1' },
  });
}

describe('assignPlacements — fronturi de sertar (poziție 3D)', () => {
  it('fiecare front de sertar primește placement (altfel nu se randează în 3D)', () => {
    const { pieces } = expandCabinet(sertareInput(), TEST_CATALOGS, cc);
    const fronts = pieces.filter((p) => p.key.startsWith('front-sertar:'));
    expect(fronts).toHaveLength(2);
    expect(fronts.every((p) => p.placement)).toBe(true);
  });

  it('coloane: 2 rânduri × 2 coloane → 4 fronturi plasate pe 2 poziții orizontale', () => {
    const { pieces } = expandCabinet(sertareInput(2), TEST_CATALOGS, cc);
    const fronts = pieces.filter((p) => p.key.startsWith('front-sertar:'));
    expect(fronts).toHaveLength(4);
    expect(fronts.every((p) => p.placement)).toBe(true);
    const xs = [...new Set(fronts.map((p) => Math.round(p.placement!.x)))].sort((a, b) => a - b);
    expect(xs).toHaveLength(2);         // două coloane la x diferit
    expect(xs[1]).toBeGreaterThan(xs[0]);
    // fronturile pe coloană sunt mai înguste decât corpul
    expect(fronts[0].widthMm).toBeLessThan(sertareInput(2).widthMm / 2);
  });

  it('cutiile PAL_BOX pe coloane primesc și ele placement distinct', () => {
    const input = sertareInput(2);
    input.drawers!.system = 'PAL_BOX';
    input.drawers!.bottomMaterialId = 'pfl-alb';
    const { pieces } = expandCabinet(input, TEST_CATALOGS, cc);
    const boxes = pieces.filter((p) => p.key.startsWith('sertar:'));
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every((p) => p.placement)).toBe(true);
  });
});
