import { cn } from '@/lib/utils';
import { deadlineParts, type DeadlineTier } from '@/lib/crm/dates';
import {
  CLIENT_STAGE_LABELS, CLIENT_STAGE_PILL, PILL_BASE, PROJECT_STATUS_LABELS, PROJECT_STATUS_PILL,
  type ClientStage, type ProjectStatus,
} from '@/lib/crm/constants';

/** Stiluri comune pentru tabelele CRM (după mockup: header uppercase 10.5px, rânduri 13px). */
export const tableWrapCls = 'overflow-x-auto rounded-xl bg-card ring-1 ring-border';
export const thCls = 'h-[38px] border-b px-3 text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted-foreground first:pl-4 last:pr-4';
export const tdCls = 'border-b px-3 py-[11px] text-[13px] align-top first:pl-4 last:pr-4';
export const microLabelCls = 'text-[11px] font-semibold uppercase tracking-[.04em] text-muted-foreground';

export function StagePill({ stage, className }: { stage: string; className?: string }) {
  const s = stage as ClientStage;
  return (
    <span className={cn(PILL_BASE, CLIENT_STAGE_PILL[s] ?? 'bg-muted text-muted-foreground', className)}>
      {CLIENT_STAGE_LABELS[s] ?? stage}
    </span>
  );
}

export function ProjectStatusPill({ status, className }: { status: string; className?: string }) {
  const s = status as ProjectStatus;
  return (
    <span className={cn(PILL_BASE, PROJECT_STATUS_PILL[s] ?? 'bg-muted text-muted-foreground', className)}>
      {PROJECT_STATUS_LABELS[s] ?? status}
    </span>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed p-12 text-center">
      <p className="text-[15px] font-bold">{title}</p>
      {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

/** Termenul promis clientului, ca pastilă: roșu plin când e întârziat sau azi,
 *  roșu deschis sub 7 zile, neutru mai departe. Folosită în antetul proiectului și în liste. */
export function DeadlineBadge({ deadlineAt, size = 'md', className }: {
  deadlineAt: Date | null; size?: 'sm' | 'md'; className?: string;
}) {
  const dl = deadlineParts(deadlineAt);
  if (dl.tier === 'NONE') {
    return <span className={cn('text-[12.5px] text-muted-foreground', size === 'sm' && 'text-[11.5px]', className)}>fără deadline</span>;
  }
  const tone: Record<DeadlineTier, string> = {
    LATE: 'bg-red-600 text-white ring-red-700',
    TODAY: 'bg-red-600 text-white ring-red-700',
    SOON: 'bg-red-100 text-red-800 ring-red-300 font-semibold',
    APROAPE: 'bg-amber-100 text-amber-900 ring-amber-300 font-semibold',
    OK: 'bg-muted text-foreground ring-border',
    NONE: 'bg-muted text-muted-foreground ring-border',
  };
  const strong = dl.tier === 'LATE' || dl.tier === 'TODAY';
  return (
    <span className={cn(
      'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full ring-1',
      size === 'sm' ? 'px-2 py-0.5 text-[11.5px]' : 'px-2.5 py-1 text-[12.5px]',
      tone[dl.tier], strong && 'font-semibold shadow-sm', className,
    )}>
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] opacity-80">Termen</span>
      <span className="font-mono">{dl.label}</span>
      {dl.sub && <span className={cn('opacity-90', !strong && 'text-muted-foreground')}>· {dl.sub}</span>}
    </span>
  );
}
