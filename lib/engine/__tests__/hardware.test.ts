import { describe, expect, it } from 'vitest';
import { resolveSuggestions, suggestHardware } from '../hardware';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';
import type { FrontInfo, HardwareDefaults } from '../types';

const cc = DEFAULT_CONSTRUCTION;

const DEFAULTS: HardwareDefaults = {
  hingeId: 'blum-cliptop',
  slideIdsByNominal: { 450: 'tbx-450', 500: 'tbx-500' },
  handleId: 'maner-std',
  legId: 'picior-std',
  railId: 'sina-std',
};

describe('suggestHardware — corp bază cu o ușă', () => {
  const fronts: FrontInfo[] = [{ kind: 'USA', widthMm: 596, heightMm: 716 }];

  it('sugerează balamale, mâner și picioare', () => {
    const { suggestions } = suggestHardware(bazaInput(), fronts, TEST_CATALOGS, cc);
    const byCat = (c: string) => suggestions.filter((s) => s.category === c);
    expect(byCat('BALAMA')[0].qty).toBe(2);          // ușă 716mm, ~5.3kg
    expect(byCat('MANER')[0].qty).toBe(1);
    expect(byCat('PICIOR')[0].qty).toBe(4);
    expect(byCat('SINA_SUSPENDARE')).toHaveLength(0);
    expect(byCat('SERTAR')).toHaveLength(0);
  });
});

describe('suggestHardware — corp suspendat', () => {
  it('șină în loc de picioare', () => {
    const input = bazaInput({ type: 'SUSPENDAT', depthMm: 320 });
    const fronts: FrontInfo[] = [{ kind: 'USA', widthMm: 596, heightMm: 716 }];
    const { suggestions } = suggestHardware(input, fronts, TEST_CATALOGS, cc);
    expect(suggestions.some((s) => s.category === 'PICIOR')).toBe(false);
    expect(suggestions.find((s) => s.category === 'SINA_SUSPENDARE')!.qty).toBe(1);
  });
});

describe('suggestHardware — corp cu sertare', () => {
  it('un set glisiere per sertar, cu nominala corectă', () => {
    const input = bazaInput({
      type: 'BAZA', doors: 0,
      drawers: { count: 3, system: 'METAL_BOX', bottomMaterialId: 'pfl-alb' },
    });
    const fronts: FrontInfo[] = [
      { kind: 'SERTAR', widthMm: 596, heightMm: 236.67 },
      { kind: 'SERTAR', widthMm: 596, heightMm: 236.67 },
      { kind: 'SERTAR', widthMm: 596, heightMm: 236.67 },
    ];
    const { suggestions } = suggestHardware(input, fronts, TEST_CATALOGS, cc);
    const slides = suggestions.find((s) => s.category === 'SERTAR')!;
    expect(slides.qty).toBe(3);
    expect(slides.nominalLengthMm).toBe(500); // D=560 → 500
    expect(suggestions.find((s) => s.category === 'MANER')!.qty).toBe(3);
  });
});

describe('resolveSuggestions', () => {
  it('mapează pe id-uri și agregă', () => {
    const { lines, unresolved } = resolveSuggestions(
      [
        { category: 'BALAMA', name: 'Balama ușă', qty: 2 },
        { category: 'BALAMA', name: 'Balama ușă 2', qty: 2 },
        { category: 'SERTAR', name: 'Glisiere', qty: 3, nominalLengthMm: 500 },
        { category: 'MANER', name: 'Mâner', qty: 4 },
      ],
      DEFAULTS,
    );
    expect(lines).toContainEqual({ hardwareId: 'blum-cliptop', qty: 4 });
    expect(lines).toContainEqual({ hardwareId: 'tbx-500', qty: 3 });
    expect(lines).toContainEqual({ hardwareId: 'maner-std', qty: 4 });
    expect(unresolved).toEqual([]);
  });

  it('glisieră fără nominală exactă → cea mai apropiată din map', () => {
    const { lines } = resolveSuggestions(
      [{ category: 'SERTAR', name: 'Glisiere', qty: 1, nominalLengthMm: 400 }],
      DEFAULTS,
    );
    expect(lines).toContainEqual({ hardwareId: 'tbx-450', qty: 1 });
  });

  it('fără default (handleId null) → unresolved', () => {
    const { lines, unresolved } = resolveSuggestions(
      [{ category: 'MANER', name: 'Mâner', qty: 2 }],
      { ...DEFAULTS, handleId: null },
    );
    expect(lines).toEqual([]);
    expect(unresolved).toHaveLength(1);
  });
});
