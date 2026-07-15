import { describe, expect, it } from 'vitest';
import { buildIsoModel } from '../geometry';
import { DEFAULT_CONSTRUCTION } from '@/lib/engine';
import { bazaInput } from '@/lib/engine/__tests__/fixtures';

const MDF = {
  supplierId: 'sup', modelId: 'mod', finish: 'MAT' as const, faces: 1,
  ralCode: 'RAL 9016', colorCategory: 'NORMALA' as const,
};

describe('buildIsoModel — MDF vopsit desenează fronturile', () => {
  it('uși: MDF vopsit (frontMaterialId null) → uși + mânere în desen', () => {
    const input = bazaInput({ doors: 2, frontMaterialId: null, frontKind: 'MDF_VOPSIT', mdfFront: MDF });
    const { fronts } = buildIsoModel(input, DEFAULT_CONSTRUCTION);
    expect(fronts.filter((f) => f.kind === 'USA').length).toBe(2);
    expect(fronts.some((f) => f.handle)).toBe(true);
  });

  it('sertare: MDF vopsit → fronturi de sertar în desen', () => {
    const input = bazaInput({
      doors: 0, drawers: { count: 3, system: 'TANDEMBOX' },
      frontMaterialId: null, frontKind: 'MDF_VOPSIT', mdfFront: MDF,
    });
    const { fronts } = buildIsoModel(input, DEFAULT_CONSTRUCTION);
    expect(fronts.filter((f) => f.kind === 'SERTAR').length).toBe(3);
    expect(fronts.some((f) => f.handle)).toBe(true);
  });

  it('placă (frontMaterialId set) desenează la fel — regresie', () => {
    const board = bazaInput({ doors: 2, frontKind: 'PAL' });
    const { fronts } = buildIsoModel(board, DEFAULT_CONSTRUCTION);
    expect(fronts.filter((f) => f.kind === 'USA').length).toBe(2);
  });
});
