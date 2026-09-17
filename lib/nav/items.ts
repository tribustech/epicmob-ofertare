import { CalendarDays, FolderKanban, LayoutDashboard, Users, type LucideIcon } from 'lucide-react';

export interface NavItem { href: string; label: string; icon?: LucideIcon }

/** Meniul principal, în ordinea din antetul de desktop. */
export const MAIN_NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leaduri', label: 'Leaduri' },
  { href: '/clienti', label: 'Clienți', icon: Users },
  { href: '/proiecte', label: 'Proiecte', icon: FolderKanban },
  { href: '/finante', label: 'Finanțe' },
  { href: '/luna', label: 'Luna' },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/cataloage', label: 'Cataloage' },
  { href: '/setari', label: 'Setări' },
];

/** Bara de jos de pe telefon: ce deschizi de pe teren. Al cincilea buton e „Mai mult". */
export const PRIMARY_NAV: NavItem[] = ['/', '/calendar', '/proiecte', '/clienti']
  .map((href) => MAIN_NAV.find((i) => i.href === href)!);

/** Restul, în panoul „Mai mult". */
export const SECONDARY_NAV: NavItem[] = MAIN_NAV.filter((i) => !PRIMARY_NAV.includes(i));

/** Ruta activă: prefix, cu excepția dashboard-ului; ofertele aparțin de Proiecte. */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`) || (href === '/proiecte' && pathname.startsWith('/oferte'));
}
