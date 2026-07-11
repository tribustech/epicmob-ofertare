import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">EpicMob Ofertare</h1>
      <p className="text-neutral-600">
        Administrează cataloagele de prețuri din meniul de sus. Proiectele de ofertare vin în etapa următoare.
      </p>
      <Link href="/cataloage/materiale" className="inline-block rounded bg-neutral-900 px-4 py-2 text-white">
        Deschide cataloagele
      </Link>
    </div>
  );
}
