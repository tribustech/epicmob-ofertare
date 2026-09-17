import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { redirect } from 'next/navigation';
import { getSessionState } from '@/lib/auth/current-user';
import { logout } from '@/lib/auth/actions';
import { ActionForm } from '@/components/ActionForm';
import { MainNav } from '@/components/MainNav';
import { MobileTabBar } from '@/components/MobileTabBar';
import { Button } from '@/components/ui/button';

const sans = Instrument_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-mono' });

export const metadata = { title: 'EpicMob CRM' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // fără user logat (doar /login ajunge aici, middleware-ul blochează restul) nu afișăm navigația;
  // token valid dar user dezactivat/șters → /logout îi șterge cookie-ul (altfel ar vedea paginile)
  const { hasValidToken, user } = await getSessionState();
  if (hasValidToken && !user) redirect('/logout');
  return (
    <html lang="ro" className={cn("font-sans", sans.variable, mono.variable)}>
      <body className="min-h-screen bg-background text-foreground">
        {user && (
          <header className="hidden border-b bg-white sm:block print:hidden">
            <nav className="mx-auto flex max-w-[1340px] items-center gap-9 px-6 py-4">
              <Link href="/" className="text-[15px] font-bold tracking-tight">
                EpicMob <span className="font-medium text-muted-foreground">CRM</span>
              </Link>
              <MainNav />
              <div className="ml-auto flex items-center gap-3">
                <span className="text-[13px] text-muted-foreground">{user.name}</span>
                <ActionForm action={logout}>
                  <Button type="submit" variant="ghost" size="sm">Ieși</Button>
                </ActionForm>
              </div>
            </nav>
          </header>
        )}
        {/* pe telefon: fără antet, bară fixă jos; spațiul de jos ține conținutul deasupra barei */}
        <main className="mx-auto max-w-[1340px] px-4 pb-24 pt-4 sm:px-6 sm:pb-6 sm:pt-6">{children}</main>
        {user && (
          <MobileTabBar
            userName={user.name}
            logout={(
              <ActionForm action={logout}>
                <Button type="submit" variant="outline" size="sm" className="w-full">Ieși</Button>
              </ActionForm>
            )}
          />
        )}
      </body>
    </html>
  );
}
