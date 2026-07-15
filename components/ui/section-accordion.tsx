'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionAccordion({ title, summary, open, onToggle, children }: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-foreground">{title}</div>
          {summary && <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground/80">{summary}</div>}
        </div>
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
