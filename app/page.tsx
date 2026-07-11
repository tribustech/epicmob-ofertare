import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">EpicMob Ofertare</h1>
      <p className="text-neutral-600">
        Creează un proiect de ofertare din pagina Proiecte; prețurile se administrează în cataloage.
      </p>
      <div className="flex gap-3">
        <Link href="/proiecte" className="inline-block rounded bg-neutral-900 px-4 py-2 text-white">
          Proiecte
        </Link>
        <Link href="/cataloage/materiale" className="inline-block rounded border px-4 py-2">
          Cataloage
        </Link>
      </div>
    </div>
  );
}
