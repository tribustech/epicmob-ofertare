import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SUPPLIER_ID = 'supplier-paint-mob';

function slug(s: string) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Deterministic id. `collection` is folded in on purpose: the codes F1/F2/F3
// appear in BOTH the Front Mob frezate catalog (collection "Front") AND the
// FAGG perforate catalog (collection "Perforat"); without collection those
// would collide. Format: model-paint-mob-{collection}-{code}.
function modelId(collection: string, code: string): string {
  return `model-paint-mob-${slug(collection)}-${slug(code)}`;
}

type ModelDef = {
  code: string;
  collection: string;
  shapeFamily: string;
  tier: string;
  hasHandleMilling?: boolean;
  name?: string; // override readable label; defaults to "{code} ({collection})"
};

// M-series handle models get handle milling.
const HANDLE_MILLED = new Set(['M1', 'M2', 'M3', 'M10', 'M10-A', 'M10-R']);

function m(
  tier: string,
  collection: string,
  shapeFamily: string,
  codes: string[],
): ModelDef[] {
  return codes.map((code) => ({
    code,
    collection,
    shapeFamily,
    tier,
    hasHandleMilling: HANDLE_MILLED.has(code),
  }));
}

const MODELS: ModelDef[] = [
  // PLAN — front neted (asigură un model selectabil pentru tier-ul PLAN)
  { code: 'PLAN', collection: 'Plan', shapeFamily: 'PLAN', tier: 'PLAN', name: 'Front plan (neted)' },

  // SIMPLU
  ...m('SIMPLU', 'Front', 'CLASIC', ['F2', 'F3', 'F7', 'F11', 'F12', 'F13']),

  // MEDIU — FAGG
  ...m('MEDIU', 'Clasic', 'CLASIC', [
    'G10', 'G10-A', 'G10-R',
    'M10', 'M10-A', 'M10-R',
    'V90', 'V90-A', 'V90-R', 'V120',
  ]),
  // MEDIU — Line
  ...m('MEDIU', 'Line', 'CLASIC', ['LV55', 'LM66']),
  // MEDIU — Front
  ...m('MEDIU', 'Front', 'CLASIC', [
    'F1', 'F4', 'F6', 'F9', 'F18', 'F19', 'F21', 'F23',
  ]),

  // COMPLEX — FAGG Modern
  ...m('COMPLEX', 'Modern', 'CLASIC', ['KV5', 'KS8', 'KL5']),
  // COMPLEX — Front
  ...m('COMPLEX', 'Front', 'CLASIC', [
    'F5', 'F8', 'F10', 'F14', 'F15', 'F16', 'F17', 'F20', 'F22', 'F24',
  ]),

  // COMPLEX2 — Modern
  ...m('COMPLEX2', 'Modern', 'CLASIC', ['KM44', 'KR28', 'KG63']),

  // RIFLAJ — Front
  ...m('RIFLAJ', 'Front', 'RIFLAJ', ['R3', 'R6', 'R7']),
  // RIFLAJ2 — Front
  ...m('RIFLAJ2', 'Front', 'RIFLAJ', ['R1', 'R2', 'R4', 'R5']),

  // MEDIU handle series — Front Mob mâner-integrat
  ...m('MEDIU', 'Front', 'MANER', ['M1', 'M2', 'M3']),

  // PERFORAT_STD — uși cu zăbrele standard (model selectabil pentru tier-ul PERFORAT_STD)
  { code: 'ZABRELE', collection: 'Perforat', shapeFamily: 'PERFORAT', tier: 'PERFORAT_STD', name: 'Uși cu zăbrele (standard)' },

  // PERFORAT_FAGG
  ...m('PERFORAT_FAGG', 'Perforat', 'PERFORAT', [
    'F1', 'F2', 'F3', 'F1A', 'F2A', 'F3A',
  ]),

  // DRESSING
  ...m('DRESSING', 'Dressing', 'PERFORAT', ['D1', 'D2', 'D3', 'D4']),
];

type PriceDef = {
  tier: string;
  finish: string;
  faces: number;
  thicknessMm: number;
  pricePerSqmEur: number;
};

const PRICES: PriceDef[] = [
  // PLAN 18mm
  { tier: 'PLAN', finish: 'MAT', faces: 1, thicknessMm: 18, pricePerSqmEur: 70 },
  { tier: 'PLAN', finish: 'MAT', faces: 2, thicknessMm: 18, pricePerSqmEur: 102 },
  { tier: 'PLAN', finish: 'LUCIOS', faces: 1, thicknessMm: 18, pricePerSqmEur: 95 },
  { tier: 'PLAN', finish: 'LUCIOS', faces: 2, thicknessMm: 18, pricePerSqmEur: 148 },
  // PLAN 40mm
  { tier: 'PLAN', finish: 'MAT', faces: 1, thicknessMm: 40, pricePerSqmEur: 102 },
  { tier: 'PLAN', finish: 'MAT', faces: 2, thicknessMm: 40, pricePerSqmEur: 145 },
  { tier: 'PLAN', finish: 'LUCIOS', faces: 1, thicknessMm: 40, pricePerSqmEur: 127 },
  { tier: 'PLAN', finish: 'LUCIOS', faces: 2, thicknessMm: 40, pricePerSqmEur: 195 },
  // Single-cell tiers, 18mm, MAT, 1 face
  { tier: 'SIMPLU', finish: 'MAT', faces: 1, thicknessMm: 18, pricePerSqmEur: 105 },
  { tier: 'MEDIU', finish: 'MAT', faces: 1, thicknessMm: 18, pricePerSqmEur: 115 },
  { tier: 'COMPLEX', finish: 'MAT', faces: 1, thicknessMm: 18, pricePerSqmEur: 120 },
  { tier: 'COMPLEX2', finish: 'MAT', faces: 1, thicknessMm: 18, pricePerSqmEur: 135 },
  { tier: 'RIFLAJ', finish: 'MAT', faces: 1, thicknessMm: 18, pricePerSqmEur: 135 },
  { tier: 'RIFLAJ2', finish: 'MAT', faces: 1, thicknessMm: 18, pricePerSqmEur: 145 },
  { tier: 'PERFORAT_FAGG', finish: 'MAT', faces: 1, thicknessMm: 18, pricePerSqmEur: 150 },
  { tier: 'PERFORAT_STD', finish: 'MAT', faces: 1, thicknessMm: 18, pricePerSqmEur: 125 },
  { tier: 'DRESSING', finish: 'MAT', faces: 1, thicknessMm: 18, pricePerSqmEur: 158 },
];

async function main() {
  // Guard: no two model defs may resolve to the same deterministic id.
  const ids = new Set<string>();
  const collisions: string[] = [];
  for (const d of MODELS) {
    const id = modelId(d.collection, d.code);
    if (ids.has(id)) collisions.push(id);
    ids.add(id);
  }
  if (collisions.length > 0) {
    throw new Error(
      `FrontModel id collisions detected (${collisions.length}): ${collisions.join(', ')}`,
    );
  }

  // Supplier
  const supplierData = {
    name: 'Paint Mob Design',
    productType: 'VOPSIT',
    currency: 'EUR',
    handleMillingEur: 7,
    vividSurchargeEur: 13,
    metallicSurchargeEur: 36,
    blackGlossEurPerFace: 6,
    active: true,
  };
  await prisma.frontSupplier.upsert({
    where: { id: SUPPLIER_ID },
    create: { id: SUPPLIER_ID, ...supplierData },
    update: supplierData,
  });

  // Models
  let modelCount = 0;
  for (const d of MODELS) {
    const id = modelId(d.collection, d.code);
    const data = {
      supplierId: SUPPLIER_ID,
      code: d.code,
      name: d.name ?? `${d.code} (${d.collection})`,
      shapeFamily: d.shapeFamily,
      tier: d.tier,
      collection: d.collection,
      hasHandleMilling: d.hasHandleMilling ?? false,
      imageUrl: null,
      active: true,
    };
    await prisma.frontModel.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    modelCount++;
  }

  // Prices
  let priceCount = 0;
  for (const p of PRICES) {
    await prisma.frontPrice.upsert({
      where: {
        supplierId_tier_finish_faces_thicknessMm: {
          supplierId: SUPPLIER_ID,
          tier: p.tier,
          finish: p.finish,
          faces: p.faces,
          thicknessMm: p.thicknessMm,
        },
      },
      create: { supplierId: SUPPLIER_ID, ...p },
      update: { pricePerSqmEur: p.pricePerSqmEur },
    });
    priceCount++;
  }

  const suppliers = await prisma.frontSupplier.count({ where: { id: SUPPLIER_ID } });
  console.log('Seed fronturi Paint Mob:');
  console.log(`  furnizori: ${suppliers}`);
  console.log(`  modele:    ${modelCount}`);
  console.log(`  preturi:   ${priceCount}`);
}

main().finally(() => prisma.$disconnect());
