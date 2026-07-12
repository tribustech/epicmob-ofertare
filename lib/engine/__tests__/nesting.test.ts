import { describe, expect, it } from 'vitest';
import { nestParts, type NestPiece } from '../nesting';

// Placă de test 1000×500, trim 10, kerf 4 → arie utilă 980×480.
const P = { kerfMm: 4, trimMm: 10 };
const piece = (label: string, lengthMm: number, widthMm: number): NestPiece =>
  ({ label, lengthMm, widthMm });

describe('nestParts — plasare pe o placă', () => {
  it('două piese pe același raft, cu kerf între ele și trim la margini', () => {
    const r = nestParts([piece('A', 488, 480), piece('B', 488, 480)], 1000, 500, P);
    expect(r.sheets).toHaveLength(1);
    expect(r.sheets[0].pieces).toEqual([
      { label: 'A', lengthMm: 488, widthMm: 480, x: 10, y: 10 },
      { label: 'B', lengthMm: 488, widthMm: 480, x: 502, y: 10 }, // 10 + 488 + 4
    ]);
  });

  it('raft nou sub primul, cu kerf între rafturi', () => {
    const r = nestParts([piece('A', 980, 238), piece('B', 980, 238)], 1000, 500, P);
    expect(r.sheets).toHaveLength(1);
    expect(r.sheets[0].pieces).toEqual([
      { label: 'A', lengthMm: 980, widthMm: 238, x: 10, y: 10 },
      { label: 'B', lengthMm: 980, widthMm: 238, x: 10, y: 252 }, // 10 + 238 + 4
    ]);
  });

  it('sortare FFD: piesa mai lată deschide primul raft, cea îngustă intră după', () => {
    // dată în ordine inversă — sortarea descrescătoare după lățime o pune pe cea de 400 prima
    const r = nestParts([piece('mic', 300, 100), piece('mare', 500, 400)], 1000, 500, P);
    expect(r.sheets).toHaveLength(1);
    const mare = r.sheets[0].pieces.find((p) => p.label === 'mare')!;
    const mic = r.sheets[0].pieces.find((p) => p.label === 'mic')!;
    expect(mare).toMatchObject({ x: 10, y: 10 });
    expect(mic).toMatchObject({ x: 514, y: 10 }); // pe același raft: 10 + 500 + 4
  });

  it('fără rotație: piesă 480×700 (lungime < lățime) NU se rotește ca să încapă', () => {
    // 480 ≤ 980 pe lungime, dar 700 > 480 pe lățime → nu încape, deși rotită ar încăpea
    expect(() => nestParts([piece('X', 480, 700)], 1000, 500, P)).toThrow(/X/);
  });
});
