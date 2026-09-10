import { prisma } from '@/lib/db';
import { monthKey } from './month';
import { round2 } from './money';
import { loadMonthFigures } from './month-report';

const dec = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);
const LOOKBACK_MONTHS = 3;
const MIN_PROJECTS_WITH_HOURS = 3;

/**
 * Indicatori orientativi (§5.4), pe ultimele 3 luni încheiate + luna curentă:
 * rata de overhead = Σ fixe / Σ venit recunoscut; tariful orar încărcat = Σ (Salarii + Taxe stat) / Σ ore
 * ale proiectelor montate. Tariful nu se afișează sub 3 proiecte cu ore.
 */
export async function loadIndicators(today = new Date()) {
  const keys = Array.from({ length: LOOKBACK_MONTHS }, (_, i) => monthKey(new Date(today.getFullYear(), today.getMonth() - i, 1)));
  const figures = await Promise.all(keys.map((k) => loadMonthFigures(k)));
  const revenue = round2(figures.reduce((s, f) => s + f.revenue, 0));
  const fixed = round2(figures.reduce((s, f) => s + f.fixed, 0));
  const overheadRate = revenue > 0 ? round2(fixed / revenue) : null;

  const start = new Date(today.getFullYear(), today.getMonth() - (LOOKBACK_MONTHS - 1), 1);
  const [salaryCats, mounted] = await Promise.all([
    prisma.costCategory.findMany({ where: { scope: 'INDIRECT', name: { in: ['Salarii', 'Taxe stat'] } }, select: { id: true } }),
    prisma.project.findMany({ where: { mountedAt: { gte: start }, hoursWorked: { not: null } }, select: { hoursWorked: true } }),
  ]);
  const salaryDocs = await prisma.document.findMany({
    where: { direction: 'EXPENSE', replacedBy: null, issuedAt: { gte: start }, categoryId: { in: salaryCats.map((c) => c.id) } },
    select: { amount: true, allocations: { select: { amount: true } } },
  });
  const salaries = round2(salaryDocs.reduce((s, d) => s + dec(d.amount) - d.allocations.reduce((a, x) => a + dec(x.amount), 0), 0));
  const hours = round2(mounted.reduce((s, p) => s + (p.hoursWorked ?? 0), 0));
  const projectsWithHours = mounted.length;
  const hourlyRate = projectsWithHours >= MIN_PROJECTS_WITH_HOURS && hours > 0 ? round2(salaries / hours) : null;

  return {
    months: keys, revenue, fixed, overheadRate,
    salaries, hours, projectsWithHours, hourlyRate, minProjectsForHourly: MIN_PROJECTS_WITH_HOURS,
    mountedProjects: figures.reduce((s, f) => s + f.mountedCount, 0),
  };
}
