import { describe, expect, it } from 'vitest';
import { expandCarcass } from '../carcass';
import { toParts } from '../pieces';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';

describe('expandCarcass', () => {
  it('generează piesele carcasei pentru corp bază 600×720×560', () => {
    const { pieces, warnings } = expandCarcass(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const parts = toParts(pieces);

    const byName = (n: string) => parts.find((p) => p.name === n)!;

    // spate PFL 3mm → adâncimea lateralelor/blatului scade cu PFL 3 + șurub 2: 560 → 555
    expect(byName('Laterală')).toMatchObject({
      lengthMm: 720, widthMm: 555, qty: 2, materialId: 'pal-alb',
      edges: { l1: 'abs-04' },
    });
    // fără grupul „Blat corp / Fund corp" — sunt bucăți individuale, deci rânduri qty 1
    expect(byName('Blat corp')).toMatchObject({
      lengthMm: 564, widthMm: 555, qty: 1, edges: { l1: 'abs-04' },
    });
    expect(byName('Fund corp')).toMatchObject({
      lengthMm: 564, widthMm: 555, qty: 1, edges: { l1: 'abs-04' },
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
    const parts = toParts(expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION).pieces);
    expect(parts.find((p) => p.name === 'Spate')).toMatchObject({ lengthMm: 720, widthMm: 600 });
  });

  it('polița de sticlă folosește materialul propriu și nu primește cant ABS', () => {
    const input = bazaInput({ shelf: { materialId: 'sticla-polita-standard' } });
    const parts = toParts(expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION).pieces);

    const shelf = parts.find((p) => p.name === 'Poliță')!;
    expect(shelf.materialId).toBe('sticla-polita-standard');
    expect(shelf.edges).toEqual({});
  });

  it('fără spate → nicio piesă Spate', () => {
    const input = bazaInput({ back: { enabled: false, mount: 'FALT' } });
    const parts = toParts(expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION).pieces);
    expect(parts.some((p) => p.name === 'Spate')).toBe(false);
  });

  it('avertizează la poliță peste 900mm deschidere', () => {
    const input = bazaInput({ widthMm: 1000 });
    const { warnings } = expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(warnings.some((w) => w.code === 'SHELF_SPAN')).toBe(true);
  });

  it('generează polițe locale și separatoare structurale pentru fagure', () => {
    const input = bazaInput({
      shelves: 0,
      pieces: { honeycomb: { root: {
        id: 'separator-1', kind: 'split', axis: 'V', firstSizeMm: 280, sourceId: 'root',
        first: { id: 'left', kind: 'leaf' },
        second: {
          id: 'shelf-1', kind: 'split', axis: 'H', firstSizeMm: 300,
          sourceId: 'right', materialId: 'sticla-polita-standard',
          first: { id: 'right-bottom', kind: 'leaf' },
          second: { id: 'right-top', kind: 'leaf' },
        },
      } } },
    });
    const { pieces } = expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);

    expect(pieces.find((piece) => piece.key === 'fagure:separator-1')).toMatchObject({
      name: 'Separator vertical', lengthMm: 684, widthMm: 530, materialId: 'pal-alb',
      placement: { x: 298, y: 18, w: 18, h: 684 },
    });
    expect(pieces.find((piece) => piece.key === 'fagure:shelf-1')).toMatchObject({
      name: 'Poliță', lengthMm: 266, widthMm: 530, materialId: 'sticla-polita-standard', edges: {},
      placement: { x: 316, y: 318, w: 266, h: 8 },
    });
  });

  it('calculează avertizarea de deschidere pe segmentul sprijinit, nu pe tot corpul', () => {
    const input = bazaInput({
      widthMm: 1000, shelves: 0,
      pieces: { honeycomb: { root: {
        id: 'separator-1', kind: 'split', axis: 'V', firstSizeMm: 500, sourceId: 'root',
        first: {
          id: 'shelf-left', kind: 'split', axis: 'H', firstSizeMm: 300, sourceId: 'left',
          first: { id: 'left-bottom', kind: 'leaf' }, second: { id: 'left-top', kind: 'leaf' },
        },
        second: {
          id: 'shelf-right', kind: 'split', axis: 'H', firstSizeMm: 300, sourceId: 'right',
          first: { id: 'right-bottom', kind: 'leaf' }, second: { id: 'right-top', kind: 'leaf' },
        },
      } } },
    });
    const { warnings } = expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);

    expect(warnings.some((warning) => warning.code === 'SHELF_SPAN')).toBe(false);
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
    const parts = toParts(expandCarcass(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION, 100).pieces);
    const byName = (n: string) => parts.find((p) => p.name === n)!;
    // laterală: înălțime 720 − picior 100 = 620; adâncime 560 − PFL 3 − șurub 2 = 555
    expect(byName('Laterală')).toMatchObject({ lengthMm: 620, widthMm: 555 });
    // spate falț: (720 − 4 − 100) × (600 − 4) = 616 × 596 (spatele nu-și scade propria grosime)
    expect(byName('Spate')).toMatchObject({ lengthMm: 616, widthMm: 596 });
    // orizontalele: lungimea neschimbată, adâncimea scade cu PFL + șurub
    expect(byName('Blat corp')).toMatchObject({ lengthMm: 564, widthMm: 555 });
    expect(byName('Fund corp')).toMatchObject({ lengthMm: 564, widthMm: 555 });
    // polița e în fața spatelui — neschimbată
    expect(byName('Poliță')).toMatchObject({ lengthMm: 564, widthMm: 530 });
  });

  it('tip fără picior (SUSPENDAT) nu scade piciorul, dar scade PFL + șurub', () => {
    const input = bazaInput({ type: 'SUSPENDAT' });
    const parts = toParts(expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION, 100).pieces);
    // fără picior pe înălțime, dar adâncimea tot scade cu PFL 3 + șurub 2
    expect(parts.find((p) => p.name === 'Laterală')).toMatchObject({ lengthMm: 720, widthMm: 555 });
    expect(parts.find((p) => p.name === 'Spate')).toMatchObject({ lengthMm: 716 });
  });

  it('spate non-PFL (ex. PAL) nu scade adâncimea', () => {
    // material de spate PAL (18mm) — nu e PFL, deci fără scădere de adâncime
    const input = bazaInput({ back: { enabled: true, materialId: 'pal-alb', mount: 'APLICAT' } });
    const parts = toParts(expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION).pieces);
    expect(parts.find((p) => p.name === 'Laterală')).toMatchObject({ lengthMm: 720, widthMm: 560 });
  });

  it('fără spate → nicio scădere de adâncime', () => {
    const input = bazaInput({ back: { enabled: false, mount: 'FALT' } });
    const parts = toParts(expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION).pieces);
    expect(parts.find((p) => p.name === 'Laterală')).toMatchObject({ widthMm: 560 });
  });

  it('urma de calcul: înălțimea are picior, adâncimea are PFL + șurub', () => {
    const parts = toParts(expandCarcass(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION, 100).pieces);
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
    const parts = toParts(expandCarcass(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION).pieces);
    const lat = parts.find((p) => p.name === 'Laterală')!;
    expect(lat.lengthMm).toBe(720);
    // termenul „picior" (0) e eliminat din urmă
    expect(lat.calc?.length?.terms).toEqual([{ label: 'înălțime corp', valueMm: 720 }]);
  });
});
