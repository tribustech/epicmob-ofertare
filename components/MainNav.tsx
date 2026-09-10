'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export const MAIN_NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/leaduri', label: 'Leaduri' },
  { href: '/clienti', label: 'Clienți' },
  { href: '/proiecte', label: 'Proiecte' },
  { href: '/finante', label: 'Finanțe' },
  { href: '/luna', label: 'Luna' },
  { href: '/cataloage', label: 'Cataloage' },
  { href: '/setari', label: 'Setări' },
] as const;

/** Navigația principală, cu elementul activ evidențiat (după prefixul căii). */
export function MainNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`) || (href === '/proiecte' && pathname.startsWith('/oferte'));
  return (
    <div className="flex items-center gap-5">
      {MAIN_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'text-[13px] font-medium transition-colors hover:text-foreground',
            isActive(item.href) ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
