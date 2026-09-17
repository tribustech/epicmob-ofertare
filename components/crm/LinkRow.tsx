'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Rând de tabel care navighează la click (întregul rând e clicabil, ca în mockup). */
export function LinkRow({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        // butoanele și formularele din rând (ex. ștergerea) își păstrează click-ul
        if ((e.target as HTMLElement).closest('button, a, form, input, select')) return;
        router.push(href);
      }}
      className={cn('cursor-pointer transition-colors hover:bg-muted/50', className)}
    >
      {children}
    </tr>
  );
}
