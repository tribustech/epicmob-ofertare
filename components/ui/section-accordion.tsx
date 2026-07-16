'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionAccordion({ title, summary, open, onToggle, children, complete, error }: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** undefined = fără indicator; true = verde (completat); false = gol (incomplet) */
  complete?: boolean;
  /** secțiunea conține erori vizibile de validare — bulină + contur roșu */
  error?: boolean;
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl bg-card ring-1 ring-border', error && 'ring-destructive/60')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left"
      >
        {complete === true && !error && (
          <span aria-hidden title="Completat" className="size-2.5 shrink-0 rounded-full bg-emerald-500 transition-colors" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-foreground">{title}</div>
          {summary && <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground/80">{summary}</div>}
        </div>
        {error ? (
          <span className="shrink-0 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-white">
            corectează
          </span>
        ) : complete === false ? (
          <span className="shrink-0 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-white">
            incomplet
          </span>
        ) : null}
        <span
          aria-hidden
          className={cn('text-lg leading-none text-muted-foreground/70 transition-transform duration-200', open && 'rotate-90')}
        >
          ›
        </span>
      </button>
      {open && <div className="border-t px-5 pt-4 pb-5">{children}</div>}
    </div>
  );
}
