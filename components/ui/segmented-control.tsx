'use client';

import { cn } from '@/lib/utils';

export function SegmentedControl({ value, onChange, options, className }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'cursor-pointer rounded-lg px-4 py-2 text-[13px] transition-colors',
            o.value === value
              ? 'bg-white font-semibold text-foreground shadow-sm'
              : 'font-medium text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
