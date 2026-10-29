'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/finante', label: 'Conturi', exact: true },
  { href: '/finante/incasari', label: 'Încasări' },
  { href: '/finante/cheltuieli', label: 'Cheltuieli' },
  { href: '/finante/de-validat', label: 'De validat' },
  { href: '/finante/recurente', label: 'Recurente' },
  { href: '/finante/imprumuturi', label: 'Împrumuturi' },
  { href: '/finante/ajustari', label: 'Ajustări' },
];

/** Sub-navigația Finanțe (nivel 2). Registrul unui cont (/finante/conturi/…) ține „Conturi" activ. */
export function FinanteSubnav({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-5 overflow-x-auto border-b border-[#d9d7d0]">
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href || pathname.startsWith('/finante/conturi')
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              '-mb-px shrink-0 whitespace-nowrap border-b-2 px-0.5 pb-2.5 pt-2 text-[13.5px] font-medium',
              active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            {item.href === '/finante/de-validat' && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-px font-mono text-[11px] font-semibold text-amber-800">{pendingCount}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
