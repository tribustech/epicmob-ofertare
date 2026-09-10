import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/auth/cookie';

/**
 * Șterge cookie-ul de sesiune și trimite la /login. Folosit de layout când tokenul e valid
 * dar userul a fost dezactivat/șters (un server component nu poate seta cookie-uri).
 */
export async function GET() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/login');
}
