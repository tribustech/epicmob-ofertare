import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CatalogRow = {
  brand: string;
  cod_decor: string | null;
  cod_normalizat: string;
  denumire: string;
  structura: string | null;
  image: string | null;
  pret_ron: number | null;
  tip: string; // "placa" | "blat" | "panou_spate"
  grosime_mm?: number | null;
  latime_mm?: number | null;
};

function slug(s: string) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function kindFor(brand: string): string {
  return brand === 'AGT' ? 'MDF_MELAMINAT' : 'PAL';
}

// Deterministic, content-based id. brand+cod_normalizat alone collides (a "placa"
// and a "blat" can share the same cod; several blaturi share a cod but differ by
// latime/grosime), so tip + dimensions are folded in to guarantee uniqueness.
function makeId(r: CatalogRow): string {
  const parts = ['decor', slug(r.brand), slug(r.cod_normalizat), slug(r.tip)];
  if (r.latime_mm != null) parts.push(String(r.latime_mm));
  if (r.grosime_mm != null) parts.push(String(r.grosime_mm));
  return parts.join('-');
}

async function main() {
  const rows: CatalogRow[] = JSON.parse(
    readFileSync('data/decoruri-furnizori/catalog-decoruri.json', 'utf8'),
  );

  // Guard against silent id collisions before touching the DB.
  const ids = new Set<string>();
  const collisions: string[] = [];
  for (const r of rows) {
    const id = makeId(r);
    if (ids.has(id)) collisions.push(id);
    ids.add(id);
  }
  if (collisions.length > 0) {
    throw new Error(
      `ID collisions detected (${collisions.length}): ${collisions.slice(0, 10).join(', ')}`,
    );
  }

  let seeded = 0;
  let noPrice = 0;
  for (const r of rows) {
    const isBlat = r.tip === 'blat' || r.tip === 'panou_spate';
    const id = makeId(r);
    const name = r.cod_decor ? `${r.cod_decor} · ${r.denumire}` : r.denumire;
    const data = {
      name,
      kind: kindFor(r.brand),
      thicknessMm: isBlat ? (r.grosime_mm ?? 38) : 18,
      sheetLengthMm: 2800,
      sheetWidthMm: 2070,
      pricingMode: 'PER_SHEET',
      pricePerSheet: r.pret_ron,
      pricePerSqm: null,
      imageUrl: r.image,
      decorCode: r.cod_decor,
      brand: r.brand,
      structura: r.structura,
      category: isBlat ? 'BLAT' : 'PLACA',
      active: true,
    };
    await prisma.material.upsert({ where: { id }, create: { id, ...data }, update: data });
    seeded++;
    if (r.pret_ron == null) noPrice++;
  }

  const distinctInDb = await prisma.material.count({ where: { id: { startsWith: 'decor-' } } });
  console.log(`Seed decoruri: ${seeded} materiale (${noPrice} fără preț).`);
  console.log(`Verificare: ${ids.size} id-uri distincte în sursă, ${distinctInDb} în DB (startsWith 'decor-').`);
}

main().finally(() => prisma.$disconnect());
