'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TableCell, TableRow } from '@/components/ui/table';

export function CabinetRow({
  href, label, typeLabel, dims, problemCount, problemTitle, actions,
}: {
  href: string;
  label: string;
  typeLabel: string;
  dims: string;
  problemCount: number;
  problemTitle?: string;
  actions: ReactNode;
}) {
  const router = useRouter();
  return (
    <TableRow className="cursor-pointer" onClick={() => router.push(href)}>
      <TableCell>
        <Link href={href} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
          {label}
        </Link>
      </TableCell>
      <TableCell>{typeLabel}</TableCell>
      <TableCell>{dims}</TableCell>
      <TableCell>
        {problemCount === 0 ? (
          <span className="text-xs font-medium text-green-600">Complet</span>
        ) : (
          <span className="text-xs font-medium text-red-600" title={problemTitle}>
            {problemCount} {problemCount === 1 ? 'problemă' : 'probleme'}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1">{actions}</div>
      </TableCell>
    </TableRow>
  );
}
