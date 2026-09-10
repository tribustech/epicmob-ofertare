import type { ReactNode } from 'react';
import { FinanteSubnav } from '@/components/FinanteSubnav';

export default function FinanteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Finanțe</h1>
      <FinanteSubnav />
      {children}
    </div>
  );
}
