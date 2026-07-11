import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">EpicMob Ofertare</h1>
        <p className="text-muted-foreground">
          Creează un proiect de ofertare din pagina Proiecte; prețurile se administrează în cataloage.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link href="/proiecte">
          <Card className="transition-colors hover:bg-muted/50">
            <CardHeader><CardTitle>Proiecte</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Creează și gestionează proiecte de ofertare pentru clienți.
            </CardContent>
          </Card>
        </Link>
        <Link href="/cataloage/materiale">
          <Card className="transition-colors hover:bg-muted/50">
            <CardHeader><CardTitle>Cataloage</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Administrează materiale, cant, feronerie și tarife.
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
