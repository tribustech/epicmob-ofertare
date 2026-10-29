import type { ReactNode } from 'react';
import { FinanteSubnav } from '@/components/FinanteSubnav';
import { countPendingSubmissions } from '@/lib/inbox/review-queries';

export default async function FinanteLayout({ children }: { children: ReactNode }) {
  const pendingCount = await countPendingSubmissions();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Finanțe</h1>
      <FinanteSubnav pendingCount={pendingCount} />
      {children}
    </div>
  );
}
