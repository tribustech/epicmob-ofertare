import { describe, expect, it } from 'vitest';
import { expandCarcass } from '../carcass';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';

describe('expandCarcass', () => {
  it('generează piesele carcasei pentru corp bază 600×720×560', () => {
    const { parts, warnings } = expandCarcass(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);

    const byName = (n: string) => parts.find((p) => p.name === n)!;

    // spate PFL 3mm → adâncimea lateralelor/blatului scade cu PFL 3 + șurub 2: 560 → 555
    expect(byName('Laterală')).toMatchObject({
      lengthMm: 720, widthMm: 555, qty: 2, materialId: 'pal-alb',
      edges: { l1: 'abs-04' },
    });
    expect(byName('Blat corp / Fund corp')).toMatchObject({
      lengthMm: 564, widthMm: 555, qty: 2, edges: { l1: 'abs-04' },
    });
    // polița nu e afectată de spate (stă în fața lui)
    expect(byName('Poliță')).toMatchObject({
      lengthMm: 564, widthMm: 530, qty: 1,
    });
    // spate în falț: (W − 4) × (H − 4), din PFL
    expect(byName('Spate')).toMatchObject({
      lengthMm: 716, widthMm: 596, qty: 1, materialId: 'pfl-alb', edges: {},
    });
    expect(warnings).toEqual([]);
  });

  it('spate aplicat = dimensiunea corpului', () => {
    const input = bazaInput({ back: { enabled: true, materialId: 'pfl-alb', mount: 'APLICAT' } });
    const { parts } = expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(parts.find((p) => p.name === 'Spate')).toMatchObject({ lengthMm: 720, widthMm: 600 });
  });

  it('fără spate → nicio piesă Spate', () => {
    const input = bazaInput({ back: { enabled: false, mount: 'FALT' } });
    const { parts } = expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(parts.some((p) => p.name === 'Spate')).toBe(false);
  });

  it('avertizează la poliță peste 900mm deschidere', () => {
    const input = bazaInput({ widthMm: 1000 });
    const { warnings } = expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(warnings.some((w) => w.code === 'SHELF_SPAN')).toBe(true);
  });

  it('aruncă eroare la material inexistent', () => {
    const input = bazaInput({ carcassMaterialId: 'nu-exista' });
    expect(() => expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION)).toThrow(/material/i);
  });

  it('spate activat fără materialId → eroare', () => {
    const input = bazaInput({ back: { enabled: true, mount: 'FALT' } });
    expect(() => expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION)).toThrow(/spate/i);
  });

  it('corp cu W mai mic decât 2×grosime → eroare dimensiune imposibilă', () => {
    const input = bazaInput({ widthMm: 30 });
    expect(() => expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION)).toThrow(/imposibilă/i);
  });

  it('piciorul se scade din laterală și spate la corp cu picior (BAZA)', () => {
    const { parts } = expandCarcass(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION, 100);
    const byName = (n: string) => parts.find((p) => p.name === n)!;
    // laterală: înălțime 720 − picior 100 = 620; adâncime 560 − PFL 3 − șurub 2 = 555
    expect(byName('Laterală')).toMatchObject({ lengthMm: 620, widthMm: 555 });
    // spate falț: (720 − 4 − 100) × (600 − 4) = 616 × 596 (spatele nu-și scade propria grosime)
    expect(byName('Spate')).toMatchObject({ lengthMm: 616, widthMm: 596 });
    // orizontalele: lungimea neschimbată, adâncimea scade cu PFL + șurub
    expect(byName('Blat corp / Fund corp')).toMatchObject({ lengthMm: 564, widthMm: 555 });
    // polița e în fața spatelui — neschimbată
    expect(byName('Poliță')).toMatchObject({ lengthMm: 564, widthMm: 530 });
  });

  it('tip fără picior (SUSPENDAT) nu scade piciorul, dar scade PFL + șurub', () => {
    const input = bazaInput({ type: 'SUSPENDAT' });
    const { parts } = expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION, 100);
    // fără picior pe înălțime, dar adâncimea tot scade cu PFL 3 + șurub 2
    expect(parts.find((p) => p.name === 'Laterală')).toMatchObject({ lengthMm: 720, widthMm: 555 });
    expect(parts.find((p) => p.name === 'Spate')).toMatchObject({ lengthMm: 716 });
  });

  it('spate non-PFL (ex. PAL) nu scade adâncimea', () => {
    // material de spate PAL (18mm) — nu e PFL, deci fără scădere de adâncime
    const input = bazaInput({ back: { enabled: true, materialId: 'pal-alb', mount: 'APLICAT' } });
    const { parts } = expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(parts.find((p) => p.name === 'Laterală')).toMatchObject({ lengthMm: 720, widthMm: 560 });
  });

  it('fără spate → nicio scădere de adâncime', () => {
    const input = bazaInput({ back: { enabled: false, mount: 'FALT' } });
    const { parts } = expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(parts.find((p) => p.name === 'Laterală')).toMatchObject({ widthMm: 560 });
  });

  it('urma de calcul: înălțimea are picior, adâncimea are PFL + șurub', () => {
    const { parts } = expandCarcass(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION, 100);
    const lat = parts.find((p) => p.name === 'Laterală')!;
    expect(lat.calc?.length?.terms).toEqual([
      { label: 'înălțime corp', valueMm: 720 },
      { label: 'picior', valueMm: -100 },
    ]);
    expect(lat.calc?.width).toMatchObject({ label: 'Adâncime', resultMm: 555 });
    expect(lat.calc?.width?.terms).toEqual([
      { label: 'adâncime', valueMm: 560 },
      { label: 'PFL', valueMm: -3 },
      { label: 'șurub', valueMm: -2 },
    ]);
  });

  it('fără legHeightMm laterala rămâne pe înălțimea totală (compat)', () => {
    const { parts } = expandCarcass(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const lat = parts.find((p) => p.name === 'Laterală')!;
    expect(lat.lengthMm).toBe(720);
    // termenul „picior" (0) e eliminat din urmă
    expect(lat.calc?.length?.terms).toEqual([{ label: 'înălțime corp', valueMm: 720 }]);
  });
});
