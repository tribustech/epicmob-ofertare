'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MAIN_NAV, isNavActive } from '@/lib/nav/items';

export { MAIN_NAV };

/** Navigația principală (desktop), cu elementul activ evidențiat. Pe telefon o înlocuiește MobileTabBar. */
export function MainNav() {
  const pathname = usePathname();
  const isActive = (href: string) => isNavActive(href, pathname);
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
