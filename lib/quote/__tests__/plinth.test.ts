import { describe, expect, it } from 'vitest';
import type { CabinetInput } from '@/lib/engine';
import { buildPlinthParts, cabinetHasPlinth } from '../plinth';
import { refCabinet } from './fixtures';

function cabinet(
  id: string,
  overrides: Partial<CabinetInput> = {},
  plinthEnabled = false,
) {
  return {
    id,
    assemblyId: 'a1',
    plinthEnabled,
    input: { ...refCabinet(), label: id, ...overrides },
  };
}

describe('buildPlinthParts', () => {
  it('creează o piesă lungă pentru corpurile de la sol ale ansamblului', () => {
    const parts = buildPlinthParts({
      assemblies: [{ id: 'a1', name: 'Bucătărie', plinthMode: 'ASSEMBLY' }],
      cabinets: [
        cabinet('B1', { widthMm: 600 }),
        cabinet('B2', { widthMm: 800, type: 'INALT' }),
        cabinet('S1', { widthMm: 900, type: 'SUSPENDAT' }),
      ],
    });

    expect(parts).toEqual([expect.objectContaining({
      cabinetLabel: 'Bucătărie',
      name: 'Plintă ansamblu',
      lengthMm: 1400,
      widthMm: 100,
      qty: 1,
      materialId: 'pal-alb',
    })]);
  });

  it('separă plinta ansamblului când corpurile au materiale diferite', () => {
    const parts = buildPlinthParts({
      assemblies: [{ id: 'a1', name: 'Mobilier', plinthMode: 'ASSEMBLY' }],
      cabinets: [
        cabinet('C1', { widthMm: 500, carcassMaterialId: 'pal-alb' }),
        cabinet('C2', { widthMm: 700, carcassMaterialId: 'pal-stejar' }),
      ],
    });

    expect(parts.map((part) => [part.lengthMm, part.materialId])).toEqual([
      [500, 'pal-alb'],
      [700, 'pal-stejar'],
    ]);
  });

  it('creează piese individuale doar pentru corpurile selectate', () => {
    const parts = buildPlinthParts({
      assemblies: [{ id: 'a1', name: 'Baie', plinthMode: 'CABINETS' }],
      cabinets: [
        cabinet('C1', { widthMm: 500 }, true),
        cabinet('C2', { widthMm: 700 }, false),
        cabinet('S1', { widthMm: 450, type: 'SUSPENDAT' }, true),
      ],
    });

    expect(parts.map((part) => [part.cabinetLabel, part.lengthMm, part.widthMm])).toEqual([
      ['C1', 500, 100],
      ['S1', 450, 100],
    ]);
  });

  it('nu generează plintă atunci când modul este dezactivat', () => {
    expect(buildPlinthParts({
      assemblies: [{ id: 'a1', name: 'Dormitor', plinthMode: 'NONE' }],
      cabinets: [cabinet('C1', {}, true)],
    })).toEqual([]);
  });
});

describe('cabinetHasPlinth', () => {
  it('aplică plinta ansamblului doar corpurilor de la sol', () => {
    expect(cabinetHasPlinth('ASSEMBLY', refCabinet(), false)).toBe(true);
    expect(cabinetHasPlinth('ASSEMBLY', { ...refCabinet(), type: 'SUSPENDAT' }, false)).toBe(false);
  });

  it('aplică plinta individuală corpului selectat indiferent de tip', () => {
    expect(cabinetHasPlinth('CABINETS', { ...refCabinet(), type: 'SUSPENDAT' }, true)).toBe(true);
    expect(cabinetHasPlinth('CABINETS', refCabinet(), false)).toBe(false);
  });
});
