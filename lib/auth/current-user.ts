import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SESSION_COOKIE } from './cookie';
import { verifySession } from './jwt';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

export interface SessionState {
  /** cookie-ul există și JWT-ul e valid (semnătură + expirare) */
  hasValidToken: boolean;
  /** userul din token, doar dacă există și e activ */
  user: CurrentUser | null;
}

/**
 * Starea sesiunii: middleware-ul verifică doar semnătura JWT (fără DB pe Edge);
 * verificarea `active`/existență se face aici. `hasValidToken && !user` = user dezactivat/șters
 * cu cookie încă valid → layout-ul îl trimite la /logout ca să-i șteargă cookie-ul.
 */
export async function getSessionState(): Promise<SessionState> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return { hasValidToken: false, user: null };
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, active: true },
  });
  if (!user || !user.active) return { hasValidToken: true, user: null };
  return { hasValidToken: true, user: { id: user.id, email: user.email, name: user.name } };
}

/** utilizatorul logat, sau null dacă nu există cookie valid ori userul e inactiv/șters */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await getSessionState()).user;
}

/** pentru server actions: aruncă redirect la /login dacă nu e nimeni logat */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
