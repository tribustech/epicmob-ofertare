'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HoverCard } from 'radix-ui';
import { TableCell, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useBulkCabinetSelection } from '@/components/BulkCabinetEditor';

export function CabinetRow({
  cabinetId, showSelection, selectable, href, label, typeLabel, dims, problems, actions,
}: {
  cabinetId: string;
  showSelection?: boolean;
  selectable?: boolean;
  href: string;
  label: string;
  typeLabel: string;
  dims: string;
  problems: { label: string; qty: number }[];
  actions: ReactNode;
}) {
  const router = useRouter();
  const selection = useBulkCabinetSelection();
  const total = problems.reduce((sum, p) => sum + p.qty, 0);
  return (
    <TableRow className="cursor-pointer" onClick={() => router.push(href)}>
      {showSelection && (
        <TableCell className="w-10" onClick={(event) => event.stopPropagation()}>
          {selectable && (
            <Checkbox
              aria-label={`Selectează ${label}`}
              checked={selection?.isSelected(cabinetId) ?? false}
              onCheckedChange={(checked) => selection?.toggle(cabinetId, checked === true)}
            />
          )}
        </TableCell>
      )}
      <TableCell>
        <Link href={href} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
          {label}
        </Link>
      </TableCell>
      <TableCell>{typeLabel}</TableCell>
      <TableCell>{dims}</TableCell>
      <TableCell>
        {total === 0 ? (
          <span className="text-xs font-medium text-green-600">Complet</span>
        ) : (
          <HoverCard.Root openDelay={80} closeDelay={80}>
            <HoverCard.Trigger asChild>
              <span className="cursor-default text-xs font-medium text-red-600 underline decoration-dotted underline-offset-2">
                {total} {total === 1 ? 'problemă' : 'probleme'}
              </span>
            </HoverCard.Trigger>
            <HoverCard.Portal>
              <HoverCard.Content
                side="top" align="start" sideOffset={6}
                className="z-50 max-w-64 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                <ul className="space-y-0.5">
                  {problems.map((p, i) => (
                    <li key={i}>{p.label}{p.qty > 1 ? ` × ${p.qty}` : ''}</li>
                  ))}
                </ul>
                <HoverCard.Arrow className="fill-border" />
              </HoverCard.Content>
            </HoverCard.Portal>
          </HoverCard.Root>
        )}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1">{actions}</div>
      </TableCell>
    </TableRow>
  );
}

/** Același corp, ca pe telefon: card în loc de rând de tabel. */
export function CabinetCard({
  cabinetId, showSelection, selectable, href, label, typeLabel, dims, problems, actions,
}: {
  cabinetId: string;
  showSelection?: boolean;
  selectable?: boolean;
  href: string;
  label: string;
  typeLabel: string;
  dims: string;
  problems: { label: string; qty: number }[];
  actions: ReactNode;
}) {
  const selection = useBulkCabinetSelection();
  const total = problems.reduce((sum, p) => sum + p.qty, 0);
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-border">
      <div className="flex items-start gap-2.5">
        {showSelection && selectable && (
          <Checkbox
            className="mt-0.5"
            aria-label={`Selectează ${label}`}
            checked={selection?.isSelected(cabinetId) ?? false}
            onCheckedChange={(checked) => selection?.toggle(cabinetId, checked === true)}
          />
        )}
        <Link href={href} className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold">{label}</div>
          <div className="mt-0.5 text-[12.5px] text-muted-foreground">{typeLabel} · {dims} mm</div>
          {total === 0 ? (
            <div className="mt-1 text-[12px] font-medium text-green-600">Complet</div>
          ) : (
            <ul className="mt-1 space-y-0.5 text-[12px] font-medium text-red-600">
              {problems.map((p, i) => <li key={i}>{p.label}{p.qty > 1 ? ` × ${p.qty}` : ''}</li>)}
            </ul>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      </div>
    </div>
  );
}
