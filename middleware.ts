import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/cookie';
import { shouldRenew, signSession, verifySession } from '@/lib/auth/jwt';

/**
 * Protejează tot în afară de /login și fișierele statice. Verifică doar semnătura și expirarea
 * JWT-ului (fără DB pe Edge); starea `active` a userului se verifică în getCurrentUser().
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // fișiere statice din public/ (decoruri, ral, favicon) — orice cale cu extensie trece
  if (/\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = pathname === '/login';

  if (!session) {
    if (isLogin) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (isLogin) return NextResponse.redirect(new URL('/', req.url));

  const res = NextResponse.next();
  if (shouldRenew(session)) {
    res.cookies.set(SESSION_COOKIE, await signSession(session.userId), sessionCookieOptions());
  }
  return res;
}

export const config = {
  // tot, mai puțin _next (extensiile de fișier se filtrează mai sus — un `\.` în matcher își pierde escape-ul)
  matcher: ['/((?!_next/static|_next/image).*)'],
};
