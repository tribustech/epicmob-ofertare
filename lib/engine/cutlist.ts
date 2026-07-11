import { findMaterial } from './carcass';
import type { Catalogs, HardwareItem, HardwareLine, Part } from './types';

export interface CutListFile {
  materialId: string;
  materialName: string;
  csv: string;
}

export interface HardwareSummaryRow {
  name: string;
  qty: number;
}

const HEADER = 'Corp;Denumire;Lungime;Latime;Buc;Cant L1;Cant L2;Cant l1;Cant l2';

function formatMm(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

export function cutListCsv(parts: Part[], catalogs: Catalogs): CutListFile[] {
  const bandName = (id?: string) => {
    if (!id) return '';
    const band = catalogs.edgeBands.find((b) => b.id === id);
    if (!band) throw new Error(`Cant inexistent în catalog: ${id}`);
    return band.name;
  };

  const byMaterial = new Map<string, Part[]>();
  for (const p of parts) {
    const list = byMaterial.get(p.materialId) ?? [];
    list.push(p);
    byMaterial.set(p.materialId, list);
  }

  return [...byMaterial.entries()].map(([materialId, list]) => {
    const rows = list.map((p) =>
      [
        p.cabinetLabel, p.name, formatMm(p.lengthMm), formatMm(p.widthMm), p.qty,
        bandName(p.edges.l1), bandName(p.edges.l2), bandName(p.edges.w1), bandName(p.edges.w2),
      ].join(';'),
    );
    return {
      materialId,
      materialName: findMaterial(catalogs, materialId).name,
      csv: [HEADER, ...rows].join('\n') + '\n',
    };
  });
}

export function aggregateHardware(
  lines: HardwareLine[],
  items: HardwareItem[],
): HardwareSummaryRow[] {
  const byId = new Map<string, number>();
  for (const line of lines) {
    byId.set(line.hardwareId, (byId.get(line.hardwareId) ?? 0) + line.qty);
  }
  return [...byId.entries()].map(([id, qty]) => {
    const item = items.find((h) => h.id === id);
    if (!item) throw new Error(`Feronerie inexistentă în catalog: ${id}`);
    return { name: item.name, qty };
  });
}
