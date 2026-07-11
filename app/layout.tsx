import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

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
    <html lang="ro">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-bold">EpicMob Ofertare</Link>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-neutral-600 hover:text-neutral-900">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
