// Nesting guillotine pe rafturi (shelf First-Fit Decreasing), fără rotație:
// lungimea piesei e mereu paralelă cu lungimea plăcii (fibra e pe lungime).
// Unități: mm. Coordonate: x pe lungimea plăcii, y pe lățime, origine colțul plăcii.

export interface NestParams { kerfMm: number; trimMm: number }
export interface NestPiece { label: string; lengthMm: number; widthMm: number }
export interface PlacedPiece extends NestPiece { x: number; y: number }
export interface SheetLayout { pieces: PlacedPiece[] }
export interface NestResult { sheets: SheetLayout[]; wastePct: number }

export const DEFAULT_NEST_PARAMS: NestParams = { kerfMm: 4, trimMm: 10 };

interface Shelf { y: number; heightMm: number; usedLengthMm: number }
interface WorkSheet { shelves: Shelf[]; pieces: PlacedPiece[] }

export function nestParts(
  pieces: NestPiece[],
  sheetLengthMm: number,
  sheetWidthMm: number,
  params: NestParams,
  allowRotate = false,
): NestResult {
  const usableL = sheetLengthMm - 2 * params.trimMm;
  const usableW = sheetWidthMm - 2 * params.trimMm;

  // materiale fără direcție de fibră (PFL, UNI etc.): piesa poate fi rotită → orientăm
  // latura lungă pe lungimea plăcii, ca să încapă și piesele late-dar-scurte (ex. spate corp lat)
  const oriented = allowRotate
    ? pieces.map((p) => (p.lengthMm >= p.widthMm ? p : { ...p, lengthMm: p.widthMm, widthMm: p.lengthMm }))
    : pieces;

  for (const p of oriented) {
    if (p.lengthMm > usableL || p.widthMm > usableW) {
      throw new Error(
        `Piesa „${p.label}" (${p.lengthMm}×${p.widthMm} mm) nu încape pe placa de ` +
        `${sheetLengthMm}×${sheetWidthMm} mm (arie utilă ${usableL}×${usableW} mm` +
        `${allowRotate ? '' : ', fără rotație'})`,
      );
    }
  }

  // comparare directă pe string, nu localeCompare — ordinea trebuie să fie
  // independentă de locale-ul runtime-ului (rulează și în browser).
  const sorted = [...oriented].sort((a, b) =>
    b.widthMm - a.widthMm || b.lengthMm - a.lengthMm ||
    (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));

  const sheets: WorkSheet[] = [];
  for (const p of sorted) {
    if (!placeOnExistingSheets(sheets, p, usableL, usableW, params)) {
      sheets.push({
        shelves: [{ y: 0, heightMm: p.widthMm, usedLengthMm: p.lengthMm }],
        pieces: [{ ...p, x: params.trimMm, y: params.trimMm }],
      });
    }
  }

  const pieceArea = pieces.reduce((s, p) => s + p.lengthMm * p.widthMm, 0);
  const usedArea = sheets.length * sheetLengthMm * sheetWidthMm;
  return {
    sheets: sheets.map((s) => ({ pieces: s.pieces })),
    wastePct: sheets.length === 0 ? 0 : (1 - pieceArea / usedArea) * 100,
  };
}

function placeOnExistingSheets(
  sheets: WorkSheet[], p: NestPiece,
  usableL: number, usableW: number, params: NestParams,
): boolean {
  for (const sheet of sheets) {
    for (const shelf of sheet.shelves) {
      const x = shelf.usedLengthMm + params.kerfMm;
      if (p.widthMm <= shelf.heightMm && x + p.lengthMm <= usableL) {
        sheet.pieces.push({ ...p, x: params.trimMm + x, y: params.trimMm + shelf.y });
        shelf.usedLengthMm = x + p.lengthMm;
        return true;
      }
    }
    const last = sheet.shelves[sheet.shelves.length - 1];
    const y = last.y + last.heightMm + params.kerfMm;
    if (y + p.widthMm <= usableW) {
      sheet.shelves.push({ y, heightMm: p.widthMm, usedLengthMm: p.lengthMm });
      sheet.pieces.push({ ...p, x: params.trimMm, y: params.trimMm + y });
      return true;
    }
  }
  return false;
}
