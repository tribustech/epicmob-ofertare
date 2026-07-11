import { describe, expect, it } from 'vitest';
import { aggregateHardware, cutListCsv } from '../cutlist';
import { TEST_CATALOGS } from './fixtures';
import type { Part } from '../types';

const PARTS: Part[] = [
  {
    cabinetLabel: 'B1', name: 'Laterală', lengthMm: 720, widthMm: 560, qty: 2,
    materialId: 'pal-alb', edges: { l1: 'abs-04' },
  },
  {
    cabinetLabel: 'B1', name: 'Ușă', lengthMm: 716, widthMm: 296.5, qty: 2,
    materialId: 'mdf-vopsit', edges: {},
  },
];

describe('cutListCsv', () => {
  it('un fișier per material, cu antet și rânduri corecte', () => {
    const files = cutListCsv(PARTS, TEST_CATALOGS);
    expect(files).toHaveLength(2);

    const pal = files.find((f) => f.materialId === 'pal-alb')!;
    const lines = pal.csv.trim().split('\n');
    expect(lines[0]).toBe('Corp;Denumire;Lungime;Latime;Buc;Cant L1;Cant L2;Cant l1;Cant l2');
    expect(lines[1]).toBe('B1;Laterală;720;560;2;ABS 0.4mm;;;');

    const mdf = files.find((f) => f.materialId === 'mdf-vopsit')!;
    // zecimale cu virgulă
    expect(mdf.csv).toContain('B1;Ușă;716;296,5;2;;;;');
  });
});

describe('aggregateHardware', () => {
  it('agregă pe denumire cu cantități totale', () => {
    const items = [
      { id: 'h1', name: 'Balama Blum', category: 'BALAMA' as const, pricePerUnit: 15 },
      { id: 'h2', name: 'Mâner', category: 'MANER' as const, pricePerUnit: 10 },
    ];
    const rows = aggregateHardware(
      [{ hardwareId: 'h1', qty: 4 }, { hardwareId: 'h1', qty: 2 }, { hardwareId: 'h2', qty: 3 }],
      items,
    );
    expect(rows).toContainEqual({ name: 'Balama Blum', qty: 6 });
    expect(rows).toContainEqual({ name: 'Mâner', qty: 3 });
  });
});
