import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { normalizeCabinetInput } from '@/lib/quote/normalize-input';
import { autoLayout, blatBottomFor, defaultRoom, degToRad, DEFAULT_MOUNT, type FixedItem, type Front, type LayoutItem, type LayoutRoom } from '@/lib/quote/layout';
import type { CabinetInput } from '@/lib/engine';
import AssemblyLayout3D from '@/components/configurator/AssemblyLayout3D';

const FLOOR_TYPES = new Set(['BAZA', 'INALT', 'COLT']);

// fronturile false rezolvate (oglindește resolveFalseFronts din engine): falseFronts explicit,
// altfel COLȚ cade pe panoul orb (blindPanelWidthMm legacy sau defaultul de 100mm)
const COLT_BLIND_DEFAULT_MM = 100;
function falsOf(input: CabinetInput): { left: number; right: number } {
  if (input.falseFronts) return { left: input.falseFronts.stangaMm ?? 0, right: input.falseFronts.dreaptaMm ?? 0 };
  if (input.type === 'COLT') return { left: input.blindPanelWidthMm ?? COLT_BLIND_DEFAULT_MM, right: 0 };
  return { left: 0, right: 0 };
}

// fronturile reale ale corpului: fără material de front ⇒ nimic desenat; altfel sertare sau uși
function frontOf(input: CabinetInput): Front {
  if (input.frontMaterialId == null) return null;
  if (input.drawers && input.drawers.count > 0) {
    return { kind: 'drawers', count: input.drawers.count, heights: input.drawers.frontHeightsMm };
  }
  if (input.doors > 0) {
    const { left, right } = falsOf(input);
    return { kind: 'doors', count: input.doors, falsLeftMm: left, falsRightMm: right };
  }
  return null;
}

export default async function AsezarePage({ params }: { params: Promise<{ id: string; assemblyId: string }> }) {
  const { id, assemblyId } = await params;
  const assembly = await prisma.assembly.findUnique({
    where: { id: assemblyId },
    include: { cabinets: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!assembly || assembly.projectId !== id) notFound();

  // construiește corpurile plasabile (fără corpuri incomplete). Blatul intră ca placă:
  // grosimea (heightMm, ~38mm din specificațiile materialului) e înălțimea plăcii; îl așază operatorul.
  // fața de sus a blatului = „înălțime corpuri bază"; blatul se așază cu vârful acolo
  const blatTopMm = assembly.kind !== 'FARA_BLAT' && assembly.baseHeightMm != null ? assembly.baseHeightMm : null;

  const positioned: LayoutItem[] = [];
  const loose: LayoutItem[] = [];
  for (const c of assembly.cabinets) {
    const input = normalizeCabinetInput(JSON.parse(c.inputJson));
    const isBlat = input.type === 'BLAT';
    // blatul cere doar lungime + adâncime; grosimea cade pe 38mm dacă lipsește (blaturi vechi)
    if (!(input.widthMm > 0 && input.depthMm > 0 && (isBlat || input.heightMm > 0))) continue;
    const legMm = FLOOR_TYPES.has(input.type) ? assembly.legHeightMm : 0;
    // corp „sub blat"/pazii → fără capac plin (se randează cu vârful deschis + bare de pazie)
    const topVar = input.pieces?.top?.variant ?? (input.subBlat ? 'PAZII' : 'PLIN');
    const item: LayoutItem = {
      id: c.id, label: input.label, type: input.type,
      w: input.widthMm, h: isBlat && input.heightMm <= 0 ? 38 : input.heightMm, d: input.depthMm, legMm,
      front: frontOf(input), shelves: input.shelves ?? 0,
      cx: 0, cz: 0, by: 0, rot: 0,
      topOpen: !isBlat && (topVar === 'PAZII' || topVar === 'ABSENT'),
      pazieWidthMm: topVar === 'PAZII' ? (input.pieces?.top?.pazieWidthMm ?? 100) : undefined,
    };
    if (c.posXMm != null && c.posZMm != null) {
      positioned.push({
        ...item, cx: c.posXMm, cz: c.posZMm,
        by: c.posYMm ?? (legMm > 0 ? 0 : isBlat ? blatBottomFor(item.h, blatTopMm) : DEFAULT_MOUNT),
        rot: degToRad(c.rotDeg ?? 0),
      });
    } else {
      loose.push(item);
    }
  }

  const room: LayoutRoom = assembly.roomWidthMm != null && assembly.roomDepthMm != null && assembly.roomHeightMm != null
    ? { W: assembly.roomWidthMm, D: assembly.roomDepthMm, H: assembly.roomHeightMm }
    : defaultRoom([...positioned, ...loose]);
  if (assembly.roomWallsJson) {
    try { room.walls = JSON.parse(assembly.roomWallsJson); } catch { /* folosim pereții impliciți */ }
  }

  const items = [...positioned, ...autoLayout(positioned, loose, room, blatTopMm)];

  let fixed: FixedItem[] = [];
  try { fixed = JSON.parse(assembly.fixedElementsJson) as FixedItem[]; } catch { fixed = []; }

  return (
    <AssemblyLayout3D
      assemblyId={assembly.id}
      assemblyName={assembly.name}
      projectId={id}
      backHref={`/proiecte/${id}`}
      initialItems={items}
      initialRoom={room}
      initialFixed={fixed}
    />
  );
}
