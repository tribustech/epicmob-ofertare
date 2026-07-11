import type { ReactNode } from 'react';

export const metadata = { title: 'EpicMob Ofertare' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
