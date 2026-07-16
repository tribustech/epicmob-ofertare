/**
 * Feronerie v4 — migrare idempotentă (npm run db:migrate-hardware):
 * 1. Adaugă în catalog produsele de bază pentru categoriile noi (suport poliță,
 *    clemă soclu, set Aventos) dacă lipsesc, și le setează ca implicite în Setări.
 * 2. Convertește `Cabinet.hardwareJson` din formatul vechi (array HardwareLine[]
 *    = „înlocuiește tot") în abateri per slot: liniile care se mapează pe un rând
 *    auto devin override de slot; restul devin `extra`; rândurile auto fără
 *    corespondent în lista veche se pun pe 0 (erau eliminate de override-ul total).
 * 3. Mută câmpurile legacy din inputJson (hardwareSel.hingeId/hingeCount/
 *    handleCount/slideId, handle.itemId de pe corp) în sloturile corespunzătoare.
 */
import { prisma } from '../lib/db';
import { expandCabinet, type CabinetInput, type HardwareAdjustments, type HardwareLine } from '../lib/engine';
import { parseConstruction, toCostCatalogs } from '../lib/catalog/convert';
import { normalizeCabinetInput } from '../lib/quote/normalize-input';
import { withResolvedHandle } from '../lib/quote/handle';
import { isCabinetInputComplete } from '../lib/quote/cabinet-form';
import { pruneAdjustments } from '../lib/quote/hardware-adjustments';

const NEW_ITEMS = [
  { id: 'suport-polita-std', name: 'Suport poliță (cui + manșon)', category: 'SUPORT_POLITA', pricePerUnit: 0.2, settingsKey: 'defaultShelfSupportId' },
  { id: 'clema-soclu-std', name: 'Clemă soclu', category: 'CLEMA_SOCLU', pricePerUnit: 1, settingsKey: 'defaultPlinthClipId' },
  { id: 'aventos-hk-std', name: 'Set Aventos HK (2 brațe)', category: 'PISTON_AVENTOS', pricePerUnit: 180, settingsKey: 'defaultAventosId' },
] as const;

async function seedNewCategories() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  for (const item of NEW_ITEMS) {
    await prisma.hardwareItem.upsert({
      where: { id: item.id },
      update: {},
      create: { id: item.id, name: item.name, category: item.category, pricePerUnit: item.pricePerUnit, active: true },
    });
    if (settings && !settings[item.settingsKey]) {
      await prisma.appSettings.update({ where: { id: 1 }, data: { [item.settingsKey]: item.id } });
      console.log(`Setări: ${item.settingsKey} → ${item.name}`);
    }
  }
}

async function migrateCabinets() {
  const [materials, edgeBands, hardware, settings, cabinets] = await Promise.all([
    prisma.material.findMany(),
    prisma.edgeBand.findMany(),
    prisma.hardwareItem.findMany(),
    prisma.appSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.cabinet.findMany({ include: { project: true } }),
  ]);
  const catalogs = toCostCatalogs(materials, edgeBands, [], []);
  const cc = parseConstruction(settings.constructionJson);
  const categoryOf = (hid: string) => hardware.find((h) => h.id === hid)?.category ?? null;

  let migrated = 0;
  for (const cab of cabinets) {
    const rawInput = JSON.parse(cab.inputJson) as CabinetInput;
    const input = normalizeCabinetInput(rawInput);
    const legacyLines: HardwareLine[] | null =
      cab.hardwareJson && Array.isArray(JSON.parse(cab.hardwareJson))
        ? (JSON.parse(cab.hardwareJson) as HardwareLine[])
        : null;
    const legacySel = input.hardwareSel ?? {};
    const hasLegacyInput = legacySel.hingeId !== undefined || legacySel.hingeCount !== undefined
      || legacySel.slideId !== undefined || legacySel.handleCount !== undefined;
    if (!legacyLines && !hasLegacyInput) continue;

    const adjustments: HardwareAdjustments = { slots: {}, extra: [] };

    // sloturile auto ale corpului, pentru mapare pe categorie
    let autoSlots: { slot: string; category: string }[] = [];
    if (isCabinetInputComplete(input)) {
      try {
        const expanded = expandCabinet(
          withResolvedHandle(input, { type: cab.project.handleType as never, itemId: cab.project.handleItemId }),
          catalogs, cc,
        );
        autoSlots = expanded.hardware.map((s) => ({ slot: s.slot, category: s.category }));
      } catch {
        autoSlots = [];
      }
    }

    if (legacyLines) {
      const claimed = new Set<string>();
      for (const line of legacyLines) {
        const cat = categoryOf(line.hardwareId);
        const slot = autoSlots.find((s) => s.category === cat && !claimed.has(s.slot));
        if (slot) {
          claimed.add(slot.slot);
          adjustments.slots![slot.slot as keyof NonNullable<HardwareAdjustments['slots']>] = { itemId: line.hardwareId, qty: line.qty };
        } else {
          adjustments.extra!.push(line);
        }
      }
      // override-ul total elimina rândurile nelistate — păstrăm semantica punându-le pe 0
      for (const s of autoSlots) {
        if (!claimed.has(s.slot)) adjustments.slots![s.slot as keyof NonNullable<HardwareAdjustments['slots']>] = { qty: 0 };
      }
    }

    // câmpurile legacy din inputJson → sloturi (doar unde nu există deja override)
    const slotOf = (name: string) => autoSlots.find((s) => s.slot === name);
    if (legacySel.hingeId !== undefined || legacySel.hingeCount !== undefined) {
      if (slotOf('balamale') && !adjustments.slots!.balamale) {
        adjustments.slots!.balamale = {
          ...(legacySel.hingeId ? { itemId: legacySel.hingeId } : {}),
          ...(legacySel.hingeCount !== undefined ? { qty: legacySel.hingeCount } : {}),
        };
      }
    }
    if (legacySel.handleCount !== undefined && slotOf('maner') && !adjustments.slots!.maner) {
      adjustments.slots!.maner = { qty: legacySel.handleCount };
    }
    if (legacySel.slideId !== undefined && slotOf('sertare') && !adjustments.slots!.sertare) {
      adjustments.slots!.sertare = { itemId: legacySel.slideId };
    }

    // curățăm câmpurile legacy din inputJson (tandemboxHeightMm rămâne — e configurație)
    const cleanedSel = legacySel.tandemboxHeightMm !== undefined
      ? { tandemboxHeightMm: legacySel.tandemboxHeightMm }
      : undefined;
    const cleanedInput = { ...input, hardwareSel: cleanedSel };
    if (cleanedSel === undefined) delete (cleanedInput as Record<string, unknown>).hardwareSel;

    const pruned = pruneAdjustments(adjustments);
    await prisma.cabinet.update({
      where: { id: cab.id },
      data: {
        inputJson: JSON.stringify(cleanedInput),
        hardwareJson: pruned ? JSON.stringify(pruned) : null,
      },
    });
    migrated++;
    console.log(`Corp ${input.label} (${cab.id}): migrat${legacyLines ? ` (${legacyLines.length} linii vechi)` : ''}`);
  }
  console.log(`Gata: ${migrated} corp(uri) migrate din ${cabinets.length}.`);
}

seedNewCategories()
  .then(migrateCabinets)
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
