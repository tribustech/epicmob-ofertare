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
