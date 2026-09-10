import { cn } from '@/lib/utils';
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
