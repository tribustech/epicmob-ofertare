import { findMaterial } from './carcass';
import { pickSlideNominal } from './drawers';
import { doorWeightKg, suggestHingeCount } from './hinges';
import type {
  CabinetInput, Catalogs, ConstructionConstants, FrontInfo,
  HardwareDefaults, HardwareLine, HardwareSuggestion, Warning,
} from './types';

const LEGGED_TYPES = new Set(['BAZA', 'INALT', 'SERTARE', 'COLT']);

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
    });
  }

  if (drawerFronts.length > 0) {
    const { nominalMm, warnings: sw } = pickSlideNominal(input.depthMm, cc);
    warnings.push(...sw.map((w) => ({ ...w, cabinetLabel: input.label })));
    suggestions.push({
      category: 'SERTAR',
      name: `Set glisiere/cutie ${nominalMm}mm`,
      qty: drawerFronts.length,
      nominalLengthMm: nominalMm,
    });
  }

  if (fronts.length > 0) {
    suggestions.push({ category: 'MANER', name: 'Mâner', qty: fronts.length });
  }

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
): { lines: HardwareLine[]; unresolved: HardwareSuggestion[] } {
  const byId = new Map<string, number>();
  const unresolved: HardwareSuggestion[] = [];

  for (const s of suggestions) {
    let id: string | null = null;
    if (s.category === 'BALAMA') id = defaults.hingeId;
    else if (s.category === 'MANER') id = defaults.handleId;
    else if (s.category === 'PICIOR') id = defaults.legId;
    else if (s.category === 'SINA_SUSPENDARE') id = defaults.railId;
    else if (s.category === 'SERTAR' && s.nominalLengthMm !== undefined) {
      const nominals = Object.keys(defaults.slideIdsByNominal).map(Number);
      if (nominals.length > 0) {
        const target = s.nominalLengthMm;
        const closest = nominals.reduce((a, b) =>
          Math.abs(b - target) < Math.abs(a - target) ? b : a,
        );
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
