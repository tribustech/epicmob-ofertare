/** acceptăm doar căi relative interne la redirectul de după login (fără open redirect) */
export function safeNextPath(next: string | undefined | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) return '/';
  return next;
}
