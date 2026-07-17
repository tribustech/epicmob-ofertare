import { describe, expect, it } from 'vitest';
import { expandCabinet } from '../templates';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';

const cc = DEFAULT_CONSTRUCTION;

describe('expandCabinet', () => {
  it('BAZA: carcasă + ușă + feronerie', () => {
    const r = expandCabinet(bazaInput(), TEST_CATALOGS, cc);
    const names = r.parts.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['Laterală', 'Blat corp', 'Fund corp', 'Poliță', 'Spate', 'Ușă']),
    );
    expect(r.hardware.some((h) => h.category === 'BALAMA')).toBe(true);
    expect(r.hardware.some((h) => h.category === 'PICIOR')).toBe(true);
  });

  it('SERTARE: fronturi sertar + cutii + glisiere, fără balamale', () => {
    const input = bazaInput({
      label: 'S1', type: 'BAZA', doors: 0, shelves: 0,
      drawers: { count: 3, system: 'PAL_BOX', bottomMaterialId: 'pfl-alb' },
      frontMaterialId: 'pal-alb',
      edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-1' },
    });
    const r = expandCabinet(input, TEST_CATALOGS, cc);
    expect(r.parts.some((p) => p.name === 'Front sertar')).toBe(true);
    expect(r.parts.some((p) => p.name === 'Laterală sertar')).toBe(true);
    expect(r.hardware.some((h) => h.category === 'BALAMA')).toBe(false);
    expect(r.hardware.find((h) => h.category === 'SERTAR')!.qty).toBe(3);
  });

  it('SUSPENDAT: șină, fără picioare', () => {
    const input = bazaInput({ type: 'SUSPENDAT', depthMm: 320 });
    const r = expandCabinet(input, TEST_CATALOGS, cc);
    expect(r.hardware.some((h) => h.category === 'SINA_SUSPENDARE')).toBe(true);
    expect(r.hardware.some((h) => h.category === 'PICIOR')).toBe(false);
  });

  it('COLT: include panou orb', () => {
    const input = bazaInput({ type: 'COLT' });
    const r = expandCabinet(input, TEST_CATALOGS, cc);
    expect(r.parts.some((p) => p.name === 'Panou orb')).toBe(true);
  });

  it('INALT 2100mm: 4 balamale pe ușă', () => {
    const input = bazaInput({ type: 'INALT', heightMm: 2100, doors: 1 });
    const r = expandCabinet(input, TEST_CATALOGS, cc);
    // ușă 2096mm → 4 după înălțime; greutate 0.596×2.096×18×0.695 ≈ 15.6kg ≤ 18 → rămâne 4
    expect(r.hardware.find((h) => h.category === 'BALAMA')!.qty).toBe(4);
  });

  it('uși fără material de front → eroare', () => {
    const input = bazaInput({ frontMaterialId: null, doors: 1 });
    expect(() => expandCabinet(input, TEST_CATALOGS, cc)).toThrow(/front/i);
  });

  it('uși + sertare simultan → eroare', () => {
    const input = bazaInput({
      doors: 1,
      drawers: { count: 2, system: 'TANDEMBOX' },
      shelves: 0,
    });
    expect(() => expandCabinet(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION))
      .toThrow(/fie uși, fie sertare/);
  });

  it('sertare + polițe → eroare', () => {
    const input = bazaInput({
      doors: 0, shelves: 1,
      drawers: { count: 2, system: 'TANDEMBOX' },
    });
    expect(() => expandCabinet(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION))
      .toThrow(/polițe/);
  });

  it('drawers cu count 0 → eroare', () => {
    const input = bazaInput({
      doors: 0, shelves: 0,
      drawers: { count: 0, system: 'TANDEMBOX' },
    });
    expect(() => expandCabinet(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION))
      .toThrow(/cel puțin un sertar/);
  });

  it('sertare pe corp SUSPENDAT → merge (sertarele nu mai sunt un tip)', () => {
    const input = bazaInput({
      type: 'SUSPENDAT', doors: 0, shelves: 0,
      drawers: { count: 2, system: 'TANDEMBOX' },
    });
    const result = expandCabinet(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(result.parts.filter((p) => p.name === 'Front sertar').length).toBeGreaterThan(0);
  });
});
