import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Un rând de listă, pentru telefon: titlu mare, sub el detaliile, la dreapta cifra care contează.
 *  Pe ecrane late rămân tabelele; cardurile se afișează doar sub 640px. */
export function ListCard({ href, title, subtitle, badge, right, rightNote, meta, actions }: {
  href?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;        // pastilă de stare, lângă titlu
  right?: ReactNode;        // suma sau cifra principală
  rightNote?: ReactNode;    // explicația de sub cifră
  meta?: ReactNode;         // rând de jos: termen, note, orice
  actions?: ReactNode;      // butoane (ștergere etc.)
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold">{title}</div>
          {subtitle && <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{subtitle}</div>}
        </div>
        {(right || rightNote) && (
          <div className="shrink-0 text-right">
            {right && <div className="font-mono text-[13px] font-semibold">{right}</div>}
            {rightNote && <div className="text-[11.5px] text-muted-foreground">{rightNote}</div>}
          </div>
        )}
      </div>
      {(badge || meta) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
          {badge}
          {meta}
        </div>
      )}
    </>
  );
  return (
    <div className="relative rounded-xl bg-card p-3.5 ring-1 ring-border">
      {href ? <Link href={href} className="block">{body}</Link> : body}
      {actions && <div className="mt-2 flex items-center justify-end gap-2 border-t pt-2">{actions}</div>}
    </div>
  );
}

/** Containerul cardurilor: vizibil doar pe telefon. */
export function ListCards({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-2 sm:hidden', className)}>{children}</div>;
}
