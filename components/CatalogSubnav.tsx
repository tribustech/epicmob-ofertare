'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/cataloage/materiale', label: 'Materiale' },
  { href: '/cataloage/canturi', label: 'Canturi' },
  { href: '/cataloage/feronerie', label: 'Feronerie' },
  { href: '/cataloage/debitare', label: 'Debitare' },
  { href: '/cataloage/schita', label: 'Schiță → Ofertă' },
];

/** Sub-navigația de nivel 2 pentru Cataloage (paginile în sine rămân neschimbate). */
export function CatalogSubnav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-5 border-b border-[#d9d7d0]">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              '-mb-px border-b-2 px-0.5 pb-2.5 pt-2 text-[13.5px] font-medium',
              active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
