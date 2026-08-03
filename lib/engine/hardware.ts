import { findMaterial } from './carcass';
import { LEGGED_TYPES } from './constants';
import { pickSlideNominal } from './drawers';
import { doorWeightKg, suggestHingeCount } from './hinges';
import type {
  CabinetInput, Catalogs, ConstructionConstants, FrontInfo, HandleType,
  HardwareAdjustments, HardwareDefaults, HardwareItem, HardwareLine,
  HardwareSuggestion, ResolvedSlot, Warning,
} from './types';

const SHELF_SUPPORTS_PER_SHELF = 4;
const PLINTH_CLIPS_PER_CABINET = 2;
const HOLTSURUB_SPACING_MM = 100; // un holtșurub la fiecare 10 cm de perimetru al spatelui

export function suggestHardware(
  input: CabinetInput,
  fronts: FrontInfo[],
  catalogs: Catalogs,
  cc: ConstructionConstants,
  legHeightMm?: number,
): { suggestions: HardwareSuggestion[]; warnings: Warning[] } {
  const suggestions: HardwareSuggestion[] = [];
  const warnings: Warning[] = [];

  const doors = fronts.filter((f) => f.kind === 'USA');
  const drawerFronts = fronts.filter((f) => f.kind === 'SERTAR');
  const liftUp = input.doorOpening === 'RIDICABILA' && doors.length > 0;

  if (doors.length > 0 && input.frontMaterialId && !liftUp) {
    const frontMat = findMaterial(catalogs, input.frontMaterialId);
    let totalHinges = 0;
    for (const door of doors) {
      const weight = doorWeightKg(door.widthMm, door.heightMm, frontMat.thicknessMm, cc);
      const { count, warnings: hw } = suggestHingeCount(door.heightMm, door.widthMm, weight, cc);
      totalHinges += count;
      warnings.push(...hw.map((w) => ({ ...w, cabinetLabel: input.label })));
    }
    // fallback legacy (inputJson nemigrat): numărul ales pe corp înainte de feronerie v4
    const qty = input.hardwareSel?.hingeCount ?? totalHinges;
    if (qty > 0) {
      suggestions.push({
        slot: 'balamale',
        category: 'BALAMA',
        name: `Balama + plăcuță (${doors.length} ușă/uși)`,
        qty,
        preferredId: input.hardwareSel?.hingeId,
      });
    }
  }

  if (liftUp) {
    suggestions.push({
      slot: 'aventos',
      category: 'PISTON_AVENTOS',
      name: 'Set deschidere verticală (Aventos)',
      qty: 1,
    });
  }

  if (drawerFronts.length > 0 && input.drawers) {
    const { nominalMm, warnings: sw } = pickSlideNominal(input.depthMm, cc);
    warnings.push(...sw.map((w) => ({ ...w, cabinetLabel: input.label })));
    if (input.drawers.system === 'TANDEMBOX') {
      const boxH = input.hardwareSel?.tandemboxHeightMm;
      const minFrontH = Math.min(...drawerFronts.map((f) => f.heightMm));
      if (boxH !== undefined && boxH > minFrontH - cc.tandemboxFrontClearanceMm) {
        warnings.push({
          code: 'TANDEMBOX_HEIGHT',
          message: `Laterala Tandembox de ${boxH}mm nu încape în frontul de ${Math.round(minFrontH)}mm (rezervă ${cc.tandemboxFrontClearanceMm}mm)`,
          cabinetLabel: input.label,
        });
      }
      suggestions.push({
        slot: 'sertare',
        category: 'SERTAR',
        name: `Set Tandembox ${nominalMm}mm${boxH !== undefined ? ` H${boxH}` : ''}`,
        qty: drawerFronts.length,
        nominalLengthMm: nominalMm,
        boxHeightMm: boxH,
        requiresBox: true,
      });
    } else {
      suggestions.push({
        slot: 'sertare',
        category: 'SERTAR',
        name: `Set glisiere Tandem ${nominalMm}mm`,
        qty: drawerFronts.length,
        nominalLengthMm: nominalMm,
        preferredId: input.hardwareSel?.slideId,
      });
    }
  }

  const handle = input.handle ?? { type: 'APLICAT' as const };
  const HANDLE_WITH_ITEM: HandleType[] = ['APLICAT', 'BUTON', 'INGROPAT'];
  // fallback legacy (inputJson nemigrat): numărul de mânere ales pe corp
  const handleQty = (auto: number) => input.hardwareSel?.handleCount ?? auto;
  if (fronts.length > 0 && HANDLE_WITH_ITEM.includes(handle.type)) {
    const qty = handleQty(fronts.length);
    if (qty > 0) suggestions.push({ slot: 'maner', category: 'MANER', name: 'Mâner', qty, preferredId: handle.itemId });
  } else if (handle.type === 'PUSH' && doors.length > 0) {
    // la sertare TANDEMBOX push-ul e în setul TIP-ON ales; mecanismul separat e doar pentru uși
    const qty = handleQty(doors.length);
    if (qty > 0) suggestions.push({ slot: 'maner', category: 'ACCESORIU', name: 'Mecanism push (TIP-ON)', qty, preferredId: handle.itemId });
  }
  // PROFIL_J, GOLA, FARA: fără produs per front — costul lor intră separat (stratul de calcul al proiectului)

  if (input.shelves > 0 && !input.pieces?.honeycomb) {
    suggestions.push({
      slot: 'suporti-polita',
      category: 'SUPORT_POLITA',
      name: `Suporți poliță (${input.shelves} × ${SHELF_SUPPORTS_PER_SHELF})`,
      qty: input.shelves * SHELF_SUPPORTS_PER_SHELF,
    });
  }

  if (LEGGED_TYPES.has(input.type)) {
    suggestions.push({ slot: 'picioare', category: 'PICIOR', name: 'Picior reglabil', qty: cc.legsPerCabinet });
    suggestions.push({ slot: 'cleme-soclu', category: 'CLEMA_SOCLU', name: 'Cleme soclu', qty: PLINTH_CLIPS_PER_CABINET });
  }
  if (input.type === 'SUSPENDAT') {
    suggestions.push({ slot: 'suspendare', category: 'SINA_SUSPENDARE', name: 'Set suspendare corp', qty: 1 });
  }

  // spate PFL → holtșurub pe perimetru: 1 la 10 cm din perimetrul plăcii de spate
  if (input.back.enabled && input.back.materialId) {
    const backMat = findMaterial(catalogs, input.back.materialId);
    if (backMat.kind === 'PFL') {
      const rebate = input.back.mount === 'FALT' ? cc.backRebateMm : 0;
      const legDeduct = legHeightMm && LEGGED_TYPES.has(input.type) ? legHeightMm : 0;
      const backH = input.heightMm - rebate - legDeduct;
      const backW = input.widthMm - rebate;
      const qty = Math.ceil((2 * (backH + backW)) / HOLTSURUB_SPACING_MM);
      suggestions.push({ slot: 'holtsurub', category: 'HOLTSURUB', name: 'Holtșurub spate (PFL)', qty });
    }
  }

  return { suggestions, warnings };
}

/** Produsul implicit al unui slot când corpul nu a ales nimic (preferred > default global). */
function defaultItemId(
  s: HardwareSuggestion,
  defaults: HardwareDefaults,
  hardware: HardwareItem[],
): string | null {
  if (s.preferredId) return s.preferredId;
  if (s.category === 'SERTAR' && s.requiresBox) {
    // set Tandembox: aceeași înălțime de laterală + nominala cea mai apropiată;
    // fără înălțime aleasă rămâne nerezolvat (boxHeightMm undefined ar potrivi glisierele simple)
    if (s.boxHeightMm === undefined || s.nominalLengthMm === undefined) return null;
    const sets = hardware.filter(
      (h) => h.category === 'SERTAR' && h.boxHeightMm === s.boxHeightMm && h.nominalLengthMm != null,
    );
    if (sets.length === 0) return null;
    const target = s.nominalLengthMm;
    return sets.reduce((a, b) =>
      Math.abs(b.nominalLengthMm! - target) < Math.abs(a.nominalLengthMm! - target) ? b : a,
    ).id;
  }
  if (s.category === 'SERTAR' && s.nominalLengthMm !== undefined) {
    const nominals = Object.keys(defaults.slideIdsByNominal).map(Number);
    if (nominals.length === 0) return null;
    const target = s.nominalLengthMm;
    const closest = nominals.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    return defaults.slideIdsByNominal[closest];
  }
  switch (s.category) {
    case 'BALAMA': return defaults.hingeId;
    // MANER/ACCESORIU (push): fără fallback pe un default global — produsul se
    // alege pe corp (tabelul de feronerie) sau vine din setările proiectului
    case 'PICIOR': return defaults.legId;
    case 'SINA_SUSPENDARE': return defaults.railId;
    case 'SUPORT_POLITA': return defaults.shelfSupportId;
    case 'CLEMA_SOCLU': return defaults.plinthClipId;
    case 'PISTON_AVENTOS': return defaults.aventosId;
    case 'HOLTSURUB': return defaults.holtsurubId;
    default: return null;
  }
}

/**
 * Rezolvă rândurile auto aplicând abaterile per slot (feronerie v4):
 * itemId = ales pe slot > preferat pe corp > default global; qty = aleasă pe slot > automată.
 * qty 0 elimină rândul. Rândurile `extra` se adaugă la final, ca linii directe.
 */
export function resolveSlots(
  suggestions: HardwareSuggestion[],
  adjustments: HardwareAdjustments | null,
  defaults: HardwareDefaults,
  hardware: HardwareItem[],
): ResolvedSlot[] {
  return suggestions.map((s) => {
    const adj = adjustments?.slots?.[s.slot];
    const itemId = adj?.itemId ?? defaultItemId(s, defaults, hardware);
    const qty = adj?.qty ?? s.qty;
    return {
      slot: s.slot,
      category: s.category,
      name: s.name,
      autoQty: s.qty,
      qty,
      itemId,
      itemAdjusted: adj?.itemId !== undefined,
      qtyAdjusted: adj?.qty !== undefined,
    };
  });
}

export function resolveSuggestions(
  suggestions: HardwareSuggestion[],
  adjustments: HardwareAdjustments | null,
  defaults: HardwareDefaults,
  hardware: HardwareItem[],
): { lines: HardwareLine[]; unresolved: HardwareSuggestion[]; slots: ResolvedSlot[] } {
  const slots = resolveSlots(suggestions, adjustments, defaults, hardware);

  const byId = new Map<string, number>();
  const unresolved: HardwareSuggestion[] = [];
  slots.forEach((r, i) => {
    if (r.qty <= 0) return; // rând eliminat explicit
    if (r.itemId) byId.set(r.itemId, (byId.get(r.itemId) ?? 0) + r.qty);
    else unresolved.push({ ...suggestions[i], qty: r.qty });
  });
  for (const line of adjustments?.extra ?? []) {
    // rândurile extra abia adăugate pot fi încă fără produs ales — nu intră în calcul
    if (line.hardwareId && line.qty > 0) byId.set(line.hardwareId, (byId.get(line.hardwareId) ?? 0) + line.qty);
  }

  return {
    lines: [...byId.entries()].map(([hardwareId, qty]) => ({ hardwareId, qty })),
    unresolved,
    slots,
  };
}
