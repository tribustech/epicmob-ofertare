import { findMaterial } from './carcass';
import { pickSlideNominal } from './drawers';
import { doorWeightKg, suggestHingeCount } from './hinges';
import type {
  CabinetInput, Catalogs, ConstructionConstants, FrontInfo, HandleType,
  HardwareDefaults, HardwareItem, HardwareLine, HardwareSuggestion, Warning,
} from './types';

const LEGGED_TYPES = new Set(['BAZA', 'INALT', 'COLT']);

export function suggestHardware(
  input: CabinetInput,
  fronts: FrontInfo[],
  catalogs: Catalogs,
  cc: ConstructionConstants,
): { suggestions: HardwareSuggestion[]; warnings: Warning[] } {
  const suggestions: HardwareSuggestion[] = [];
  const warnings: Warning[] = [];

  const doors = fronts.filter((f) => f.kind === 'USA');
  const drawerFronts = fronts.filter((f) => f.kind === 'SERTAR');

  if (doors.length > 0 && input.frontMaterialId) {
    const frontMat = findMaterial(catalogs, input.frontMaterialId);
    let totalHinges = 0;
    for (const door of doors) {
      const weight = doorWeightKg(door.widthMm, door.heightMm, frontMat.thicknessMm, cc);
      const { count, warnings: hw } = suggestHingeCount(door.heightMm, door.widthMm, weight, cc);
      totalHinges += count;
      warnings.push(...hw.map((w) => ({ ...w, cabinetLabel: input.label })));
    }
    suggestions.push({
      category: 'BALAMA',
      name: `Balama + plăcuță (${doors.length} ușă/uși)`,
      qty: totalHinges,
      preferredId: input.hardwareSel?.hingeId,
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
        category: 'SERTAR',
        name: `Set Tandembox ${nominalMm}mm${boxH !== undefined ? ` H${boxH}` : ''}`,
        qty: drawerFronts.length,
        nominalLengthMm: nominalMm,
        boxHeightMm: boxH,
      });
    } else {
      suggestions.push({
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
  if (fronts.length > 0 && HANDLE_WITH_ITEM.includes(handle.type)) {
    suggestions.push({ category: 'MANER', name: 'Mâner', qty: fronts.length, preferredId: handle.itemId });
  } else if (handle.type === 'PUSH' && doors.length > 0) {
    // la sertare TANDEMBOX push-ul e în setul TIP-ON ales; mecanismul separat e doar pentru uși
    suggestions.push({ category: 'ACCESORIU', name: 'Mecanism push (TIP-ON)', qty: doors.length, preferredId: handle.itemId });
  }
  // PROFIL_J, GOLA, FARA: fără produs per front — costul lor intră separat (stratul de calcul al proiectului)

  if (LEGGED_TYPES.has(input.type)) {
    suggestions.push({ category: 'PICIOR', name: 'Picior reglabil', qty: cc.legsPerCabinet });
  }
  if (input.type === 'SUSPENDAT') {
    suggestions.push({ category: 'SINA_SUSPENDARE', name: 'Set suspendare corp', qty: 1 });
  }

  return { suggestions, warnings };
}

export function resolveSuggestions(
  suggestions: HardwareSuggestion[],
  defaults: HardwareDefaults,
  hardware: HardwareItem[],
): { lines: HardwareLine[]; unresolved: HardwareSuggestion[] } {
  const byId = new Map<string, number>();
  const unresolved: HardwareSuggestion[] = [];

  for (const s of suggestions) {
    let id: string | null = null;
    if (s.preferredId) {
      id = s.preferredId;
    } else if (s.category === 'SERTAR' && s.boxHeightMm !== undefined) {
      // set Tandembox: aceeași înălțime de laterală + nominala cea mai apropiată
      const sets = hardware.filter(
        (h) => h.category === 'SERTAR' && h.boxHeightMm === s.boxHeightMm && h.nominalLengthMm != null,
      );
      if (sets.length > 0 && s.nominalLengthMm !== undefined) {
        const target = s.nominalLengthMm;
        id = sets.reduce((a, b) =>
          Math.abs(b.nominalLengthMm! - target) < Math.abs(a.nominalLengthMm! - target) ? b : a,
        ).id;
      }
    } else if (s.category === 'BALAMA') id = defaults.hingeId;
    else if (s.category === 'MANER') id = defaults.handleId;
    else if (s.category === 'PICIOR') id = defaults.legId;
    else if (s.category === 'SINA_SUSPENDARE') id = defaults.railId;
    else if (s.category === 'SERTAR' && s.nominalLengthMm !== undefined) {
      const nominals = Object.keys(defaults.slideIdsByNominal).map(Number);
      if (nominals.length > 0) {
        const target = s.nominalLengthMm;
        const closest = nominals.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
        id = defaults.slideIdsByNominal[closest];
      }
    }

    if (id) byId.set(id, (byId.get(id) ?? 0) + s.qty);
    else unresolved.push(s);
  }

  return {
    lines: [...byId.entries()].map(([hardwareId, qty]) => ({ hardwareId, qty })),
    unresolved,
  };
}
