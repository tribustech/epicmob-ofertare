'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import { PRIMARY_NAV, SECONDARY_NAV, isNavActive } from '@/lib/nav/items';

/** Navigația de telefon: bară fixă jos cu patru destinații plus „Mai mult" (restul meniului).
 *  Pe ecrane de la 640px în sus dispare — acolo rămâne antetul clasic. */
export function MobileTabBar({ userName, logout }: { userName: string; logout: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const tab = 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium';

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white pb-[env(safe-area-inset-bottom)] sm:hidden print:hidden">
        <div className="flex items-stretch">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon!;
            const active = isNavActive(item.href, pathname);
            return (
              <Link key={item.href} href={item.href} className={cn(tab, active ? 'text-foreground' : 'text-muted-foreground')}>
                <Icon className={cn('size-5', active && 'stroke-[2.5]')} />
                {item.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setOpen(true)} className={cn(tab, 'text-muted-foreground')}>
            <Menu className="size-5" />
            Mai mult
          </button>
        </div>
      </nav>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 sm:hidden" />
          <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,.15)] outline-none sm:hidden">
            <DialogPrimitive.Title className="border-b px-5 py-3.5 text-[15px] font-bold">{userName}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Restul meniului</DialogPrimitive.Description>
            <div className="grid grid-cols-2 gap-2 p-4">
              {SECONDARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'rounded-xl px-4 py-3 text-[14px] font-medium ring-1 ring-border',
                    isNavActive(item.href, pathname) ? 'bg-foreground text-background' : 'bg-background',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="border-t px-4 py-3">{logout}</div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
