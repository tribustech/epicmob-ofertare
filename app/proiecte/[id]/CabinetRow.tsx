'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function CabinetRow({
  href, label, typeLabel, dims, incomplete, hardwareIssue, hardwareEdited, actions,
}: {
  href: string;
  label: string;
  typeLabel: string;
  dims: string;
  incomplete?: boolean;
  hardwareIssue?: string | null;
  hardwareEdited: boolean;
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
        <div className="flex flex-wrap gap-1.5">
          {incomplete && <Badge className="bg-destructive text-white hover:bg-destructive">incomplet</Badge>}
          {hardwareIssue && <Badge variant="outline" className="border-red-500 text-red-700">{hardwareIssue}</Badge>}
          {hardwareEdited ? <Badge variant="secondary">feronerie editată</Badge> : null}
        </div>
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-2">{actions}</div>
      </TableCell>
    </TableRow>
  );
}
