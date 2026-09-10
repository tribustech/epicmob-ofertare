import type { ReactNode } from 'react';
import { CatalogSubnav } from '@/components/CatalogSubnav';

export default function CataloageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <CatalogSubnav />
      {children}
    </div>
  );
}
