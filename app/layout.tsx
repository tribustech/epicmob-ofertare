import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata = { title: 'EpicMob Ofertare' };

const NAV = [
  { href: '/proiecte', label: 'Proiecte' },
  { href: '/cataloage/materiale', label: 'Materiale' },
  { href: '/cataloage/canturi', label: 'Canturi' },
  { href: '/cataloage/feronerie', label: 'Feronerie' },
  { href: '/cataloage/debitare', label: 'Debitare' },
  { href: '/cataloage/manopera', label: 'Manoperă' },
  { href: '/setari', label: 'Setări' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <header className="border-b bg-white print:hidden">
          <nav className="mx-auto flex max-w-screen-2xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-bold">EpicMob Ofertare</Link>
            <div className="flex items-center gap-1">
              {NAV.map((item) => (
                <Button key={item.href} asChild variant="ghost" size="sm">
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-screen-2xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
