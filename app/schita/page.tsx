import { prisma } from '@/lib/db';
import { SchitaGenerator } from '@/components/SchitaGenerator';

export const dynamic = 'force-dynamic';

export default async function SchitaPage() {
  const hasKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const [pal, blat] = await Promise.all([
    prisma.material.findMany({ where: { kind: 'PAL', category: 'PLACA', active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.material.findMany({ where: { category: 'BLAT', active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Schiță → Ofertă</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Încarci schița clientului + detalii, AI-ul citește corpurile, tu confirmi/corectezi și alegi culorile,
          iar softul creează proiectul (client nou) și oferta — pentru MDF vopsit și/sau PAL.
        </p>
      </div>

      {!hasKey && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <b>Cheia Gemini (gratuită) nu e setată.</b> Ia una gratis de pe{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">aistudio.google.com/apikey</a>{' '}
          (cont Google, fără card), pune-o la <code>GEMINI_API_KEY</code> în <code>.env</code> și repornește serverul
          (<code>npm run dev</code>).
        </div>
      )}

      <SchitaGenerator palMaterials={pal} blatMaterials={blat} />
    </div>
  );
}
