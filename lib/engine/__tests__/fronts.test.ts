import { describe, expect, it } from 'vitest';
import { drawerFrontHeights, expandFronts } from '../fronts';
import { toParts } from '../pieces';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';
import type { CabinetInput } from '../types';

function sertareInput(overrides: Partial<CabinetInput> = {}): CabinetInput {
  return bazaInput({
    label: 'S1', type: 'BAZA', doors: 0,
    drawers: { count: 3, system: 'TANDEMBOX' },
    frontMaterialId: 'pal-alb',
    edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-1' },
    ...overrides,
  });
}

describe('expandFronts — uși', () => {
  it('o ușă: W−2 × H−2, MDF vopsit fără cant', () => {
    const { pieces, fronts } = expandFronts(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const parts = toParts(pieces);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      name: 'Ușă', lengthMm: 718, widthMm: 598, qty: 1, materialId: 'mdf-vopsit', edges: {},
    });
    expect(fronts).toEqual([{ kind: 'USA', widthMm: 598, heightMm: 718 }]);
  });

  it('două uși: (600−2−2)/2 = 298 fiecare; PAL cu cant pe 4 laturi', () => {
    const input = bazaInput({
      doors: 2, frontMaterialId: 'pal-alb',
      edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-1' },
    });
    const { pieces } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const parts = toParts(pieces);
    expect(parts[0]).toMatchObject({
      widthMm: 298, qty: 2,
      edges: { l1: 'abs-1', l2: 'abs-1', w1: 'abs-1', w2: 'abs-1' },
    });
  });

  it('MDF înfoliat: fără cant chiar dacă frontPerimeterId e setat', () => {
    const input = bazaInput({
      frontMaterialId: 'mdf-infoliat',
      edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-1' },
    });
    const { pieces } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const parts = toParts(pieces);
    expect(parts[0]).toMatchObject({ materialId: 'mdf-infoliat', edges: {} });
  });

  it('sticla cu ramă este front complet fără cant ABS', () => {
    const catalogs = {
      ...TEST_CATALOGS,
      materials: [
        ...TEST_CATALOGS.materials,
        {
          id: 'sticla-rama-standard', name: 'Sticlă cu ramă', kind: 'STICLA_RAMA',
          thicknessMm: 20, sheetLengthMm: 3000, sheetWidthMm: 2000,
          pricing: { mode: 'PER_SQM', pricePerSqm: 400 },
        },
      ],
    } as typeof TEST_CATALOGS;
    const input = bazaInput({
      frontKind: 'STICLA_RAMA' as CabinetInput['frontKind'],
      frontMaterialId: 'sticla-rama-standard',
      edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-1' },
    });
    const { pieces } = expandFronts(input, catalogs, DEFAULT_CONSTRUCTION);

    expect(toParts(pieces)[0]).toMatchObject({
      name: 'Ușă', materialId: 'sticla-rama-standard', edges: {},
    });
  });

  it('avertizează la ușă peste 650mm lățime', () => {
    const input = bazaInput({ widthMm: 700, doors: 1 });
    const { warnings } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(warnings.some((w) => w.code === 'DOOR_WIDTH')).toBe(true);
  });

  it('fără fronturi când frontMaterialId e null', () => {
    const input = bazaInput({ frontMaterialId: null });
    const { pieces, fronts } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(pieces).toEqual([]);
    expect(fronts).toEqual([]);
  });
});

describe('expandFronts — sertare', () => {
  it('3 fronturi egale: (720−2−4)/3 = 238', () => {
    const heights = drawerFrontHeights(sertareInput(), DEFAULT_CONSTRUCTION);
    expect(heights).toHaveLength(3);
    expect(heights[0]).toBeCloseTo(238, 1);

    const { pieces, fronts } = expandFronts(sertareInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const parts = toParts(pieces);
    expect(parts).toHaveLength(1); // qty 3 pe o singură linie de piesă identică
    expect(parts[0]).toMatchObject({ name: 'Front sertar', widthMm: 598, qty: 3 });
    expect(fronts.filter((f) => f.kind === 'SERTAR')).toHaveLength(3);
  });

  it('respectă frontHeightsMm explicite', () => {
    const input = sertareInput();
    input.drawers!.frontHeightsMm = [140, 283, 283];
    const heights = drawerFrontHeights(input, DEFAULT_CONSTRUCTION);
    expect(heights).toEqual([140, 283, 283]);
  });
});

describe('expandFronts — fronturi false', () => {
  it('fals stânga: piesă nominal−1, la ras; ușa pe lățimea rămasă', () => {
    const input = bazaInput({ falseFronts: { stangaMm: 100 } });
    const { pieces, fronts } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const fals = pieces.find((p) => p.key === 'fals:stanga')!;
    const door = pieces.find((p) => p.name === 'Ușă')!;
    expect(fals).toMatchObject({ name: 'Front fals', widthMm: 99, lengthMm: 718 });
    expect(door.widthMm).toBeCloseTo(498, 5); // 600 − 100 − 1 − 1
    expect(fronts).toHaveLength(1); // falsul NU e FrontInfo (fără balamale)
  });

  it('COLT legacy: blindPanelWidthMm devine fals stânga', () => {
    const input = bazaInput({ type: 'COLT', blindPanelWidthMm: 100 });
    const { pieces } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(pieces.find((p) => p.key === 'fals:stanga')!.widthMm).toBe(99);
  });

  it('COLT legacy fără valoare: defaultul din constante', () => {
    const input = bazaInput({ type: 'COLT' });
    const { pieces } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(pieces.find((p) => p.key === 'fals:stanga')!.widthMm).toBe(99);
  });

  it('fals ≥ lățimea corpului → eroare', () => {
    const input = bazaInput({ falseFronts: { stangaMm: 600 } });
    expect(() => expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION)).toThrow(/imposibilă/i);
  });

  it('fals negativ → eroare', () => {
    const input = bazaInput({ falseFronts: { stangaMm: -10 } });
    expect(() => expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION)).toThrow(/negativ/i);
  });
});

describe('expandFronts — validare frontHeightsMm', () => {
  it('frontHeightsMm cu valoare 0 → eroare', () => {
    const input = sertareInput();
    input.drawers!.frontHeightsMm = [0, 283, 283];
    expect(() => drawerFrontHeights(input, DEFAULT_CONSTRUCTION)).toThrow(/imposibilă/i);
  });

  it('frontHeightsMm cu valoare negativă → eroare', () => {
    const input = sertareInput();
    input.drawers!.frontHeightsMm = [-50, 283, 283];
    expect(() => drawerFrontHeights(input, DEFAULT_CONSTRUCTION)).toThrow(/imposibilă/i);
  });
});
