import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const sans = Instrument_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-mono' });

export const metadata = { title: 'EpicMob Ofertare' };

const NAV = [
  { href: '/proiecte', label: 'Proiecte' },
  { href: '/cataloage/materiale', label: 'Materiale' },
  { href: '/cataloage/canturi', label: 'Canturi' },
  { href: '/cataloage/feronerie', label: 'Feronerie' },
  { href: '/cataloage/debitare', label: 'Debitare' },
  { href: '/setari', label: 'Setări' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro" className={cn("font-sans", sans.variable, mono.variable)}>
      <body className="min-h-screen bg-background text-foreground">
        <header className="border-b bg-white print:hidden">
          <nav className="mx-auto flex max-w-[1340px] items-center gap-9 px-6 py-4">
            <Link href="/" className="text-[15px] font-bold tracking-tight">
              EpicMob <span className="font-medium text-muted-foreground">Ofertare</span>
            </Link>
            <div className="flex items-center gap-5">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-[1340px] px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
